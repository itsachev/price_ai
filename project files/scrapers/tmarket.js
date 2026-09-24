import { scrapeFromKolkostruva } from './kolkostruva.js';

export const competitorKey = 'tmarket';

// T-Market's own CloudCart feed (ftp.cloudcart.com/tmarket_kzp/viewer.php)
// 403s GitHub Actions runners, so it comes from the KZP "Колко струва" daily
// open-data ZIP instead, keyed by company EIK (Максима България ЕООД). The ZIP's
// CSV is row-for-row identical to that feed, with the same product codes.
export function scrape(supabase) {
  return scrapeFromKolkostruva(supabase, competitorKey, '131324923');
}
