import Link from 'next/link';
import { redirect } from 'next/navigation';
import PriceTrend from '@/components/PriceTrend';
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
// "Your price changes": the merchant's own changes over this many days.
const CHANGE_DAYS = 30;
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);

function check(...results) {
  for (const res of results) {
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
  }
}

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.nav.reports };
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

  const [movesRes, riskRes, oppRes, snapRes, changesRes] = await Promise.all([
    supabase.rpc('price_moves').select('kind'),
    top('at-risk'),
    top('opportunity'),
    supabase
      .from('merchant_snapshots')
      .select('data_date, price_index')
      .order('data_date', { ascending: false })
      .limit(TREND_WEEKS * 7),
    supabase.rpc('price_change_summary', { period_days: CHANGE_DAYS }),
  ]);
  check(movesRes, riskRes, oppRes, snapRes, changesRes);

  // Price changes per source, and rises / cuts over all sources (averages weighted by count).
  const bySource = Object.fromEntries(changesRes.data.map((r) => [r.source, r]));
  const sum = (key) => changesRes.data.reduce((n, r) => n + r[key], 0);
  const weighted = (avg, count) => sum(count) && changesRes.data.reduce((n, r) => n + Number(r[avg] ?? 0) * r[count], 0) / sum(count);
  const applied = bySource.apply;
  const changes = {
    total: sum('changes'),
    rises: sum('rises'),
    cuts: sum('cuts'),
    avgRise: weighted('avg_rise', 'rises'),
    avgCut: weighted('avg_cut', 'cuts'),
  };

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

      <section className="stack" aria-labelledby="rp-changes">
        <div>
          <h2 id="rp-changes">{fill(t.changes.title, { days: CHANGE_DAYS })}</h2>
          <p className="muted">
            {changes.total
              ? fill(t.changes.bySource, Object.fromEntries(['apply', 'manual', 'csv'].map((s) => [s, bySource[s]?.changes ?? 0])))
              : fill(t.changes.none, { days: CHANGE_DAYS })}
          </p>
        </div>
        {changes.total > 0 && (
          <dl className="stat-grid">
            <div>
              <dt>{t.changes.applied}</dt>
              <dd>{applied?.changes ?? 0}</dd>
              <small>{applied ? fill(t.changes.competitiveNow, { n: applied.competitive_now, of: applied.products }) : t.changes.noneApplied}</small>
            </div>
            <div>
              <dt>{t.changes.rises}</dt>
              <dd>{changes.rises}</dd>
              {changes.rises > 0 && <small>{fill(t.changes.average, { pct: formatPercent(changes.avgRise, lang) })}</small>}
            </div>
            <div>
              <dt>{t.changes.cuts}</dt>
              <dd>{changes.cuts}</dd>
              {changes.cuts > 0 && <small>{fill(t.changes.average, { pct: formatPercent(changes.avgCut, lang) })}</small>}
            </div>
          </dl>
        )}
      </section>

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
