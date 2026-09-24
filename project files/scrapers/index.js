/**
 * Competitor price scrapers, registered here so the cron runner
 * (`scripts/scrape.mjs`) and any CLI script can iterate them generically
 * instead of importing each by name. Each module exports
 * `{ competitorKey, scrape(supabase) }`.
 *
 * `competitorKey` must be one of `COMPETITORS` in `src/lib/config.js` /
 * `competitors` in the database; every current competitor has a scraper here.
 *
 * Kaufland and the four KZP-feed chains scrape a source of their own; the rest
 * read the shared KZP "Колко струва" open-data ZIP via `kolkostruva.js`.
 */
import * as kaufland from './kaufland.js';
import * as fantastico from './fantastico.js';
import * as lidl from './lidl.js';
import * as tmarket from './tmarket.js';
import * as billa from './billa.js';
import * as metro from './metro.js';
import * as bulmag from './bulmag.js';
import * as hitmax from './hitmax.js';
import * as kammarket from './kammarket.js';
import * as berezka from './berezka.js';

export const scrapers = [
  kaufland,
  fantastico,
  lidl,
  tmarket,
  billa,
  metro,
  bulmag,
  hitmax,
  kammarket,
  berezka,
];

/**
 * Runs every registered scraper, continuing past individual failures so one
 * competitor changing their page layout doesn't block the rest. Returns a
 * per-competitor result list; callers decide what to do with failures.
 */
export async function scrapeAll(supabase) {
  const startedAt = new Date().toISOString();
  const results = [];

  for (const scraper of scrapers) {
    try {
      const { count, pruned = 0 } = await scraper.scrape(supabase);
      results.push({ competitorKey: scraper.competitorKey, ok: true, count, pruned });
    } catch (error) {
      results.push({
        competitorKey: scraper.competitorKey,
        ok: false,
        error: error.message,
      });
    }
  }

  await recordScrapeRun(supabase, startedAt, results);

  return results;
}

/**
 * Persists this run's per-competitor outcome to `scrape_runs`/
 * `scrape_run_results` (migration `0009_add_scrape_runs.sql`) so a chain's
 * feed silently breaking is visible to the merchant-facing Competitors page
 * and to the GitHub Actions workflow, not just stdout. Best-effort — a
 * failure writing this health log shouldn't make an otherwise-successful
 * scrape run look like it failed.
 */
async function recordScrapeRun(supabase, startedAt, results) {
  try {
    const okCount = results.filter((r) => r.ok).length;
    const { data: run, error: runError } = await supabase
      .from('scrape_runs')
      .insert({
        started_at: startedAt,
        total_count: results.length,
        ok_count: okCount,
        failed_count: results.length - okCount,
      })
      .select('id')
      .single();
    if (runError) throw runError;

    const rows = results.map((r) => ({
      run_id: run.id,
      competitor_key: r.competitorKey,
      ok: r.ok,
      listing_count: r.ok ? r.count : null,
      pruned_count: r.ok ? r.pruned : null,
      error_message: r.ok ? null : r.error,
    }));
    const { error: resultsError } = await supabase.from('scrape_run_results').insert(rows);
    if (resultsError) throw resultsError;
  } catch (error) {
    console.error('Failed to record scrape run health log:', error.message);
  }
}
