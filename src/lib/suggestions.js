import { after } from 'next/server';
import { parsePrice } from '@/lib/catalog';
import { matchConfig, priceStatus, runMatch, suggestPrice } from '@/lib/pipeline/match';
import { createAdminClient } from '@/lib/supabase/admin';

const OPEN = ['at-risk', 'opportunity'];

// Every product with a suggested price (at risk or opportunity, matched), most
// urgent first, with its cost for the margin check. Shared by the dashboard's
// bulk apply dialog and the applySuggestions action, which recomputes the
// prices here rather than trusting the form. `ids` narrows it to those products.
// ponytail: PostgREST returns at most max-rows (1000 by default); page through when a catalog has more open suggestions.
export async function loadSuggestions(supabase, ids) {
  const { activeDays, priceTolerance } = matchConfig();
  let rowsQuery = supabase
    .rpc('product_overview', { active_days: activeDays })
    .in('price_status', OPEN)
    .not('match_key', 'is', null)
    .not('best_price', 'is', null)
    .order('status_rank')
    .order('urgency', { ascending: false });
  if (ids) rowsQuery = rowsQuery.in('id', ids);
  const [rules, rows, costRes] = await Promise.all([
    loadRules(supabase),
    rowsQuery,
    supabase.from('products').select('id, cost, dismissed_price').in('price_status', OPEN).or('cost.not.is.null,dismissed_price.not.is.null'),
  ]);
  for (const res of [rows, costRes]) {
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
  }
  const extras = new Map(costRes.data.map((c) => [c.id, c]));
  return rows.data.flatMap((r) => {
    const price = Number(r.price);
    const best = Number(r.best_price);
    const extra = extras.get(r.id);
    const cost = extra?.cost == null ? null : Number(extra.cost);
    const s = suggestPrice(price, best, priceTolerance, { rules, cost });
    if (!s) return [];
    return [{
      id: r.id,
      name: r.name,
      detail: [r.brand, r.size].filter(Boolean).join(' · '),
      status: r.price_status,
      price,
      best,
      competitor: r.best_competitor,
      suggested: s.price,
      limit: s.limit,
      // The margin rule left no room to move; shown on the dashboard, not applied.
      held: s.price === price,
      // The merchant said "not now" to this exact price (0014); a new price shows again.
      dismissed: extra?.dismissed_price != null && Number(extra.dismissed_price) === s.price,
      cost,
      // What the product's status becomes once the suggestion is applied.
      next: priceStatus(s.price, [best], priceTolerance, rules.undercut),
    }];
  });
}

// The merchant's pricing rules (0013) as numbers; a missing row means no rules.
// `ownerId` picks one merchant's row when the client sees them all (service role).
export async function loadRules(supabase, ownerId) {
  let q = supabase.from('pricing_rules').select('min_margin, undercut, max_change');
  if (ownerId) q = q.eq('owner_id', ownerId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`${error.code}: ${error.message}`, { cause: error });
  const num = (v) => (v == null ? null : Number(v));
  return { minMargin: num(data?.min_margin), undercut: num(data?.undercut) ?? 0, maxChange: num(data?.max_change) };
}

// Recompute statuses from the overview after a change that needs no Gemini call
// (a linked listing, a new price, a new undercut rule), so pages show it at once.
// `productId` narrows it to one product; without it, the merchant's whole catalog.
// The admin console passes the service-role client with `ownerId`, the merchant
// whose rules and catalog apply.
// ponytail: PostgREST returns at most max-rows (1000 by default); page through for bigger catalogs.
export async function refreshStatuses(supabase, productId, ownerId) {
  const { activeDays, priceTolerance } = matchConfig();
  let q = supabase.rpc('product_overview', { active_days: activeDays });
  if (productId) q = q.eq('id', productId);
  else if (ownerId) {
    const { data: ids, error: e } = await supabase.from('products').select('id').eq('owner_id', ownerId);
    if (e) throw new Error(`${e.code}: ${e.message}`, { cause: e });
    q = q.in('id', ids.map((r) => r.id));
  }
  const [{ data, error }, rules] = await Promise.all([q, loadRules(supabase, ownerId)]);
  if (error) throw new Error(`${error.code}: ${error.message}`, { cause: error });
  const changed = data.flatMap((r) => {
    const status = priceStatus(Number(r.price), r.best_price == null ? [] : [Number(r.best_price)], priceTolerance, rules.undercut);
    return status === r.price_status ? [] : [{ id: r.id, status }];
  });
  for (const [status, group] of Map.groupBy(changed, (r) => r.status)) {
    const { error: e } = await supabase.from('products').update({ price_status: status }).in('id', group.map((r) => r.id));
    if (e) throw new Error(`${e.code}: ${e.message}`, { cause: e });
  }
}

const RULE_FIELDS = ['min_margin', 'undercut', 'max_change'];
// Valid range per field as the merchant types it: percents for the ratios, euros for undercut.
const RULE_RANGE = { min_margin: [0, 95], undercut: [0, 100], max_change: [1, 100] };

// The pricing rules form (settings, or an admin editing an account) → the typed
// `values` plus either the field that's out of range as `error`, or the `row`
// to store. Blank turns a rule off.
export function parseRules(formData) {
  const values = Object.fromEntries(RULE_FIELDS.map((f) => [f, String(formData.get(f) ?? '').trim()]));
  const nums = {};
  for (const f of RULE_FIELDS) {
    if (!values[f]) {
      nums[f] = null;
      continue;
    }
    const n = parsePrice(values[f].replace('%', ''));
    const [min, max] = RULE_RANGE[f];
    if (!(n >= min && n <= max)) return { values, error: f };
    nums[f] = n;
  }
  return {
    values,
    row: {
      min_margin: nums.min_margin == null ? null : nums.min_margin / 100,
      undercut: nums.undercut ?? 0,
      max_change: nums.max_change == null ? null : nums.max_change / 100,
      updated_at: new Date().toISOString(),
    },
  };
}

// Matches one saved product against the listings already scraped, after the
// response is sent, so saving never waits on Gemini. Callers pass an id they
// were allowed to touch (through RLS, or behind requireAdmin). If the platform
// cuts the run short, the daily `npm run match` picks it up.
// ponytail: one run per save; batch through a queue if imports should match too.
export function matchInBackground(id) {
  after(() =>
    runMatch(createAdminClient(), { productIds: [id], log: () => {} })
      .then(({ stopped }) => stopped && console.warn('background match stopped', id, stopped))
      .catch((error) => console.error('background match failed', id, error)),
  );
}
