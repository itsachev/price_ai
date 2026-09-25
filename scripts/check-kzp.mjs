// node scripts/check-kzp.mjs: self-check for the KZP CSV parser and aggregation.
import assert from 'node:assert/strict';
import { parseCsv, aggregateRows } from '../src/lib/scrapers/kzp.js';

// Lidl's stray quotes, escaped quotes, BOM, CRLF, `;` delimiter.
assert.deepEqual(parseCsv('﻿"a","b"\r\n"1","Simid ;"Енергия;"","x"""\r\n'), [
  ['a', 'b'],
  ['1', 'Simid ;"Енергия;"', 'x"'],
]);
assert.deepEqual(parseCsv('a;b\n"1,5";2\n'), [['a', 'b'], ['1,5', '2']]);

const rows = aggregateRows([
  ['1', 'S1', 'Мляко', '001', '6', '2.00', ''],
  ['1', 'S2', 'Мляко', '001', '6', '2.00', '1.50'],
  ['1', 'S3', 'Мляко', '001', '6', '2.00', '1.50'],
  ['1', 'S4', 'Мляко', '001', '6', '2,20', '0'],
  ['1', 'S1', 'Хляб', '002', '-1', '0', '1.10'],
  ['1', 'S1', 'Празно', '003', '6', '0', ''],
]);
assert.deepEqual(rows, [
  {
    external_id: '001', title: 'Мляко', category_code: 6, price: 1.5, regular_price: 2,
    min_price: 1.5, max_price: 2.2, on_promo: true, store_count: 4,
  },
  {
    external_id: '002', title: 'Хляб', category_code: null, price: 1.1, regular_price: null,
    min_price: 1.1, max_price: 1.1, on_promo: false, store_count: 1,
  },
]);
console.log('kzp ok');
