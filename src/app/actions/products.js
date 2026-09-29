'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { decodeCsv, parseCatalogCsv, parsePrice, toProduct } from '@/lib/catalog';
import { runMatch, splitSize } from '@/lib/pipeline/match';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { loadSuggestions, refreshStatuses } from '@/lib/suggestions';

// Rows per import_products call; keeps each request well under PostgREST's body limit.
const IMPORT_BATCH = 500;
// apply_price calls in flight at once during a bulk apply.
const APPLY_CONCURRENCY = 10;
// Keep in step with serverActions.bodySizeLimit in next.config.mjs.
const MAX_CSV_BYTES = 4 * 1024 * 1024;

// Signed-in client or a redirect; RLS scopes every query to the caller's products.
async function merchant() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login?next=/dashboard');
  return supabase;
}

const fields = (formData) => Object.fromEntries(['name', 'brand', 'size', 'sku', 'price', 'cost'].map((f) => [f, formData.get(f)]));
const dbError = (error) => (error.code === '23505' ? 'sku_taken' : 'unknown');

// Matches one saved product against the listings already scraped, after the
// response is sent, so saving never waits on Gemini. The id came back through
// RLS, so the service-role client only touches the caller's own product. If the
// platform cuts the run short, the daily `npm run match` picks it up.
// ponytail: one run per save; batch through a queue if imports should match too.
function matchInBackground(id) {
  after(() =>
    runMatch(createAdminClient(), { productIds: [id], log: () => {} })
      .then(({ stopped }) => stopped && console.warn('background match stopped', id, stopped))
      .catch((error) => console.error('background match failed', id, error)),
  );
}

function done() {
  revalidatePath('/dashboard', 'layout');
}

// Each action returns { error, values } or { notice } for useActionState.

export async function saveProduct(_prev, formData) {
  const values = fields(formData);
  const { product, error } = toProduct(values);
  if (error) return { error, values };

  const supabase = await merchant();
  const id = formData.get('id');
  const query = id ? supabase.from('products').update(product).eq('id', id) : supabase.from('products').insert(product);
  const res = await query.select('id').single();
  if (res.error) return { error: dbError(res.error), values };

  // A new price changes the status against the listings already matched; the
  // page's tone, badge and suggestion copy all read it.
  await refreshStatuses(supabase, res.data.id);
  matchInBackground(res.data.id);
  done();
  if (id) redirect(`/dashboard/products/${id}?notice=saved`);
  redirect(`/dashboard?added=${res.data.id}`);
}

export async function deleteProduct(formData) {
  const supabase = await merchant();
  const { error } = await supabase.from('products').delete().eq('id', formData.get('id'));
  if (error) throw new Error(`${error.code}: ${error.message}`, { cause: error });
  done();
  redirect('/dashboard?notice=deleted');
}

export async function importProducts(_prev, formData) {
  const file = formData.get('file');
  if (!file?.size) return { error: 'no_file' };
  if (file.size > MAX_CSV_BYTES) return { error: 'too_big' };

  const { products, errors, missing } = parseCatalogCsv(decodeCsv(await file.arrayBuffer()));
  if (missing.length) return { error: 'columns', missing };
  if (!products.length) return { error: 'empty', errors: errors.slice(0, 10), skipped: errors.length };

  const supabase = await merchant();
  let inserted = 0;
  let updated = 0;
  for (let i = 0; i < products.length; i += IMPORT_BATCH) {
    const { data, error } = await supabase.rpc('import_products', { items: products.slice(i, i + IMPORT_BATCH) }).single();
    if (error) return { error: 'unknown', inserted, updated };
    inserted += data.inserted;
    updated += data.updated;
  }

  done();
  return {
    notice: 'imported',
    inserted,
    updated,
    unchanged: products.length - inserted - updated,
    skipped: errors.length,
    errors: errors.slice(0, 10),
  };
}

// Accept or undo a possible match (a listing Gemini flagged as similar). RLS on
// product_links only allows the caller's own products.
async function setLink(formData, linked) {
  const supabase = await merchant();
  const productId = Number(formData.get('product_id'));
  const listingId = Number(formData.get('listing_id'));
  if (linked) await adoptListing(supabase, productId, listingId);
  const { error } = linked
    ? await supabase.from('product_links').upsert({ product_id: productId, listing_id: listingId })
    : await supabase.from('product_links').delete().eq('product_id', productId).eq('listing_id', listingId);
  if (error) throw new Error(`${error.code}: ${error.message}`, { cause: error });
  await refreshStatuses(supabase, productId);
  if (linked) matchInBackground(productId);
  done();
}

