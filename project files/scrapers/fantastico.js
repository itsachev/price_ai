import { fetchText, parseCsv, normalizeKzpRows, upsertListings } from './shared.js';

export const competitorKey = 'fantastico';

// Published daily under Bulgaria's KZP price-transparency mandate (see
// normalizeKzpRows in shared.js) — the `d` query param is today's date, but
// the feed 404s without one rather than defaulting to "latest".
function feedUrl() {
  const today = new Date().toISOString().slice(0, 10);
  return `https://www.fantastico.bg/files/kzp/fantastico.csv?d=${today}`;
}

export async function scrape(supabase) {
  const sourceUrl = feedUrl();
  const csvText = await fetchText(sourceUrl);
  const [header, ...data] = parseCsv(csvText);
  const rows = normalizeKzpRows(header, data, { sourceUrl });
  return upsertListings(supabase, competitorKey, rows);
}
