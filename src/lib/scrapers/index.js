/**
 * Competitor price scrapers. Every registered chain is read from the KZP
 * open-data ZIP by company EIK: it has stable product codes, regular and promo
 * prices, the KZP category and per-store rows for every chain in scope.
 * Each scraper is `{ competitorKey, scrape(supabase) }`; keys must match
 * `COMPETITORS` in `src/lib/config.js` and the `competitors` table.
 * Run with a service-role client (RLS reserves competitor writes for it).
 */
import { loadZip, readChainCsvs, aggregateRows } from './kzp.js';

// Chain -> company EIKs in the ZIP, plus a first-run floor on product codes.
// Fantastico files under two companies (one is a franchise); both share the
// chain's codes. `minCodes` (roughly a third of a normal day in Sept 2026) is
// used only while a chain has no recent history, e.g. its first run or after a
// gap of over a week; after that the baseline comes from the chain's own data,
// so a chain that legitimately shrinks isn't rejected forever. (BILLA's
// 2026-09-24 file held one pharmacy's 53 codes instead of ~1,486.)
const KZP_CHAINS = {
  kaufland: { eiks: ['131129282'], minCodes: 800 },
  lidl: { eiks: ['131071587'], minCodes: 250 },
  billa: { eiks: ['130007884'], minCodes: 500 },
  fantastico: { eiks: ['206255903', '831556063'], minCodes: 750 },
  tmarket: { eiks: ['131324923'], minCodes: 250 },
  metro: { eiks: ['121644736'], minCodes: 600 },
  hitmax: { eiks: ['131016929'], minCodes: 1000 },
  bulmag: { eiks: ['127585839'], minCodes: 500 },
  kammarket: { eiks: ['202923636'], minCodes: 80 },
  berezka: { eiks: ['201029124'], minCodes: 8 },
};

export const scrapers = Object.entries(KZP_CHAINS).map(([competitorKey, { eiks, minCodes }]) => ({
  competitorKey,
  async scrape(supabase) {
    const { date, zip } = await loadZip();
    const rows = aggregateRows(await readChainCsvs(zip, eiks));
    return upsertListings(supabase, competitorKey, rows, date, minCodes);
  },
}));

const BATCH_SIZE = 500;

/**
 * A feed with under half the codes seen in the last week is a truncated
 * download or a wrong file; skip it rather than record a broken day. With no
 * recent history, the scraper's static `minCodes` floor stands in.
 */
const MIN_COVERAGE = 0.5;

/**
 * Upserts listings on `(competitor_key, external_id)`, so ids and matches stay
 * stable, and upserts one history row per listing on `(listing_id, data_date)`,
 * so rerunning a day is harmless. Nothing is deleted: a delisted product just
 * stops getting new history, and its `captured_at` shows when it was last seen.
 */
export async function upsertListings(supabase, competitorKey, rows, dataDate, minCodes = 1) {
  if (rows.length === 0) throw new Error('Feed had no usable rows');

  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const { count: recent, error: countError } = await supabase
    .from('competitor_listings')
    .select('*', { count: 'exact', head: true })
    .eq('competitor_key', competitorKey)
    .gte('captured_at', weekAgo);
  if (countError) throw countError;
  const expected = recent ? Math.ceil(recent * MIN_COVERAGE) : minCodes;
  if (rows.length < expected) {
    throw new Error(`Only ${rows.length} codes (expected at least ${expected}); feed looks truncated or wrong`);
  }

  const capturedAt = new Date().toISOString();
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data: listings, error } = await supabase
      .from('competitor_listings')
      .upsert(
        batch.map((r) => ({
          competitor_key: competitorKey,
          external_id: r.external_id,
          title: r.title,
          category_code: r.category_code,
          price: r.price,
          on_promo: r.on_promo,
          captured_at: capturedAt,
        })),
        { onConflict: 'competitor_key,external_id' },
      )
      .select('id, external_id');
    if (error) throw error;

    const idByCode = new Map(listings.map((l) => [l.external_id, l.id]));
    const { error: historyError } = await supabase.from('competitor_listing_price_history').upsert(
      batch.map((r) => ({
        listing_id: idByCode.get(r.external_id),
        data_date: dataDate,
        price: r.price,
        regular_price: r.regular_price,
        min_price: r.min_price,
        max_price: r.max_price,
        on_promo: r.on_promo,
        store_count: r.store_count,
        captured_at: capturedAt,
      })),
      { onConflict: 'listing_id,data_date' },
    );
    if (historyError) throw historyError;
  }

  return { count: rows.length };
}

/**
 * Runs the scrapers one after another (all of them, or only `keys`), carrying
 * on past failures, and logs the run to `scrape_runs` on a best-effort basis.
 */
export async function scrapeAll(supabase, keys = []) {
  const startedAt = new Date().toISOString();
  const selected = keys.length ? scrapers.filter((s) => keys.includes(s.competitorKey)) : scrapers;
  const results = [];

  for (const { competitorKey, scrape } of selected) {
    try {
      const { count } = await scrape(supabase);
      results.push({ competitorKey, ok: true, count });
    } catch (error) {
      results.push({ competitorKey, ok: false, error: error.message });
    }
  }

  await recordScrapeRun(supabase, startedAt, results);
  return results;
}

async function recordScrapeRun(supabase, startedAt, results) {
  try {
    const okCount = results.filter((r) => r.ok).length;
    const { data: run, error } = await supabase
      .from('scrape_runs')
      .insert({
        started_at: startedAt,
        total_count: results.length,
        ok_count: okCount,
        failed_count: results.length - okCount,
      })
      .select('id')
      .single();
    if (error) throw error;

    const { error: resultsError } = await supabase.from('scrape_run_results').insert(
      results.map((r) => ({
        run_id: run.id,
        competitor_key: r.competitorKey,
        ok: r.ok,
        listing_count: r.ok ? r.count : null,
        error_message: r.ok ? null : r.error,
      })),
    );
    if (resultsError) throw resultsError;
  } catch (error) {
    console.error('Failed to record the scrape run:', error.message);
  }
}
