import { scrapeFromKolkostruva } from './kolkostruva.js';

export const competitorKey = 'kammarket';

// KAM Market (КAM 2014 ЕООД) submits to the KZP "Колко струва" daily open-data
// ZIP, keyed by company EIK.
export function scrape(supabase) {
  return scrapeFromKolkostruva(supabase, competitorKey, '202923636');
}
