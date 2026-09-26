// node scripts/check-catalog.mjs: self-check for catalog input (form fields and CSV import).
import assert from 'node:assert/strict';
import { decodeCsv, parseCatalogCsv, parsePrice, toProduct } from '../src/lib/catalog.js';

for (const [input, want] of [['1,79', 1.79], ['1.79', 1.79], ['€ 2', 2], ['1 234,50', 1234.5], ['3,456', 3.46], ['1.234,5 EUR', 1234.5]]) {
  assert.equal(parsePrice(input), want, input);
}
for (const bad of ['', 'abc', '-1', '1,2,3', null]) assert.ok(Number.isNaN(parsePrice(bad)), String(bad));

assert.deepEqual(toProduct({ name: '  ', price: '1' }), { error: 'name' });
assert.deepEqual(toProduct({ name: 'Мляко', price: '0' }), { error: 'price' });
assert.deepEqual(toProduct({ name: ' Мляко ', brand: '', size: '1 л', sku: ' 7 ', price: '1,79' }), {
  product: { name: 'Мляко', brand: null, size: '1 л', sku: '7', price: 1.79 },
});

// Excel-style Bulgarian export: BOM, semicolons, bg headers, decimal commas, a bad row, a repeated SKU.
const csv = '﻿Наименование;Марка;Код;Цена\r\nМляко;Верея;1;1,79\r\nОлио;;2;безплатно\r\nМляко нов;Верея;1;1,85\r\nЗахар;;;1,29\r\n';
const { products, errors, missing } = parseCatalogCsv(csv);
assert.deepEqual(missing, []);
assert.deepEqual(errors, [{ row: 3, error: 'price' }]);
assert.deepEqual(products, [
  { name: 'Мляко нов', brand: 'Верея', size: null, sku: '1', price: 1.85 },
  { name: 'Захар', brand: null, size: null, sku: null, price: 1.29 },
]);

assert.deepEqual(parseCatalogCsv('product,brand\nx,y\n').missing, ['price']);

// Windows-1251 bytes decode to Cyrillic; UTF-8 stays as it is.
const cp1251 = new Uint8Array([0xcc, 0xeb, 0xff, 0xea, 0xee]); // "Мляко"
assert.equal(decodeCsv(cp1251), 'Мляко');
assert.equal(decodeCsv(new TextEncoder().encode('Мляко')), 'Мляко');

console.log('catalog: ok');
