import { scrapeFromKolkostruva } from './kolkostruva.js';

export const competitorKey = 'hitmax';

// Hit Max (ХИТ ХИПЕРМАРКЕТ ЕООД) submits to the KZP "Колко струва" daily
// open-data ZIP, keyed by company EIK.
export function scrape(supabase) {
  return scrapeFromKolkostruva(supabase, competitorKey, '131016929');
}
