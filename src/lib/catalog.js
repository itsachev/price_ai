// Merchant catalog input: one product from a form or a CSV row, validated the
// same way. Plain functions (no Supabase) so scripts/check-catalog.mjs can test them.
import { parseCsv } from './scrapers/kzp.js';

// Header names we accept per field, compared lowercased and trimmed.
// Spreadsheet exports use whatever the merchant typed, so allow en and bg words.
const HEADERS = {
  name: ['name', 'product', 'title', 'име', 'наименование', 'продукт'],
  brand: ['brand', 'марка', 'бранд', 'производител'],
  size: ['size', 'pack', 'quantity', 'разфасовка', 'грамаж', 'количество', 'опаковка'],
  sku: ['sku', 'code', 'barcode', 'ean', 'код', 'баркод'],
  price: ['price', 'цена', 'продажна цена'],
  cost: ['cost', 'cost price', 'purchase price', 'доставна цена', 'доставна', 'себестойност'],
};

// "1,79", "1.79", "€ 1,79", "1 234,50" → number, or NaN.
export function parsePrice(value) {
  let s = String(value ?? '').replace(/[€\s ]|eur/gi, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(s) ? Math.round(Number(s) * 100) / 100 : NaN;
}

const text = (value, max) => String(value ?? '').trim().slice(0, max) || null;

// Returns { product } or { error } with a key from dict.products.errors.
export function toProduct(input) {
  const name = text(input.name, 200);
  if (!name) return { error: 'name' };
  const price = parsePrice(input.price);
  if (!(price > 0) || price >= 1e8) return { error: 'price' };
  // Cost is optional; blank means unknown, not zero.
  const cost = String(input.cost ?? '').trim() ? parsePrice(input.cost) : null;
  if (cost != null && !(cost >= 0 && cost < 1e8)) return { error: 'cost' };
  return {
    product: {
      name,
      brand: text(input.brand, 100),
      size: text(input.size, 50),
      sku: text(input.sku, 64),
      price,
      cost,
    },
  };
}

// Excel in Bulgaria often saves CSV as Windows-1251, not UTF-8.
export function decodeCsv(buffer) {
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  return utf8.includes('�') ? new TextDecoder('windows-1251').decode(buffer) : utf8;
}

// CSV text → { products, errors: [{ row, error }], missing: [fields] }.
// Row numbers are the spreadsheet's (header = row 1).
export function parseCatalogCsv(csv) {
  const [header = [], ...rows] = parseCsv(csv);
  const cols = Object.fromEntries(
    Object.entries(HEADERS).map(([field, names]) => [field, header.findIndex((h) => names.includes(h.trim().toLowerCase()))]),
  );
  const missing = ['name', 'price'].filter((f) => cols[f] < 0);
  if (missing.length) return { products: [], errors: [], missing };

  // The same product twice in one file (by SKU, else by name, brand and size): last row wins.
  const products = new Map();
  const errors = [];
  rows.forEach((cells, i) => {
    const input = Object.fromEntries(Object.entries(cols).map(([field, c]) => [field, c < 0 ? null : cells[c]]));
    const { product, error } = toProduct(input);
    if (error) return errors.push({ row: i + 2, error });
    const key = product.sku ?? [product.name, product.brand, product.size].join('|').toLowerCase();
    products.delete(key);
    products.set(key, product);
  });
  return { products: [...products.values()], errors, missing };
}
