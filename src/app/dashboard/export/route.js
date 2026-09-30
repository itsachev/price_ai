import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const DEFAULT_DAYS = 7;
const COLUMNS = ['name', 'brand', 'size', 'sku', 'price', 'cost', 'changed'];

// Same layout as the import template (";" and decimal comma, so Bulgarian Excel
// opens it as is), so the file loads into a POS or back into PriceAI. Text that
// starts like a formula gets a leading ' so a spreadsheet shows it rather than
// runs it (CSV injection through a product name).
const cell = (value) => {
  let s = typeof value === 'number' ? value.toFixed(2).replace('.', ',') : String(value ?? '');
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

// GET /dashboard/export?since=YYYY-MM-DD: the products whose price changed in
// PriceAI since that day (applied or edited, not CSV imports, which came from
// the merchant's own system), with today's price. RLS scopes it to the caller.
export async function GET(request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect('/login?next=/dashboard');

  const param = new URL(request.url).searchParams.get('since') ?? '';
  const since = /^\d{4}-\d{2}-\d{2}$/.test(param) && !Number.isNaN(Date.parse(param))
    ? param
    : new Date(Date.now() - DEFAULT_DAYS * 86_400_000).toISOString().slice(0, 10);

  // ponytail: PostgREST returns at most max-rows (1000 by default); page through when one export spans more changes.
  const history = await supabase
    .from('product_price_history')
    .select('product_id, recorded_at')
    .gte('recorded_at', since)
    .neq('source', 'csv')
    .order('recorded_at', { ascending: false });
  if (history.error) throw new Error(`${history.error.code}: ${history.error.message}`, { cause: history.error });

  // Newest change per product (rows come newest first).
  const changed = new Map();
  for (const h of history.data) if (!changed.has(h.product_id)) changed.set(h.product_id, h.recorded_at.slice(0, 10));

  let products = [];
  if (changed.size) {
    const res = await supabase
      .from('products')
      .select('id, name, brand, size, sku, price, cost')
      .in('id', [...changed.keys()])
      .order('name');
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
    products = res.data;
  }

  const lines = [
    COLUMNS.join(';'),
    ...products.map((p) =>
      [p.name, p.brand, p.size, p.sku, Number(p.price), p.cost == null ? '' : Number(p.cost), changed.get(p.id)].map(cell).join(';'),
    ),
  ];
  // BOM so Excel reads the Cyrillic as UTF-8.
  return new Response(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="priceai-prices-since-${since}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
