import Link from 'next/link';
import { redirect } from 'next/navigation';
import PriceTrend from '@/components/PriceTrend';
import StatusMix from '@/components/StatusMix';
import { formatPercent } from '@/lib/format';
import { matchConfig } from '@/lib/pipeline/match';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../../dictionaries';

// Reports: how the catalog does over time, plus short summaries that point back
// to the dashboard (price moves, top 5 at risk / opportunities). Trends read the
// daily merchant_snapshots the match job writes, never recomputed history.
const TOP = 5;
// Price index chart: one point a week, back this many weeks from the newest snapshot.
const TREND_WEEKS = 26;
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
      // RPC order() runs on the selected columns, so urgency has to be in the select.
      .select('id, name, gap_ratio, urgency')
      .eq('price_status', status)
      .order('urgency', { ascending: false, nullsFirst: false })
      .limit(TOP);

  const [movesRes, riskRes, oppRes, snapRes] = await Promise.all([
    supabase.rpc('price_moves').select('kind'),
    top('at-risk'),
    top('opportunity'),
    supabase
      .from('merchant_snapshots')
      .select('data_date, price_index, at_risk, opportunity, competitive, unmatched')
      .order('data_date', { ascending: false })
      .limit(TREND_WEEKS * 7),
  ]);
  check(movesRes, riskRes, oppRes, snapRes);

  const moves = movesRes.data.length;
  const undercut = movesRes.data.filter((m) => m.kind === 'undercut').length;

  // Newest snapshot of each 7-day bucket counted back from the newest one, so a
  // day the job skipped only shifts that week's point.
  const weekly = new Map();
  const newest = snapRes.data[0] && Date.parse(snapRes.data[0].data_date);
  for (const s of snapRes.data) {
    const week = Math.floor((newest - Date.parse(s.data_date)) / (7 * 864e5));
    if (week < TREND_WEEKS && !weekly.has(week)) weekly.set(week, s);
  }
  const points = [...weekly.values()].reverse();
  const indexPoints = points.filter((s) => s.price_index != null);
  const index = indexPoints.map((s) => Number(s.price_index));
  const mix = points.map((s) => ({ 'at-risk': s.at_risk, opportunity: s.opportunity, competitive: s.competitive, unmatched: s.unmatched }));
  const date = (value, opts) => new Intl.DateTimeFormat(lang === 'bg' ? 'bg-BG' : 'en-GB', opts).format(new Date(value));
  // Month name under the first point of each month.
  const monthLabels = (list) => list.map((s, i) =>
    i === 0 || s.data_date.slice(0, 7) !== list[i - 1].data_date.slice(0, 7) ? date(s.data_date, { month: 'short', timeZone: 'UTC' }) : '');
  const number = (v) => new Intl.NumberFormat(lang === 'bg' ? 'bg-BG' : 'en-IE', { maximumFractionDigits: 1 }).format(v);

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

      {index.length > 1 ? (
        <PriceTrend
          t={t.index}
          yours={index}
          market={index.map(() => 100)}
          xLabels={monthLabels(indexPoints)}
          money={number}
          pct={(v) => formatPercent(v, lang)}
        />
      ) : (
        index.length === 1 && <p className="muted">{fill(t.indexStarting, { index: number(index[0]) })}</p>
      )}

      {mix.length > 1 && (
        <StatusMix
          t={t.mix}
          names={dict.status}
          weeks={mix}
          xLabels={monthLabels(points)}
          start={date(points[0].data_date, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
          pct={(v) => formatPercent(v, lang)}
          share={(v) => formatPercent(v, lang, 'auto')}
        />
      )}

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