// A merchant who picks a listing is saying "this is my product", so the
// listing's fuller name, pack size, brand and category replace the vague ones.
// That makes the next match find it in other chains too (matchInBackground).
// Runs before the link is written: the rename trigger drops existing links.
// The SKU and prices stay the merchant's own; unlinking keeps the new details.
async function adoptListing(supabase, productId, listingId) {
  const [{ data: listing, error }, { data: product, error: productError }] = await Promise.all([
    supabase.from('competitor_listings').select('title, brand, size, category_code').eq('id', listingId).single(),
    supabase.from('products').select('brand, category_code, product_links(listing_id)').eq('id', productId).single(),
  ]);
  if (error || productError) throw new Error('listing or product not found', { cause: error ?? productError });
  // Only the first pick renames; a rename would drop the links already chosen.
  if (product.product_links.length) return;
  const { name, size } = splitSize(listing.title);
  const { error: updateError } = await supabase
    .from('products')
    .update({
      name,
      size: listing.size ?? size,
      brand: listing.brand ?? product.brand,
      category_code: listing.category_code ?? product.category_code,
    })
    .eq('id', productId);
  if (updateError) throw new Error(`${updateError.code}: ${updateError.message}`, { cause: updateError });
}

export async function linkListing(formData) {
  await setLink(formData, true);
}

export async function unlinkListing(formData) {
  await setLink(formData, false);
}

// "Apply" on a suggested price. The price is validated like any typed one; the
// merchant could enter it by hand anyway. apply_price tags the history row
// 'apply', so Reports can tell suggestions taken from manual edits.
export async function applyPrice(formData) {
  const supabase = await merchant();
  const id = Number(formData.get('id'));
  const price = parsePrice(formData.get('price'));
  if (!(price > 0 && price < 1e8)) redirect(`/dashboard/products/${id}`);
  const { error } = await supabase.rpc('apply_price', { product_id: id, new_price: price });
  if (error) throw new Error(`${error.code}: ${error.message}`, { cause: error });
  await refreshStatuses(supabase, id);
  done();
  redirect(`/dashboard/products/${id}?notice=priceApplied`);
}

// "Not now" on a suggestion: remember the dismissed price (empty = show it again).
// It only hides that exact price, so a market or rule change brings a new one back.
export async function dismissSuggestion(formData) {
  const supabase = await merchant();
  const id = Number(formData.get('id'));
  const price = parsePrice(formData.get('price'));
  const { error } = await supabase.from('products').update({ dismissed_price: price > 0 ? price : null }).eq('id', id);
  if (error) throw new Error(`${error.code}: ${error.message}`, { cause: error });
  done();
  redirect(`/dashboard/products/${id}`);
}

// Bulk apply from the dashboard: the ticked products get their suggested price.
// Only ids come from the form; the prices are recomputed from today's data, so a
// stale dialog can't write a stale price. Each change goes through apply_price
// (history tagged 'apply'), then statuses are set in one update per status.
// ponytail: one RPC per product; add a set-based apply_prices(items) when bulk runs reach thousands.
export async function applySuggestions(formData) {
  const ids = formData.getAll('id').map(Number).filter(Number.isSafeInteger);
  if (!ids.length) redirect('/dashboard');
  const supabase = await merchant();
  const rows = (await loadSuggestions(supabase, ids)).filter((r) => !r.held && !r.dismissed);

  const failed = [];
  const applied = [];
  for (let i = 0; i < rows.length; i += APPLY_CONCURRENCY) {
    const chunk = rows.slice(i, i + APPLY_CONCURRENCY);
    const results = await Promise.all(
      chunk.map((r) => supabase.rpc('apply_price', { product_id: r.id, new_price: r.suggested })),
    );
    results.forEach(({ error }, j) => (error ? failed : applied).push(error ?? chunk[j]));
  }

  const byStatus = Map.groupBy(applied, (r) => r.next);
  for (const [status, group] of byStatus) {
    const { error } = await supabase.from('products').update({ price_status: status }).in('id', group.map((r) => r.id));
    if (error) failed.push(error);
  }

  done();
  if (failed.length) throw new Error(`${failed[0].code}: ${failed[0].message}`, { cause: failed[0] });
  redirect(`/dashboard?applied=${applied.length}`);
}
