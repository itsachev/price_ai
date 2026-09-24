import { scrapeFromKolkostruva } from './kolkostruva.js';

export const competitorKey = 'metro';

// METRO's catalog site is membership-gated, but its чл. 55б prices are public in
// the KZP "Колко струва" daily open-data ZIP, keyed by company EIK
// (Метро България).
export function scrape(supabase) {
  return scrapeFromKolkostruva(supabase, competitorKey, '121644736');
}
