// npm run scrape [key ...]: scrape all chains, or only the ones named, then
// rebuild the shopper insights /info reads (shopper_prices, chain_price_index).
// Fails only when every scraper fails, so one broken feed doesn't fail the job.
import { createAdminClient } from '../src/lib/supabase/admin.js';
import { matchConfig } from '../src/lib/pipeline/match.js';
import { scrapeAll, scrapers } from '../src/lib/scrapers/index.js';

const keys = process.argv.slice(2);
const unknown = keys.filter((k) => !scrapers.some((s) => s.competitorKey === k));
if (unknown.length) {
  console.error(`Unknown scraper: ${unknown.join(', ')}`);
  process.exit(1);
}

const supabase = createAdminClient();
const results = await scrapeAll(supabase, keys);
for (const r of results) {
  console.log(r.ok ? `ok    ${r.competitorKey}: ${r.count}` : `FAIL  ${r.competitorKey}: ${r.error}`);
}
if (!results.some((r) => r.ok)) process.exit(1);

const { data, error } = await supabase.rpc('refresh_shopper_insights', { active_days: matchConfig().activeDays });
if (error) throw new Error(`refresh_shopper_insights: ${error.code} ${error.message}`, { cause: error });
console.log(`shopper insights: ${data} listings`);
