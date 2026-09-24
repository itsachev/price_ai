import { scrapeFromKolkostruva } from './kolkostruva.js';

export const competitorKey = 'billa';

// BILLA publishes no machine-readable feed on billa.bg; its чл. 55б data comes
// from the KZP "Колко струва" daily open-data ZIP, keyed by company EIK
// (Билла България ЕООД).
export function scrape(supabase) {
  return scrapeFromKolkostruva(supabase, competitorKey, '130007884');
}
