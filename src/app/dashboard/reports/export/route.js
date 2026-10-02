import { redirect } from 'next/navigation';
import { cell } from '@/lib/csv';
import { matchConfig } from '@/lib/pipeline/match';
import { createClient } from '@/lib/supabase/server';

const COLUMNS = ['name', 'brand', 'size', 'sku', 'status', 'price', 'cheapest', 'cheapest_chain', 'gap_percent'];

// GET /dashboard/reports/export: every product with its status and the cheapest
// chain today, so the report can be opened in a spreadsheet. RLS scopes it to the caller.
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect('/login?next=/dashboard/reports');

  // ponytail: PostgREST returns at most max-rows (1000 by default); page through for bigger catalogs.
  const res = await supabase
    .rpc('product_overview', { active_days: matchConfig().activeDays })
    .select('name, brand, size, sku, price_status, price, best_price, best_competitor, gap_ratio')
    .order('status_rank')
    .order('name');
  if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });

  const lines = [
    COLUMNS.join(';'),
    ...res.data.map((p) =>
      [
        p.name, p.brand, p.size, p.sku, p.price_status, Number(p.price),
        p.best_price == null ? '' : Number(p.best_price), p.best_competitor,
        p.gap_ratio == null ? '' : Number(p.gap_ratio) * 100,
      ].map(cell).join(';'),
    ),
  ];
  // BOM so Excel reads the Cyrillic as UTF-8.
  return new Response(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="priceai-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
