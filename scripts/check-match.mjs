// node scripts/check-match.mjs: self-check for match narrowing and price status.
import assert from 'node:assert/strict';
import { analyze, parseSize, translit, matchKey, buildIndex, findCandidates, priceStatus, suggestPrice } from '../src/lib/pipeline/match.js';

assert.equal(translit('Верея 3,5%'), 'vereya 3.5%');
assert.deepEqual(parseSize(translit('ОЛИО 1 Л РЕТ')), { unit: 'ml', amount: 1000 });
assert.deepEqual(parseSize(translit('Вода 6х1,5л')), { unit: 'ml', amount: 9000 });
assert.deepEqual(parseSize(translit('Сирене 400 гр.')), { unit: 'g', amount: 400 });
assert.equal(parseSize('mlyako 3%'), null);
assert.deepEqual([...analyze('Vereya Прясно мляко 3,6%, 1л').tokens], ['vereya', 'pryasno', 'mlyako', '3.6%']);
assert.equal(matchKey({ name: 'Прясно мляко Верея 3%', size: '1 л' }), matchKey({ name: 'VEREYA pryasno mlyako 3% 1l' }));

const listings = [
  { id: 1, competitor_key: 'lidl', title: 'Vereya Прясно мляко 3%', category_code: 6 },
  { id: 2, competitor_key: 'kaufland', title: 'Верея Прясно мляко 3% 1л', category_code: 6 },
  { id: 3, competitor_key: 'kaufland', title: 'Верея Прясно мляко 3% 2л', category_code: 6 },
  { id: 4, competitor_key: 'kaufland', title: 'Балкан Прясно мляко 3% 1л', category_code: 6 },
  { id: 5, competitor_key: 'kaufland', title: 'Олио Верея 1л', category_code: 42 },
  { id: 6, competitor_key: 'fantastico', title: 'ОЛИО СЛЪНЧОГЛЕДОВО БИСЕР 1 Л', category_code: 42 },
];
const ids = (p, cfg = {}) =>
  findCandidates(p, buildIndex(listings), { candidatesPerChain: 3, minScore: 0.35, ...cfg }).map((c) => c.listing.id).sort();
// 2l dropped by size, oil by category; with one per chain the brand match wins.
assert.deepEqual(ids({ name: 'Прясно мляко Верея 3% 1л', category_code: 6 }), [1, 2, 4]);
assert.deepEqual(ids({ name: 'Прясно мляко Верея 3% 1л', category_code: 6 }, { candidatesPerChain: 1 }), [1, 2]);
assert.deepEqual(ids({ name: 'Кафе Нескафе' }), []);

assert.equal(priceStatus(2, [], 0.03), 'unmatched');
assert.equal(priceStatus(2, [2.01, 2.5], 0.03), 'competitive');
assert.equal(priceStatus(2.2, [2.0, 2.5], 0.03), 'at-risk');
assert.equal(priceStatus(1.8, [2.0, 2.5], 0.03), 'opportunity');
assert.equal(suggestPrice(2.2, 2.0, 0.03), 2.0, 'at risk: match the cheapest');
assert.equal(suggestPrice(1.8, 2.0, 0.03), 1.99, 'opportunity: a cent under the cheapest');
assert.equal(suggestPrice(2, 2.01, 0.03), null, 'competitive');
assert.equal(suggestPrice(2, null, 0.03), null, 'unmatched');
console.log('match ok');

// splitSize: a listing title becomes the merchant's name + size fields.
{
  const { splitSize } = await import('../src/lib/pipeline/match.js');
  const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`splitSize: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
  eq(splitSize('Хляб EXTRA LINE типов 500г'), { name: 'Хляб EXTRA LINE типов', size: '500г' });
  eq(splitSize('Мляко 3% 1,5 л Верея'), { name: 'Мляко 3% Верея', size: '1,5л' });
  eq(splitSize('Бира 6 x 500 мл'), { name: 'Бира', size: '6x500мл' });
  eq(splitSize('Банани'), { name: 'Банани', size: null });
  console.log('splitSize ok');
}
