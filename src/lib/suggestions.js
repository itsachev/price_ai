import { matchConfig, priceStatus, suggestPrice } from '@/lib/pipeline/match';

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
    supabase.from('products').select('id, cost').in('price_status', OPEN).not('cost', 'is', null),
  ]);
  for (const res of [rows, costRes]) {
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
  }
  const costs = new Map(costRes.data.map((c) => [c.id, Number(c.cost)]));
  return rows.data.flatMap((r) => {
    const price = Number(r.price);
    const best = Number(r.best_price);
    const cost = costs.get(r.id) ?? null;
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
      cost,
      // What the product's status becomes once the suggestion is applied.
      next: priceStatus(s.price, [best], priceTolerance),
    }];
  });
}

// The merchant's pricing rules (0013) as numbers; a missing row means no rules.
export async function loadRules(supabase) {
  const { data, error } = await supabase.from('pricing_rules').select('min_margin, undercut, max_change').maybeSingle();
  if (error) throw new Error(`${error.code}: ${error.message}`, { cause: error });
  const num = (v) => (v == null ? null : Number(v));
  return { minMargin: num(data?.min_margin), undercut: num(data?.undercut) ?? 0, maxChange: num(data?.max_change) };
}
