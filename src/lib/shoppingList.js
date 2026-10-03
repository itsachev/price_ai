// Basket maths for the shopper's list (/info/list). Each item is a listing the
// shopper picked; its equivalents are the still-listed listings that share its
// KZP category (which encodes pack size), cheapest per chain. A listing with no
// category only counts in its own chain.
// ponytail: same category = same product, brand ignored; group by match_key if
// shoppers want brand-exact lists.

const cents = (price) => Math.round(Number(price) * 100);

/**
 * items: [{ id, quantity, listing: { id, competitor_key, category_code, title, price, on_promo } }]
 * listings: still-listed listings in those categories.
 * Returns { rows, chains, split } with totals in cents: rows hold each item's
 * offers per chain and the cheapest one; chains are sorted complete-first, then
 * by total; split buys every item where it is cheapest.
 */
export function planList(items, listings) {
  const byCategory = new Map();
  for (const l of listings) {
    if (l.category_code == null) continue;
    const chains = byCategory.get(l.category_code) ?? new Map();
    const seen = chains.get(l.competitor_key);
    if (!seen || cents(l.price) < cents(seen.price)) chains.set(l.competitor_key, l);
    byCategory.set(l.category_code, chains);
  }

  const rows = items.map((item) => {
    const own = item.listing;
    const offers = new Map(byCategory.get(own.category_code) ?? []);
    // The picked listing always counts, even if it dropped out of the active window.
    const same = offers.get(own.competitor_key);
    if (!same || cents(own.price) < cents(same.price)) offers.set(own.competitor_key, own);
    let best = null;
    for (const o of offers.values()) if (!best || cents(o.price) < cents(best.price)) best = o;
    return { item, offers, best };
  });

  const keys = new Set(rows.flatMap((r) => [...r.offers.keys()]));
  const chains = [...keys].map((key) => {
    let total = 0;
    let missing = 0;
    for (const { item, offers } of rows) {
      const o = offers.get(key);
      if (o) total += cents(o.price) * item.quantity;
      else missing += 1;
    }
    return { key, total, missing };
  }).sort((a, b) => a.missing - b.missing || a.total - b.total);

  const split = {
    total: rows.reduce((sum, r) => sum + cents(r.best.price) * r.item.quantity, 0),
    stores: new Set(rows.map((r) => r.best.competitor_key)).size,
  };
  return { rows, chains, split };
}

// Listings seen within the last `days` count as still listed.
export const activeSince = (days) => new Date(Date.now() - days * 864e5).toISOString();
