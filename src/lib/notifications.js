import { COMPETITORS } from './config.js';
import { formatPrice } from './format.js';

// Relative imports: the daily digest script (scripts/send-digest.mjs) uses this too.
export const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);

// One notification row (0012) as a sentence in the viewer's language. `t` is dict.notifications.
export function notificationText(n, t, lang) {
  if (n.kind === 'matched') return n.count === 1 ? t.kinds.matchedOne : fill(t.kinds.matched, { n: n.count });
  return fill(t.kinds[n.kind] ?? n.kind, {
    chain: COMPETITORS[n.listing?.competitor_key] ?? n.listing?.competitor_key ?? '',
    product: n.product?.name ?? '',
    old: n.old_price == null ? '' : formatPrice(n.old_price, lang),
    new: n.new_price == null ? '' : formatPrice(n.new_price, lang),
  });
}
