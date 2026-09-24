/**
 * Helpers shared by every competitor scraper in this directory.
 *
 * Each scraper module exports `{ competitorKey, scrape(supabase) }` and is
 * registered in `index.js`; the (planned) cron runner iterates that registry
 * rather than importing scrapers by name.
 *
 * These write the app's own schema (see `supabase/migrations/0001_init.sql` +
 * `0003_competitor_listing_identity.sql` + `0008_add_price_history.sql`):
 *   competitor_listings(id, competitor_key, title, brand, size, price, url,
 *                       external_id, captured_at)
 *   competitor_listing_price_history(id, listing_id, price, on_promo, captured_at)
 * `competitor_key` must be one of `COMPETITORS` in `src/lib/config.js`.
 */

export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export async function fetchText(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': BROWSER_USER_AGENT, ...init.headers },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

export async function fetchArrayBuffer(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': BROWSER_USER_AGENT, ...init.headers },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.arrayBuffer();
}

/** Politeness delay — call between iterations of a scraper's fetch loop. */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Minimal RFC4180-ish CSV parser (quoted fields, "" escaped quotes, CRLF or
 * LF). Good enough for the government-mandated KZP price feeds, which are
 * plain machine-generated CSVs, not free-form user content.
 */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip UTF-8 BOM

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Tries each label in priority order, searching the WHOLE header for each one
 * before falling back to the next — so a specific label ("код на продукта")
 * wins over a generic one ("код") even when the generic label also matches an
 * unrelated column.
 */
function findColumn(headerRow, labels) {
  for (const label of labels) {
    const idx = headerRow.findIndex((h) => h.trim().toLowerCase().includes(label));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Bulgaria's price-transparency law (чл. 55б ЗВЕРБ, part of the euro-adoption
 * legislation) requires large retailers to publish a daily machine-readable
 * export of their full catalog: product name, code, category, retail price and
 * current promo price, one row per store per product.
 *
 * This maps such a feed (already split into header + data rows, from CSV or
 * XLSX) into `competitor_listings` rows — deduped to one row per product code,
 * since this app tracks one national price per competitor, not a price per
 * physical store. `price` is the effective shelf price (promo price when a
 * product is on promotion, otherwise the regular price).
 *
 * Column labels vary between retailers (and, for Lidl, between the two files of
 * one feed): the standard export uses "наименование" / "цена" / "цена в
 * промоция", while the richer variant uses "име на продукта" / "референтна
 * цена" / "текуща намалена цена" and adds "марка" and "нетно количество".
 * Both shapes are matched here; callers pass one file's header + rows at a time.
 */
export function normalizeKzpRows(headerRow, dataRows, { sourceUrl }) {
  const nameCol = findColumn(headerRow, ['наименование', 'име на продукт']);
  const codeCol = findColumn(headerRow, ['код на продукта', 'код']);
  const brandCol = findColumn(headerRow, ['марка']);
  const sizeCol = findColumn(headerRow, ['нетно количество']);
  const promoCol = findColumn(headerRow, [
    'цена в промоция',
    'намалена цена',
    'промоция',
  ]);
  // A plain "цена" label also matches the promo columns ("цена в промоция",
  // "намалена цена"), so both promo wordings are excluded from the retail match.
  const retailCol = headerRow.findIndex((h) => {
    const lower = h.trim().toLowerCase();
    return lower.includes('цена') && !lower.includes('промоц') && !lower.includes('намален');
  });

  if (nameCol === -1 || codeCol === -1 || retailCol === -1) {
    throw new Error(
      'KZP price feed columns not found — retailer may have changed their export format',
    );
  }

  const seen = new Map();
  for (const cols of dataRows) {
    const name = cols[nameCol]?.trim();
    const code = cols[codeCol]?.trim();
    if (!name || !code || seen.has(code)) continue;

    const promoPrice = promoCol !== -1 ? parseFloat(cols[promoCol]) : NaN;
    const retailPrice = parseFloat(cols[retailCol]);

    // Several feeds write "0" / "0.00" in the promo column to mean "not on
    // promotion" rather than leaving it blank, so a promo price is only real
    // when it is positive and below the shelf price.
    const onPromo =
      Number.isFinite(promoPrice) &&
      promoPrice > 0 &&
      Number.isFinite(retailPrice) &&
      promoPrice < retailPrice;
    const price = onPromo
      ? promoPrice
      : Number.isFinite(retailPrice)
        ? retailPrice
        : promoPrice;
    if (!Number.isFinite(price) || price <= 0) continue;

    const brand = brandCol !== -1 ? cols[brandCol]?.trim() || undefined : undefined;
    const size = sizeCol !== -1 ? cleanSize(cols[sizeCol]) : undefined;

    seen.set(code, {
      external_id: code,
      title: name,
      price,
      on_promo: onPromo,
      ...(brand && { brand }),
      ...(size && { size }),
      url: sourceUrl,
    });
  }

  return [...seen.values()];
}

// The richer feed reports net quantity as a bare decimal ("1.00000", "0.70000")
// with the unit implied by category, so trim the trailing-zero noise and drop
// anything that isn't a usable quantity.
function cleanSize(raw) {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (Number.isFinite(n)) return n > 0 ? String(n) : undefined;
  return trimmed;
}

// PostgREST rejects overly large single upserts and some feeds run to tens of
// thousands of rows, so write them in bounded batches.
const UPSERT_BATCH_SIZE = 500;

/**
 * Fraction of the previous run's listing count a scrape must reach before its
 * unseen rows are pruned. Day-to-day a feed varies by a few percent; a drop
 * past this threshold means a truncated download or a parser break, and the
 * older data is kept rather than deleted.
 */
const PRUNE_MIN_COVERAGE = 0.5;

/**
 * Records one `competitor_listing_price_history` row per listing in this
 * upsert batch, using the ids the upsert just returned (`upsertListings`
 * only sends `.select('id, external_id')`, not the full row, to keep the
 * response small). This is what lets the product detail page chart a real
 * price-over-time trend instead of only ever seeing today's price.
 */
async function insertPriceHistory(supabase, batch, upserted) {
  const idByExternalId = new Map(upserted.map((r) => [r.external_id, r.id]));
  const rows = batch
    .map((r) => {
      const listingId = idByExternalId.get(r.external_id);
      if (!listingId) return null;
      return {
        listing_id: listingId,
        price: r.price,
        on_promo: r.on_promo,
        captured_at: r.captured_at,
      };
    })
    .filter(Boolean);
  if (rows.length === 0) return;

  const { error } = await supabase.from('competitor_listing_price_history').insert(rows);
  if (error) throw error;
}

/**
 * Upserts scraped rows into `competitor_listings`, keyed by
 * `(competitor_key, external_id)`, records one `competitor_listing_price_history`
 * row per listing for today's price, then prunes rows this run didn't see —
 * products delisted from the feed, and any junk left by an earlier bad run.
 * The upsert keeps each surviving row's `id` stable, so `product_matches`
 * rows for still-listed products stay valid from day to day.
 *
 * Rows are `{ external_id, title, price }` plus optional `{ brand, size, url,
 * on_promo }` (defaults to `false` when omitted — every `normalizeKzpRows`
 * output already sets it; only `kaufland.js`, which doesn't go through that
 * helper, sets it explicitly itself).
 * Takes the Supabase client as a parameter because the caller needs
 * service-role access (RLS reserves writes to this table for the scraper
 * pipeline, not merchant sessions).
 *
 * Returns `{ count, pruned }` — rows written, and stale rows deleted (0 when
 * the run looked too incomplete to prune safely; see `PRUNE_MIN_COVERAGE`).
 */
export async function upsertListings(supabase, competitorKey, rows) {
  const deduped = [...new Map(rows.map((r) => [r.external_id, r])).values()].filter(
    (r) => r.external_id && r.title && Number.isFinite(Number(r.price)),
  );
  if (deduped.length === 0) return { count: 0, pruned: 0 };

  const { count: existingBefore } = await supabase
    .from('competitor_listings')
    .select('*', { count: 'exact', head: true })
    .eq('competitor_key', competitorKey);

  const capturedAt = new Date().toISOString();
  const prepared = deduped.map((r) => ({
    competitor_key: competitorKey,
    external_id: String(r.external_id),
    title: r.title,
    brand: r.brand ?? null,
    size: r.size ?? null,
    price: r.price,
    on_promo: r.on_promo ?? false,
    url: r.url ?? null,
    captured_at: capturedAt,
  }));

  for (let i = 0; i < prepared.length; i += UPSERT_BATCH_SIZE) {
    const batch = prepared.slice(i, i + UPSERT_BATCH_SIZE);
    const { data: upserted, error } = await supabase
      .from('competitor_listings')
      .upsert(batch, { onConflict: 'competitor_key,external_id' })
      .select('id, external_id');
    if (error) throw error;

    await insertPriceHistory(supabase, batch, upserted ?? []);
  }

  let pruned = 0;
  const coverageOk =
    !existingBefore || prepared.length >= existingBefore * PRUNE_MIN_COVERAGE;
  if (coverageOk) {
    const { data, error } = await supabase
      .from('competitor_listings')
      .delete()
      .eq('competitor_key', competitorKey)
      .lt('captured_at', capturedAt)
      .select('id');
    if (error) throw error;
    pruned = data?.length ?? 0;
  }

  return { count: prepared.length, pruned };
}
