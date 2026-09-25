// npm run scrape [key ...]: scrape all chains, or only the ones named.
// Fails only when every scraper fails, so one broken feed doesn't fail the job.
import { createAdminClient } from '../src/lib/supabase/admin.js';
import { scrapeAll, scrapers } from '../src/lib/scrapers/index.js';

const keys = process.argv.slice(2);
const unknown = keys.filter((k) => !scrapers.some((s) => s.competitorKey === k));
if (unknown.length) {
  console.error(`Unknown scraper: ${unknown.join(', ')}`);
  process.exit(1);
}

const results = await scrapeAll(createAdminClient(), keys);
for (const r of results) {
  console.log(r.ok ? `ok    ${r.competitorKey}: ${r.count}` : `FAIL  ${r.competitorKey}: ${r.error}`);
}
if (!results.some((r) => r.ok)) process.exit(1);
