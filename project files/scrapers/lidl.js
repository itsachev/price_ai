import ExcelJS from 'exceljs';
import { fetchArrayBuffer, normalizeKzpRows, upsertListings } from './shared.js';

export const competitorKey = 'lidl';

// Published under Bulgaria's KZP price-transparency mandate (see
// normalizeKzpRows in shared.js), split across two files with *different column
// layouts*: ExportFirstList is the standard export ("наименование" / "цена" /
// "цена в промоция"), ExportSecondList the richer variant ("име на продукта" /
// "референтна цена" / "текуща намалена цена" plus "марка" and "нетно
// количество"). Each file is therefore normalized against its own header.
const FEED_URLS = [
  'https://www.lidl.bg/explore/assets/webPriceData/bg/ExportFirstList.xlsx',
  'https://www.lidl.bg/explore/assets/webPriceData/bg/ExportSecondList.xlsx',
];

async function readSheetRows(url) {
  const buffer = Buffer.from(await fetchArrayBuffer(url));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];

  const rows = [];
  worksheet.eachRow((row) => {
    const values = row.values; // sparse 1-indexed array; index 0 is unused
    const cells = [];
    for (let i = 1; i < values.length; i++) {
      const v = values[i];
      cells.push(v === null || v === undefined ? '' : String(v));
    }
    rows.push(cells);
  });
  return rows;
}

export async function scrape(supabase) {
  const byCode = new Map();

  for (const url of FEED_URLS) {
    const [header, ...dataRows] = await readSheetRows(url);
    for (const row of normalizeKzpRows(header, dataRows, { sourceUrl: url })) {
      // First file wins on overlap — same product code, one national price.
      if (!byCode.has(row.external_id)) byCode.set(row.external_id, row);
    }
  }

  return upsertListings(supabase, competitorKey, [...byCode.values()]);
}
