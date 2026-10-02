import Link from 'next/link';
import { redirect } from 'next/navigation';
import ButtonLabel from '@/components/ButtonLabel';
import PageMotion from '@/components/PageMotion';
import PriceTrend from '@/components/PriceTrend';
import { COMPETITORS } from '@/lib/config';
import { formatPercent, formatPrice } from '@/lib/format';
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
// "Your catalog": today's status split against the snapshot this many days earlier.
const COMPARE_DAYS = 30;
// "Money left on the table" and "held" lists: products shown, biggest raise first.
const MONEY_ROWS = 10;
// "What the chains are doing": shelf price and promo change over this many days.
const MOVE_DAYS = 30;
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

  const { activeDays, priceTolerance } = matchConfig();
  const top = (status) =>
    supabase
      .rpc('product_overview', { active_days: activeDays })
      // RPC order() runs on the selected columns, so held and urgency have to be in the select.
      .select('id, name, gap_ratio, held, urgency')
      .eq('price_status', status)
      .order('held')
      .order('urgency', { ascending: false, nullsFirst: false })
      .limit(TOP);

  const [movesRes, riskRes, oppRes, snapRes, changesRes, pressureRes, roomRes, heldRes, moveRes, staleRes] = await Promise.all([
    supabase.rpc('price_moves').select('kind'),
    top('at-risk'),
    top('opportunity'),
    supabase
      .from('merchant_snapshots')
      .select('data_date, price_index, products, at_risk, opportunity, competitive, unmatched, avg_margin, margin_products')
      .order('data_date', { ascending: false })
      .limit(TREND_WEEKS * 7),
    supabase.rpc('price_change_summary', { period_days: CHANGE_DAYS }),
    supabase.rpc('competitor_pressure', { active_days: activeDays }),
    // Every opportunity's gap (not just the top 5), for the "money left" total.
    supabase.rpc('product_overview', { active_days: activeDays }).select('id, name, price, best_price').eq('price_status', 'opportunity'),
    // At-risk products the margin rule won't let you cut (held, 0016).
    supabase.rpc('product_overview', { active_days: activeDays }).select('id, name, gap_ratio').eq('held', true).order('gap_ratio', { ascending: false }),
    supabase.rpc('chain_movement', { period_days: MOVE_DAYS }),
    supabase.rpc('stale_matches', { active_days: activeDays }).order('last_seen', { ascending: false }),
  ]);
  check(movesRes, riskRes, oppRes, snapRes, changesRes, pressureRes, roomRes, heldRes, moveRes, staleRes);

  // Raising each opportunity to the cheapest chain's price, per unit sold.
  const raises = roomRes.data
    .map((r) => ({ ...r, raise: Number(r.best_price) - Number(r.price) }))
    .filter((r) => r.raise > 0)
    .sort((a, b) => b.raise - a.raise);
  const room = raises.reduce((n, r) => n + r.raise, 0);
  const chains = pressureRes.data.toSorted((a, b) => b.cheaper - a.cheaper || b.matched - a.matched);
  const mostCheaper = Math.max(...chains.map((c) => c.cheaper), 1);

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
  const signed = (v) => new Intl.NumberFormat(lang === 'bg' ? 'bg-BG' : 'en-IE', { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(v);

  // The lead: today's index as one verdict, placed on a gauge around the market's 100.
  const now = index.at(-1);
  const diff = now / 100 - 1;
  const verdict = diff > priceTolerance ? 'above' : diff < -priceTolerance ? 'below' : 'level';
  const span = Math.max(10, Math.ceil(Math.abs(now - 100)) + 2);
  const since = index.length > 1 && fill(t.lead.since, {
    change: signed(now - index[0]),
    date: date(indexPoints[0].data_date, { day: 'numeric', month: 'long', timeZone: 'UTC' }),
  });
  const asOf = snapRes.data[0]?.data_date;

  // Catalog split today against COMPARE_DAYS ago (or the oldest snapshot, if newer).
  const latest = snapRes.data[0];
  const earlier = snapRes.data.find((s) => newest - Date.parse(s.data_date) >= COMPARE_DAYS * 864e5) ?? snapRes.data.at(-1);
  const then = earlier !== latest && earlier;
  const thenDate = then && date(then.data_date, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const statusCols = [['at-risk', 'at_risk'], ['opportunity', 'opportunity'], ['competitive', 'competitive']];
  const statusLabels = monthLabels(points);
  const margin = latest?.avg_margin != null && Number(latest.avg_margin);

  // A printed market report: masthead, one verdict, then numbered sections.
  // Entrance: the dashboard's CSS (dash--overview) plus PageMotion on in-app navigations.
  return (
    <PageMotion as="section" className="dash dash--overview rp">
      <header className="dash__head">
        <div className="dash__title">
          <h1>{t.title}</h1>
          <p className="muted">{t.intro}</p>
          {asOf && (
            <p className="dash__fresh">
              {fill(dict.dashboard.dataAsOf, { date: date(asOf, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) })}
            </p>
          )}
        </div>
        <Link href="/dashboard/reports/export" download prefetch={false} className="button">
          <ButtonLabel>{t.export}</ButtonLabel>
        </Link>
      </header>

      <p className="dash__moves dash__moves--static" data-urgent={undercut > 0 || undefined}>
        {moves > 0 ? fill(dict.dashboard.movesToday, { n: moves }) : t.noMoves}
        {undercut > 0 && <strong>{fill(dict.dashboard.movesUndercut, { n: undercut })}</strong>}
      </p>

      {index.length > 0 && (
        <section className="rp__lead" aria-labelledby="rp-index">
          <div className="rp__verdict" data-status={verdict === 'above' ? 'at-risk' : 'competitive'}>
            <h2 id="rp-index">{t.index.title}</h2>
            <p className="rp__index">{number(now)}</p>
            <div className="rp__claim">
              <p>{verdict === 'level' ? t.lead.level : fill(t.lead[verdict], { pct: formatPercent(Math.abs(diff), lang, 'never') })}</p>
              {since && <small>{since}</small>}
            </div>
            {/* Where today's index sits around the market's 100; the sentence carries the numbers. */}
            <div className="rp__gauge" aria-hidden="true" style={{ '--p': (now - 100 + span) / (2 * span) }}>
              <span>{100 - span}</span>
              <span>{t.lead.market} 100</span>
              <span>{100 + span}</span>
            </div>
          </div>
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
            <p className="muted">{fill(t.indexStarting, { index: number(now) })}</p>
          )}
        </section>
      )}

      {latest?.products > 0 && (
        <section className="rp__section" aria-labelledby="rp-catalog">
          <div className="rp__section-head">
            <h2 id="rp-catalog">{t.catalog.title}</h2>
            <p className="muted">
              {fill(t.catalog.matched, { n: latest.products - latest.unmatched, of: latest.products })}
              {then && ` ${fill(t.catalog.compared, { date: thenDate })}`}
            </p>
          </div>
          {/* Today's status split; the tiles below carry the numbers. */}
          <div className="dash__meter" aria-hidden="true">
            {[...statusCols, ['unmatched', 'unmatched']].map(([status, col]) =>
              latest[col] > 0 && <span key={status} data-status={status} style={{ flexGrow: latest[col] }} />)}
          </div>
          <dl className="stat-grid">
            {statusCols.map(([status, col]) => (
              <div key={status} data-status={status}>
                <dt>{dict.status[status]}</dt>
                <dd data-count={latest[col]}>{latest[col]}</dd>
                <small>
                  {fill(t.catalog.share, { pct: formatPercent(latest[col] / latest.products, lang, 'never') })}
                  {then && ` · ${fill(t.catalog.since, { change: signed(latest[col] - then[col]), date: thenDate })}`}
                </small>
              </div>
            ))}
            {margin !== false ? (
              <div>
                <dt>{t.catalog.margin}</dt>
                <dd>{formatPercent(margin, lang, 'auto')}</dd>
                <small>
                  {fill(t.catalog.marginOf, { n: latest.margin_products })}
                  {then?.avg_margin != null && ` · ${fill(t.catalog.marginSince, { change: signed((margin - Number(then.avg_margin)) * 100), date: thenDate })}`}
                </small>
              </div>
            ) : (
              <div>
                <dt>{t.catalog.margin}</dt>
                <dd>—</dd>
                <small>{t.catalog.noCost}</small>
              </div>
            )}
          </dl>
        </section>
      )}

      <section className="rp__section" aria-labelledby="rp-changes">
        <div className="rp__section-head">
          <h2 id="rp-changes">{fill(t.changes.title, { days: CHANGE_DAYS })}</h2>
          <p className="muted">
            {changes.total
              ? fill(t.changes.bySource, Object.fromEntries(['apply', 'manual', 'csv'].map((s) => [s, bySource[s]?.changes ?? 0])))
              : fill(t.changes.none, { days: CHANGE_DAYS })}
          </p>
        </div>
        {changes.total > 0 && (
          <>
            {/* Rises against cuts at a glance; the tiles below carry the numbers. */}
            <div className="dash__meter" aria-hidden="true">
              {changes.rises > 0 && <span data-status="opportunity" style={{ flexGrow: changes.rises }} />}
              {changes.cuts > 0 && <span data-status="competitive" style={{ flexGrow: changes.cuts }} />}
            </div>
            <dl className="stat-grid">
              <div>
                <dt>{t.changes.applied}</dt>
                <dd data-count={applied?.changes ?? 0}>{applied?.changes ?? 0}</dd>
                <small>{applied ? fill(t.changes.competitiveNow, { n: applied.competitive_now, of: applied.products }) : t.changes.noneApplied}</small>
              </div>
              <div data-status="opportunity">
                <dt>{t.changes.rises}</dt>
                <dd data-count={changes.rises}>{changes.rises}</dd>
                {changes.rises > 0 && <small>{fill(t.changes.average, { pct: formatPercent(changes.avgRise, lang) })}</small>}
              </div>
              <div data-status="competitive">
                <dt>{t.changes.cuts}</dt>
                <dd data-count={changes.cuts}>{changes.cuts}</dd>
                {changes.cuts > 0 && <small>{fill(t.changes.average, { pct: formatPercent(changes.avgCut, lang) })}</small>}
              </div>
            </dl>
          </>
        )}
      </section>

      {room > 0 && (
        <section className="rp__section" aria-labelledby="rp-money">
          <div className="rp__section-head">
            <h2 id="rp-money">{t.money.title}</h2>
            <p className="muted">{t.money.note}</p>
          </div>
          <dl className="stat-grid">
            <div data-status="opportunity">
              <dt>{fill(t.money.total, { amount: formatPrice(room, lang) })}</dt>
              <dd data-count={raises.length}>{raises.length}</dd>
              <small>{fill(t.money.detail, { n: raises.length })}</small>
            </div>
          </dl>
          <article className="card report" data-status="opportunity">
            <ol className="rp__rank rp__rank--grid">
              {raises.slice(0, MONEY_ROWS).map((r, i) => (
                <li key={r.id} style={{ '--w': r.raise / raises[0].raise }}>
                  <span className="rp__n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <Link href={`/dashboard/products/${r.id}`}>{r.name}</Link>
                  <strong>{fill(t.money.raiseTo, { price: formatPrice(Number(r.best_price), lang), gain: formatPrice(r.raise, lang) })}</strong>
                  <span className="rp__bar" aria-hidden="true" />
                </li>
              ))}
            </ol>
            {raises.length > MONEY_ROWS && <p className="muted">{fill(t.money.more, { n: raises.length - MONEY_ROWS })}</p>}
          </article>
        </section>
      )}

      <section className="rp__section" aria-labelledby="rp-chains">
        <div className="rp__section-head">
          <h2 id="rp-chains">{t.chains.title}</h2>
          <p className="muted">{chains.length ? t.chains.intro : t.chains.none}</p>
        </div>
        {chains.length > 0 && (
          <article className="card report" data-status="at-risk">
            <ol className="rp__rank">
              {chains.map((c, i) => (
                <li key={c.competitor_key} style={{ '--w': c.cheaper / mostCheaper }}>
                  <span className="rp__n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    {COMPETITORS[c.competitor_key] ?? c.competitor_key}
                    <small className="muted"> · {c.cheaper ? `${fill(t.chains.cheaper, { n: c.cheaper, of: c.matched })} · ${fill(t.chains.gap, { pct: formatPercent(Number(c.avg_gap), lang, 'never') })}` : t.chains.level}</small>
                  </span>
                  <strong>{c.cheaper}</strong>
                  <span className="rp__bar" aria-hidden="true" />
                </li>
              ))}
            </ol>
          </article>
        )}
      </section>

      {moveRes.data.length > 0 && (
        <section className="rp__section" aria-labelledby="rp-moves">
          <div className="rp__section-head">
            <h2 id="rp-moves">{t.chainMoves.title}</h2>
            <p className="muted">{fill(t.chainMoves.intro, { days: MOVE_DAYS })}</p>
          </div>
          <article className="card report">
            <ol className="rp__rank">
              {moveRes.data.toSorted((a, b) => Math.abs(b.avg_change) - Math.abs(a.avg_change)).map((c, i, all) => (
                <li key={c.competitor_key} style={{ '--w': Math.abs(c.avg_change) / Math.max(Math.abs(all[0].avg_change), 1e-9) }} data-status={c.avg_change > 0 ? 'opportunity' : c.avg_change < 0 ? 'at-risk' : undefined}>
                  <span className="rp__n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    {COMPETITORS[c.competitor_key] ?? c.competitor_key}
                    <small className="muted"> · {fill(t.chainMoves.detail, { up: c.raised, down: c.cut, of: c.tracked, now: c.promo_now, then: c.promo_then })}</small>
                  </span>
                  <strong>{formatPercent(Number(c.avg_change), lang)}</strong>
                  <span className="rp__bar" aria-hidden="true" />
                </li>
              ))}
            </ol>
          </article>
        </section>
      )}

      {heldRes.data.length > 0 && (
        <section className="rp__section" aria-labelledby="rp-held">
          <div className="rp__section-head">
            <h2 id="rp-held">{t.held.title}</h2>
            <p className="muted">{fill(t.held.intro, { n: heldRes.data.length })}</p>
          </div>
          <article className="card report" data-status="at-risk">
            <ol className="rp__rank">
              {heldRes.data.slice(0, MONEY_ROWS).map((r, i) => (
                <li key={r.id} style={{ '--w': Number(r.gap_ratio) / Number(heldRes.data[0].gap_ratio) }}>
                  <span className="rp__n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <Link href={`/dashboard/products/${r.id}`}>{r.name}</Link>
                  <strong>{formatPercent(Number(r.gap_ratio), lang)}</strong>
                  <span className="rp__bar" aria-hidden="true" />
                </li>
              ))}
            </ol>
            {heldRes.data.length > MONEY_ROWS && <p className="muted">{fill(t.money.more, { n: heldRes.data.length - MONEY_ROWS })}</p>}
          </article>
        </section>
      )}

      {staleRes.data.length > 0 && (
        <section className="rp__section" aria-labelledby="rp-stale">
          <div className="rp__section-head">
            <h2 id="rp-stale">{t.stale.title}</h2>
            <p className="muted">{fill(t.stale.intro, { n: staleRes.data.length, days: activeDays })}</p>
          </div>
          <article className="card report" data-status="unmatched">
            <ol className="rp__rank">
              {staleRes.data.slice(0, MONEY_ROWS).map((r, i) => (
                <li key={r.id} style={{ '--w': 1 }}>
                  <span className="rp__n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <Link href={`/dashboard/products/${r.id}`}>{r.name}</Link>
                  <strong>{fill(t.stale.seen, { chain: COMPETITORS[r.competitor_key] ?? r.competitor_key, date: date(r.last_seen, { day: 'numeric', month: 'short', timeZone: 'UTC' }) })}</strong>
                </li>
              ))}
            </ol>
            {staleRes.data.length > MONEY_ROWS && <p className="muted">{fill(t.money.more, { n: staleRes.data.length - MONEY_ROWS })}</p>}
          </article>
        </section>
      )}

      {points.length > 1 && (
        <section className="rp__section" aria-labelledby="rp-status">
          <div className="rp__section-head">
            <h2 id="rp-status">{t.statusTrend.title}</h2>
            <p className="muted">{t.statusTrend.subtitle}</p>
          </div>
          <div
            className="rp__stack"
            role="img"
            aria-label={fill(t.statusTrend.label, { risk: latest.at_risk, opp: latest.opportunity, comp: latest.competitive })}
          >
            {points.map((s, i) => (
              <span key={s.data_date} title={date(s.data_date, { day: 'numeric', month: 'short', timeZone: 'UTC' })}>
                <b>
                  {[...statusCols].reverse().map(([status, col]) => (
                    <i key={status} data-status={status} style={{ flexGrow: s[col] }} />
                  ))}
                </b>
                <small>{statusLabels[i]}</small>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="rp__section" aria-labelledby="rp-focus">
        <div className="rp__section-head">
          <h2 id="rp-focus">{t.focus}</h2>
          <p className="muted">{t.focusIntro}</p>
        </div>
        <div className="rp__focus">
          {[
            ['at-risk', t.topRisk, riskRes.data, t.noneRisk],
            ['opportunity', t.topOpportunity, oppRes.data, t.noneOpportunity],
          ].map(([status, title, rows, empty]) => {
            // Bars are scaled to the list's biggest gap.
            const max = Math.max(...rows.map((r) => Math.abs(Number(r.gap_ratio))), 1e-9);
            return (
              <article key={status} className="card report" data-status={status}>
                <h3>{title}</h3>
                {rows.length ? (
                  <ol className="rp__rank">
                    {rows.map((r, i) => (
                      <li key={r.id} style={{ '--w': Math.abs(Number(r.gap_ratio)) / max }}>
                        <span className="rp__n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                        <Link href={`/dashboard/products/${r.id}`}>{r.name}</Link>
                        <strong>{formatPercent(Number(r.gap_ratio), lang)}</strong>
                        <span className="rp__bar" aria-hidden="true" />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">{empty}</p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </PageMotion>
  );
}
