// npm run seed-history -- <email> [--clean]
// Test data for the price trend chart and the Reports feed: 10 products for the
// given account, each linked to 2-3 real competitor listings of one KZP
// category, plus ~4 months of made-up daily competitor prices and merchant
// price changes before the newest real feed date. The last fake day is set up
// so the newest real day produces every kind of price move.
// It also writes a daily merchant snapshot per fake day (over the 10 test
// products only), so the Reports price index chart has months to show.
// Everything it writes is marked, so --clean removes exactly that: products by
// the DEMO- SKU prefix (their history and links cascade), competitor history and
// snapshots by the FAKE_CAPTURED sentinel. Real listings, history and snapshots
// are never touched.
import { createAdminClient } from '../src/lib/supabase/admin.js';
import { matchConfig, matchKey, priceStatus } from '../src/lib/pipeline/match.js';

const PRODUCTS = 10;
const DAYS = 120;
const SKU = 'DEMO-';
const FAKE_CAPTURED = '2000-01-01T00:00:00Z';
const SCENARIOS = ['undercut', 'raised-above', 'undercut', 'raised-above', 'calm', 'calm', 'calm', 'calm', 'calm', 'calm'];

const [email] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const clean = process.argv.includes('--clean');
if (!email) {
  console.error('usage: npm run seed-history -- <email> [--clean]');
  process.exit(1);
}

const supabase = createAdminClient();
const must = ({ data, error }) => {
  if (error) throw new Error(error.message, { cause: error });
  return data;
};

const { users } = must(await supabase.auth.admin.listUsers());
const user = users.find((u) => u.email === email);
if (!user) throw new Error(`no account ${email}`);

// Clean first either way, so a rerun replaces the old test data instead of stacking.
must(await supabase.from('products').delete().eq('owner_id', user.id).like('sku', `${SKU}%`));
must(await supabase.from('competitor_listing_price_history').delete().eq('captured_at', FAKE_CAPTURED));
must(await supabase.from('merchant_snapshots').delete().eq('owner_id', user.id).eq('created_at', FAKE_CAPTURED));
console.log('Removed earlier test data');
if (clean) process.exit(0);

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const cents = (v) => Math.max(0.05, Math.round(v * 100) / 100);
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(([, v]) => v);
const day = (iso, offset) => new Date(Date.parse(iso) + offset * 864e5).toISOString().slice(0, 10);

// Newest real feed date: fake history ends the day before, so the dashboard's
// "prices as of" date and future scrapes are unaffected.
const [{ data_date: newest }] = must(
  await supabase.from('competitor_listing_price_history').select('data_date').order('data_date', { ascending: false }).limit(1)
);

// Listings from the newest feed, grouped by KZP category (product type and pack size).
const listings = [];
for (let from = 0; ; from += 1000) {
  const page = must(
    await supabase
      .from('competitor_listing_price_history')
      .select('price, on_promo, store_count, listing:competitor_listings!inner(id, competitor_key, title, brand, size, category_code)')
      .eq('data_date', newest)
      .not('listing.category_code', 'is', null)
      .order('listing_id')
      .range(from, from + 999)
  );
  listings.push(...page);
  if (page.length < 1000) break;
}
const byCategory = Map.groupBy(listings, (h) => h.listing.category_code);
// One listing per chain, up to 3 chains, priced within 25% of each other, so
// they look like the same product (a category mixes cheap and premium ones).
function pick(rows) {
  for (const anchor of shuffle(rows)) {
    const near = rows.filter((r) =>
      r.listing.competitor_key !== anchor.listing.competitor_key && Math.abs(r.price / anchor.price - 1) <= 0.25);
    const picked = [anchor, ...new Map(shuffle(near).map((r) => [r.listing.competitor_key, r])).values()].slice(0, 3);
    if (picked.length >= 2) return picked;
  }
  return null;
}
const categories = shuffle([...byCategory.values()]).map(pick).filter(Boolean).slice(0, PRODUCTS);
if (categories.length < PRODUCTS) throw new Error(`only ${categories.length} categories sold by 2+ chains at similar prices`);

const { priceTolerance } = matchConfig();
const history = [];
const ownHistory = [];
const seeded = []; // { listingIds, own } per product, for the snapshots

