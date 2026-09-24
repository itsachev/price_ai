import { scrapeFromKolkostruva } from './kolkostruva.js';

export const competitorKey = 'berezka';

// Berezka (БЕРЬОЗКА - БЪЛГАРИЯ ЕООД, Eastern-European specialty grocery) submits
// to the KZP "Колко струва" daily open-data ZIP, keyed by company EIK. Its
// assortment skews to imported goods that may not map cleanly onto a Bulgarian
// merchant's catalog — lowest matching priority.
export function scrape(supabase) {
  return scrapeFromKolkostruva(supabase, competitorKey, '201029124');
}
