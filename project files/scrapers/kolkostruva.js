/**
 * Shared source for the chains that publish no reachable price feed of their
 * own: the KZP "Колко струва" portal's daily open-data ZIP.
 *
 * `https://kolkostruva.bg/opendata_files/<YYYY-MM-DD>.zip` bundles one CSV per
 * obligated retailer — the standard чл. 55б columns that `normalizeKzpRows`
 * already reads. One ~18 MB download therefore covers every kolkostruva-backed
 * scraper, so the ZIP is fetched once and memoized for the lifetime of the
 * process (`scrapeAll` runs these scrapers back to back).
 *
 * Each retailer's CSV is named `<display name>_<EIK>.csv`; the EIK (company
 * registration number) is the stable key — the display name drifts.
 */
import JSZip from 'jszip';

import { fetchArrayBuffer, parseCsv, normalizeKzpRows, upsertListings } from './shared.js';

const zipUrl = (date) => `https://kolkostruva.bg/opendata_files/${date}.zip`;

let zipPromise = null;

/** Fetches + parses the most recent available open-data ZIP, once per process. */
function loadZip() {
  if (!zipPromise) zipPromise = fetchZip();
  return zipPromise;
}

async function fetchZip() {
  // Published early each morning for the previous calendar day. Walk back a few
  // days in case a run fires before that morning's file lands (or one is
  // skipped).
  const candidates = [daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4)];
  let lastError;

  for (const date of candidates) {
    try {
      const buffer = await fetchArrayBuffer(zipUrl(date));
      return { date, zip: await JSZip.loadAsync(buffer) };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `kolkostruva open-data ZIP not reachable for any of ${candidates.join(', ')}: ${lastError?.message}`,
  );
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Scrapes one retailer's slice of the daily KZP open-data ZIP into
 * `competitor_listings`. `eik` is the retailer's company registration number,
 * which suffixes its CSV filename inside the archive.
 */
export async function scrapeFromKolkostruva(supabase, competitorKey, eik) {
  const { date, zip } = await loadZip();

  const entry = zip.file(new RegExp(`_${eik}\\.csv$`))[0];
  if (!entry) {
    throw new Error(`No CSV for EIK ${eik} in the ${date} kolkostruva open-data ZIP`);
  }

  const [header, ...data] = parseCsv(await entry.async('string'));
  const rows = normalizeKzpRows(header, data, { sourceUrl: zipUrl(date) });
  return upsertListings(supabase, competitorKey, rows);
}

/** Test hook — drops the memoized ZIP so a later call re-fetches. */
export function resetZipCache() {
  zipPromise = null;
}
