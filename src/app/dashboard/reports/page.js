import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatPercent } from '@/lib/format';
import { matchConfig } from '@/lib/pipeline/match';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../../dictionaries';

// Reports: summaries, not another product list (that's the dashboard). For now
// the day's price moves at the chains and the top 5 at risk / opportunities.
// ponytail: stats over time (price index, actions taken and their outcome) come next.
const TOP = 5;
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);

function check(...results) {
  for (const res of results) {
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
  }
}

export default async function ReportsPage() {
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.reports;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login?next=/dashboard/reports');

  const { activeDays } = matchConfig();
  const top = (status) =>
    supabase
      .rpc('product_overview', { active_days: activeDays })
      .select('id, name, gap_ratio')
      .eq('price_status', status)
      .order('urgency', { ascending: false, nullsFirst: false })
      .limit(TOP);

  const [movesRes, riskRes, oppRes] = await Promise.all([
    supabase.rpc('price_moves').select('kind'),
    top('at-risk'),
    top('opportunity'),
  ]);
  check(movesRes, riskRes, oppRes);

  const moves = movesRes.data.length;
  const undercut = movesRes.data.filter((m) => m.kind === 'undercut').length;

  return (
    <section className="dash">
      <header className="dash__head">
        <div className="dash__title">
          <h1>{t.title}</h1>
          <p className="muted">{t.intro}</p>
        </div>
      </header>

      <p className="dash__moves dash__moves--static" data-urgent={undercut > 0 || undefined}>
        {moves > 0 ? fill(dict.dashboard.movesToday, { n: moves }) : t.noMoves}
        {undercut > 0 && <strong>{fill(dict.dashboard.movesUndercut, { n: undercut })}</strong>}
      </p>

      <div className="reports">
        {[
          ['at-risk', t.topRisk, riskRes.data, t.noneRisk],
          ['opportunity', t.topOpportunity, oppRes.data, t.noneOpportunity],
        ].map(([status, title, rows, empty]) => (
          <article key={status} className="card report" data-status={status}>
            <h2>{title}</h2>
            {rows.length ? (
              <ol>
                {rows.map((r) => (
                  <li key={r.id}>
                    <Link href={`/dashboard/products/${r.id}`}>{r.name}</Link>
                    <strong>{formatPercent(Number(r.gap_ratio), lang)}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">{empty}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
