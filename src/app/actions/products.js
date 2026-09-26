'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { decodeCsv, parseCatalogCsv, toProduct } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/server';

// Rows per import_products call; keeps each request well under PostgREST's body limit.
const IMPORT_BATCH = 500;
// Keep in step with serverActions.bodySizeLimit in next.config.mjs.
const MAX_CSV_BYTES = 4 * 1024 * 1024;

// Signed-in client or a redirect; RLS scopes every query to the caller's products.
async function merchant() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login?next=/dashboard/products');
  return supabase;
}

const fields = (formData) => Object.fromEntries(['name', 'brand', 'size', 'sku', 'price'].map((f) => [f, formData.get(f)]));
const dbError = (error) => (error.code === '23505' ? 'sku_taken' : 'unknown');

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
  const res = id
    ? await supabase.from('products').update(product).eq('id', id)
    : await supabase.from('products').insert(product);
  if (res.error) return { error: dbError(res.error), values };

  done();
  if (id) redirect('/dashboard/products?notice=saved');
  return { notice: 'added' };
}

export async function deleteProduct(formData) {
  const supabase = await merchant();
  const { error } = await supabase.from('products').delete().eq('id', formData.get('id'));
  if (error) throw new Error(`${error.code}: ${error.message}`, { cause: error });
  done();
  redirect('/dashboard/products?notice=deleted');
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
