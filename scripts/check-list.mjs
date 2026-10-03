// node scripts/check-list.mjs: self-check for the shopper's basket maths.
import assert from 'node:assert/strict';
import { planList } from '../src/lib/shoppingList.js';

const l = (id, competitor_key, category_code, price) => ({ id, competitor_key, category_code, price, title: `#${id}` });
const milkLidl = l(1, 'lidl', 10, '1.19');
const breadKauf = l(2, 'kaufland', 20, '0.99');
const soapBilla = l(3, 'billa', null, '2.50');
const active = [
  milkLidl, l(4, 'kaufland', 10, '1.09'), l(5, 'kaufland', 10, '1.29'), l(6, 'billa', 10, '1.39'),
  breadKauf, l(7, 'lidl', 20, '0.89'),
];
const items = [
  { id: 1, quantity: 2, listing: milkLidl },
  { id: 2, quantity: 1, listing: breadKauf },
  { id: 3, quantity: 1, listing: soapBilla },
];

const { rows, chains, split } = planList(items, active);
assert.equal(rows[0].best.id, 4, 'cheapest equivalent milk is Kaufland 1.09');
assert.equal(rows[0].offers.get('kaufland').id, 4, 'cheapest per chain');
assert.equal(rows[1].best.id, 7);
assert.equal(rows[2].offers.size, 1, 'no category: own chain only');
// kaufland: 2*1.09 + 0.99 = 3.17, missing soap; lidl: 2*1.19 + 0.89 = 3.27; billa: 2*1.39 + 2.50 = 5.28, missing bread
assert.deepEqual(chains.map((c) => [c.key, c.total, c.missing]), [['kaufland', 317, 1], ['lidl', 327, 1], ['billa', 528, 1]]);
assert.equal(chains[0].gaps.length, 1);
// split: 2*1.09 + 0.89 + 2.50 = 5.57 across 3 chains
assert.deepEqual(split, { total: 557, stores: 3 });
assert.deepEqual(planList([], []), { rows: [], chains: [], split: { total: 0, stores: 0 } });
console.log('check-list ok');
