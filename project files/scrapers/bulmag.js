import { scrapeFromKolkostruva } from './kolkostruva.js';

export const competitorKey = 'bulmag';

// BulMag (ТРЪНЧЕВ ООД, mainly NE Bulgaria) submits to the KZP "Колко струва"
// daily open-data ZIP, keyed by company EIK.
export function scrape(supabase) {
  return scrapeFromKolkostruva(supabase, competitorKey, '127585839');
}