for (const [i, picked] of categories.entries()) {
  const cheapest = picked.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a));
  const low = Number(cheapest.price);
  const scenario = SCENARIOS[i];

  // Merchant price chosen so the newest real day crosses it as the scenario needs.
  const price = cents(scenario === 'undercut' ? low * 1.06 : scenario === 'raised-above' ? low * 0.96 : low * rand(0.95, 1.05));
  const { title, brand, size, category_code } = picked[0].listing;
  const product = { owner_id: user.id, name: title, brand, size, category_code, price, sku: `${SKU}${i + 1}` };
  const [row] = must(
    await supabase
      .from('products')
      .insert({ ...product, match_key: matchKey(product), price_status: priceStatus(price, [low], priceTolerance) })
      .select('id')
  );
  must(await supabase.from('product_links').insert(picked.map((r) => ({ product_id: row.id, listing_id: r.listing.id }))));

  // The merchant's own price: a few rises over the months, ending at today's price.
  // Every other product's latest change came from an applied suggestion (Reports' price changes).
  const own = [[DAYS, 0.9], [80, 0.94], [45, 0.97], [15, 1]].map(([ago, factor]) => ({
    product_id: row.id,
    price: cents(price * factor * rand(0.99, 1.01)),
    recorded_at: `${day(newest, -ago)}T09:00:00Z`,
    source: ago === 15 && i % 2 === 0 ? 'apply' : 'manual',
  }));
  ownHistory.push(...own);
  seeded.push({ listingIds: picked.map((r) => r.listing.id), own });

  for (const r of picked) {
    const cur = Number(r.price);
    // The day before the newest: sets up the move the newest real day shows.
    let prev;
    if (r === cheapest && scenario === 'undercut') prev = price * 1.04;
    else if (r === cheapest && scenario === 'raised-above') prev = price * 0.95;
    else prev = cur * [1, 1, 1, 0.94, 1.06][Math.floor(Math.random() * 5)];
    prev = cents(prev);

    // Walk back from there: prices drift up over time (so older is cheaper),
    // with the odd 7-day promo about 20% off.
    let base = prev;
    let promoLeft = 0;
    for (let ago = 1; ago <= DAYS; ago++) {
      if (ago > 1 && Math.random() < 0.04) base = cents(base * rand(0.95, 0.99));
      if (ago > 1 && !promoLeft && Math.random() < 0.02) promoLeft = 7;
      // Day 1 is on promo only when it was cheaper and today is not: a promo that just ended.
      const onPromo = ago === 1 ? prev < cur && !r.on_promo : promoLeft > 0;
      const regular = ago === 1 ? cur : base;
      const value = ago === 1 ? prev : onPromo ? cents(base * 0.8) : base;
      history.push({
        listing_id: r.listing.id,
        data_date: day(newest, -ago),
        price: value,
        regular_price: onPromo ? regular : null,
        min_price: value,
        max_price: value,
        on_promo: onPromo,
        store_count: r.store_count,
        captured_at: FAKE_CAPTURED,
      });
      if (promoLeft) promoLeft--;
    }
  }
  console.log(`${scenario.padEnd(12)} ${price.toFixed(2)}  ${title} (${picked.length} chains)`);
}

// Real feed days older than the newest win: fake rows for them are skipped.
// ponytail: the snapshots below still use the fake price on those few days.
for (let from = 0; from < history.length; from += 500) {
  must(await supabase.from('competitor_listing_price_history')
    .upsert(history.slice(from, from + 500), { onConflict: 'listing_id,data_date', ignoreDuplicates: true }));
}
must(await supabase.from('product_price_history').insert(ownHistory));

// Snapshots for the fake days, computed like record_snapshots but over the test
// products only. Real snapshots on the same day win (ignoreDuplicates).
const priceOn = new Map(history.map((h) => [`${h.listing_id}|${h.data_date}`, h.price]));
const snapshots = [];
for (let ago = DAYS; ago >= 1; ago--) {
  const d = day(newest, -ago);
  const counts = { 'at-risk': 0, opportunity: 0, competitive: 0, unmatched: 0 };
  let logSum = 0;
  for (const s of seeded) {
    const ownPrice = (s.own.findLast((h) => h.recorded_at.slice(0, 10) <= d) ?? s.own[0]).price;
    const prices = s.listingIds.map((id) => priceOn.get(`${id}|${d}`));
    counts[priceStatus(ownPrice, prices, priceTolerance)]++;
    logSum += Math.log(ownPrice / (prices.reduce((a, b) => a + b, 0) / prices.length));
  }
  snapshots.push({
    owner_id: user.id,
    data_date: d,
    products: seeded.length,
    at_risk: counts['at-risk'],
    opportunity: counts.opportunity,
    competitive: counts.competitive,
    unmatched: counts.unmatched,
    price_index: Math.round(10000 * Math.exp(logSum / seeded.length)) / 100,
    index_products: seeded.length,
    avg_margin: null,
    margin_products: 0,
    created_at: FAKE_CAPTURED,
  });
}
must(await supabase.from('merchant_snapshots').upsert(snapshots, { onConflict: 'owner_id,data_date', ignoreDuplicates: true }));
console.log(`Seeded ${PRODUCTS} products for ${email}, ${history.length} competitor price rows and ${snapshots.length} snapshots up to ${day(newest, -1)}`);
