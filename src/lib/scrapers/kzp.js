/**
 * KZP "Колко струва" open data: one daily ZIP with one CSV per obligated chain,
 * named `<display name>_<EIK>.csv`. The EIK (company number) is the stable key;
 * display names drift. Columns, in fixed order: EKATTE, store, product name,
 * product code, KZP category, retail price, promo price. One row per product
 * per store. See `project files/data_sources_research.md`.
 */
import JSZip from 'jszip';

const zipUrl = (date) => `https://kolkostruva.bg/opendata_files/${date}.zip`;

let zipPromise = null;

/** The newest ZIP (published with a lag of a day or more), fetched once per process. */
export function loadZip() {
  zipPromise ??= fetchZip().catch((error) => {
    zipPromise = null;
    throw error;
  });
  return zipPromise;
}

async function fetchZip() {
  let lastError;
  for (let n = 1; n <= 4; n++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    const date = d.toISOString().slice(0, 10);
    try {
      const res = await fetch(zipUrl(date));
      if (!res.ok) throw new Error(`${res.status}`);
      return { date, zip: await JSZip.loadAsync(await res.arrayBuffer()) };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`KZP open-data ZIP not reachable for the last 4 days: ${lastError?.message}`);
}

/** Header + data rows of every CSV filed under one of `eiks` in the ZIP. */
export async function readChainCsvs(zip, eiks) {
  let rows = [];
  for (const eik of eiks) {
    const entry = zip.file(new RegExp(`_${eik}\\.csv$`))[0];
    if (!entry) throw new Error(`No CSV for EIK ${eik} in the KZP ZIP`);
    rows = rows.concat(parseCsv(await entry.async('string')).slice(1));
  }
  return rows;
}

/**
 * Lenient CSV parser. Detects `,` or `;` from the header line. Some chains
 * (Lidl) leave stray quotes inside quoted fields (`"Simid хляб ;"Енергия;""`),
 * so a quote only closes a field when a delimiter or line end follows it.
 */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const firstLine = text.slice(0, text.indexOf('\n'));
  const delim = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const ends = (ch) => ch === delim || ch === '\n' || ch === '\r' || ch === undefined;

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let fieldStart = true;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch !== '"') field += ch;
      else if (ends(text[i + 1])) inQuotes = false;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
        if (ends(text[i + 1])) inQuotes = false; // stray quote right before the closer
      } else field += ch;
      continue;
    }
    if (ch === '"' && fieldStart) {
      inQuotes = true;
      fieldStart = false;
    } else if (ch === delim) {
      row.push(field);
      field = '';
      fieldStart = true;
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      fieldStart = true;
    } else if (ch !== '\r') {
      field += ch;
      fieldStart = false;
    }
  }
  if (field || row.length) rows.push([...row, field]);
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// Prices in cents, so equal prices compare equal. A few files use a decimal comma.
function cents(raw) {
  const n = Number(String(raw ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function mode(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = null;
  for (const [v, c] of counts) {
    if (best === null || c > counts.get(best) || (c === counts.get(best) && v < best)) best = v;
  }
  return best;
}

/**
 * Collapses per-store rows into one row per product code: the typical (most
 * common) effective price, the typical regular price, min/max across stores and
 * the store count. A promo counts only when it is positive and below retail
 * (feeds write 0 for "no promo"); rows with no retail but a promo use the promo.
 */
export function aggregateRows(dataRows) {
  const byCode = new Map();
  for (const cols of dataRows) {
    const [, store, name, rawCode, rawCategory, rawRetail, rawPromo] = cols.map((c) => c?.trim());
    if (!name || !rawCode) continue;
    const retail = cents(rawRetail);
    const promo = cents(rawPromo);
    const price = promo && (!retail || promo < retail) ? promo : retail;
    if (!price) continue;

    let item = byCode.get(rawCode);
    if (!item) {
      item = { name, categories: [], prices: [], retails: [], stores: new Set() };
      byCode.set(rawCode, item);
    }
    const category = Number.parseInt(rawCategory, 10);
    if (category > 0) item.categories.push(category);
    item.prices.push(price);
    if (retail) item.retails.push(retail);
    item.stores.add(store);
  }

  return [...byCode].map(([code, item]) => {
    const price = mode(item.prices);
    const regular = mode(item.retails);
    return {
      external_id: code,
      title: item.name,
      category_code: mode(item.categories),
      price: price / 100,
      regular_price: regular && regular / 100,
      min_price: Math.min(...item.prices) / 100,
      max_price: Math.max(...item.prices) / 100,
      on_promo: regular !== null && price < regular,
      store_count: item.stores.size,
    };
  });
}
