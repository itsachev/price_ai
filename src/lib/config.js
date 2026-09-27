// Canonical competitor keys — must match the scrapers' `competitorKey`, the
// `competitors` table and `project files/markets_information.md`.
export const COMPETITORS = {
  kaufland: 'Kaufland',
  lidl: 'Lidl',
  billa: 'BILLA',
  fantastico: 'Fantastico',
  tmarket: 'T Market',
  metro: 'METRO',
  hitmax: 'Hit Max',
  bulmag: 'BulMag',
  kammarket: 'KAM Market',
  berezka: 'Berezka',
};

export const LOCALES = ['en', 'bg'];
export const DEFAULT_LOCALE = 'bg';

export const PRICE_STATUSES = ['competitive', 'opportunity', 'at-risk', 'unmatched'];

// Absolute origin for canonical URLs, the sitemap and Open Graph images.
// Set NEXT_PUBLIC_SITE_URL in production; Vercel's production domain is the fallback.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  'http://localhost:3000';
