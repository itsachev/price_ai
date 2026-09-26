import Link from 'next/link';
import { redirect } from 'next/navigation';
import { COMPETITORS, PRICE_STATUSES } from '@/lib/config';
import { formatPercent, formatPrice } from '@/lib/format';
import { matchConfig } from '@/lib/pipeline/match';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../dictionaries';

const PAGE_SIZE = 50;
// KZP publishes yesterday's prices each morning; older than this means the daily job missed runs.
const STALE_DAYS = 2;
const isStale = (date) => Date.now() - Date.parse(date) > (STALE_DAYS + 1) * 86_400_000;

const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);

function dashboardHref(status, page = 1) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (page > 1) params.set('page', page);
  const query = params.toString();
  return query ? `/dashboard?${query}` : '/dashboard';
}

export default async function DashboardPage({ searchParams }) {
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.dashboard;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect('/login');

  const params = await searchParams;
  const status = PRICE_STATUSES.includes(params.status) ? params.status : null;
  const page = Math.max(1, Number.parseInt(params.page, 10) || 1);
  const { activeDays, priceTolerance } = matchConfig();

  let rowsQuery = supabase
    .rpc('product_overview', { active_days: activeDays }, { count: 'exact' })
    .order('status_rank')
    .order('urgency', { ascending: false, nullsFirst: false })
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) rowsQuery = rowsQuery.eq('price_status', status);

  const countQuery = (s) =>
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('price_status', s);

  const [rowsRes, latestRes, ...countRes] = await Promise.all([
    rowsQuery,
    supabase.from('competitor_listing_price_history').select('data_date').order('data_date', { ascending: false }).limit(1),
    ...PRICE_STATUSES.map(countQuery),
  ]);
  for (const res of [rowsRes, latestRes, ...countRes]) {
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
  }

  const counts = Object.fromEntries(PRICE_STATUSES.map((s, i) => [s, countRes[i].count ?? 0]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const rows = rowsRes.data;
  const pages = Math.max(1, Math.ceil((rowsRes.count ?? 0) / PAGE_SIZE));

  const dataDate = latestRes.data[0]?.data_date;
  const stale = dataDate && isStale(dataDate);
  const dateLabel = dataDate &&
    new Intl.DateTimeFormat(lang === 'bg' ? 'bg-BG' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(dataDate));
  const pct = formatPercent(priceTolerance, lang, 'auto');

  return (
    <section className="dash">
      <header className="dash__head">
        <div className="dash__title">
          <h1>{t.title}</h1>
          <p className="muted">{t.intro}</p>
        </div>
        <div className="dash__actions">
          <p className="dash__fresh" data-stale={stale || !dataDate || undefined}>
            {dataDate ? fill(t.dataAsOf, { date: dateLabel }) : t.noData}
            {stale && <strong> · {t.dataStale}</strong>}
          </p>
          <Link href="/dashboard/products" className="button">{t.manage}</Link>
        </div>
      </header>

      <nav className="dash__tiles" aria-label={t.summary}>
        {PRICE_STATUSES.map((s) => (
          <Link
            key={s}
            href={status === s ? dashboardHref() : dashboardHref(s)}
            className="dash__tile"
            data-status={s}
            aria-current={status === s ? 'page' : undefined}
          >
            <span className="dash__tile-label">{dict.status[s]}</span>
            <span className="dash__tile-num">{counts[s]}</span>
            <span className="dash__tile-hint">{fill(t.hints[s], { pct })}</span>
          </Link>
        ))}
      </nav>

      <div className="dash__panel">
        <div className="dash__panel-head">
          <h2>{t.products}</h2>
          <nav className="dash__chips" aria-label={t.filter}>
            <Link href={dashboardHref()} className="dash__chip" aria-current={!status ? 'page' : undefined}>
              {t.all} <span>{total}</span>
            </Link>
            {PRICE_STATUSES.map((s) => (
              <Link key={s} href={dashboardHref(s)} className="dash__chip" aria-current={status === s ? 'page' : undefined}>
                {dict.status[s]} <span>{counts[s]}</span>
              </Link>
            ))}
          </nav>
        </div>

        {rows.length === 0 ? (
          <div className="dash__empty">
            {total === 0 ? (
              <>
                <h3>{t.empty}</h3>
                <p className="muted">{t.emptyText}</p>
                <Link href="/dashboard/products" className="button button--primary">{t.addFirst}</Link>
              </>
            ) : (
              <p className="muted">{t.emptyFilter}</p>
            )}
          </div>
        ) : (
          <table className="dash__table">
            <thead>
              <tr>
                <th scope="col">{t.cols.product}</th>
                <th scope="col" className="num">{t.cols.yourPrice}</th>
                <th scope="col">{t.cols.cheapest}</th>
                <th scope="col" className="num">{t.cols.gap}</th>
                <th scope="col">{t.cols.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-status={r.price_status}>
                  <th scope="row" className="dash__product">
                    <Link href={`/dashboard/products?edit=${r.id}`}>{r.name}</Link>
                    {(r.brand || r.size) && <small>{[r.brand, r.size].filter(Boolean).join(' · ')}</small>}
                  </th>
                  <td className="num" data-label={t.cols.yourPrice}>{formatPrice(r.price, lang)}</td>
                  <td data-label={t.cols.cheapest}>
                    {r.best_price != null ? (
                      <>
                        <span className="num">{formatPrice(r.best_price, lang)}</span>
                        {r.best_on_promo && <span className="dash__promo">{t.promo}</span>}
                        <small>
                          {COMPETITORS[r.best_competitor] ?? r.best_competitor} ·{' '}
                          {r.chain_count === 1 ? t.chain : fill(t.chains, { n: r.chain_count })}
                        </small>
                      </>
                    ) : (
                      <span className="muted">{t.noMatch}</span>
                    )}
                  </td>
                  <td className="num" data-label={t.cols.gap}>
                    {r.gap != null ? (
                      <span className="dash__gap">
                        {r.gap > 0 ? '+' : r.gap < 0 ? '−' : ''}
                        {formatPrice(Math.abs(r.gap), lang)}
                        <small>{formatPercent(Number(r.gap_ratio), lang)}</small>
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="dash__status">
                    <span className="badge" data-status={r.price_status}>{dict.status[r.price_status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pages > 1 && (
          <nav className="dash__pager" aria-label={t.pagination}>
            {page > 1 ? <Link href={dashboardHref(status, page - 1)} className="dash__chip">{t.prev}</Link> : <span />}
            <span className="muted">{fill(t.page, { page, pages })}</span>
            {page < pages ? <Link href={dashboardHref(status, page + 1)} className="dash__chip">{t.next}</Link> : <span />}
          </nav>
        )}
      </div>
    </section>
  );
}
