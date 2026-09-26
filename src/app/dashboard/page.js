import Link from 'next/link';
import { redirect } from 'next/navigation';
import { importProducts, saveProduct } from '@/app/actions/products';
import MatchPoller from '@/components/MatchPoller';
import ProductDialog from '@/components/ProductDialog';
import { ImportForm, ProductForm } from '@/components/ProductForms';
import ProductSearch from '@/components/ProductSearch';
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

function dashboardHref({ status, q, page = 1 } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  if (page > 1) params.set('page', page);
  const query = params.toString();
  return query ? `/dashboard?${query}` : '/dashboard';
}

// The merchant's one product list: status summary, search, add and import.
// Matching runs in the background after a save, never here, so saving stays
// instant; a product with no match_key is still being matched and the page
// polls until it lands.
export default async function DashboardPage({ searchParams }) {
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.dashboard;
  const tp = dict.products;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect('/login');

  const params = await searchParams;
  const status = PRICE_STATUSES.includes(params.status) ? params.status : null;
  const page = Math.max(1, Number.parseInt(params.page, 10) || 1);
  // Strip what PostgREST's or() filter syntax would read as operators.
  const q = String(params.q ?? '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 100);
  const added = /^\d+$/.test(params.added ?? '') ? Number(params.added) : null;
  const notice = added ? 'added' : params.notice;
  const { activeDays, priceTolerance } = matchConfig();

  let rowsQuery = supabase
    .rpc('product_overview', { active_days: activeDays }, { count: 'exact' })
    .order('status_rank')
    .order('urgency', { ascending: false, nullsFirst: false })
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) rowsQuery = rowsQuery.eq('price_status', status);
  if (q) rowsQuery = rowsQuery.or(`name.ilike.*${q}*,brand.ilike.*${q}*,sku.ilike.*${q}*`);

  const countQuery = (s) =>
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('price_status', s);

  const [rowsRes, addedRes, latestRes, ...countRes] = await Promise.all([
    rowsQuery,
    // A just-added product goes first, wherever it sorts.
    added ? supabase.rpc('product_overview', { active_days: activeDays }).eq('id', added).maybeSingle() : { data: null },
    supabase.from('competitor_listing_price_history').select('data_date').order('data_date', { ascending: false }).limit(1),
    ...PRICE_STATUSES.map(countQuery),
  ]);
  for (const res of [rowsRes, addedRes, latestRes, ...countRes]) {
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
  }

  const counts = Object.fromEntries(PRICE_STATUSES.map((s, i) => [s, countRes[i].count ?? 0]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const rows = addedRes.data ? [addedRes.data, ...rowsRes.data.filter((r) => r.id !== added)] : rowsRes.data;
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
          <ProductDialog label={tp.importOpen} title={tp.import.title} closeLabel={tp.close}>
            <p className="muted">
              {tp.import.help}{' '}
              <Link href="/catalog-template.csv" download className="catalog__link">{tp.import.template}</Link>
            </p>
            <ImportForm t={tp} action={importProducts} />
          </ProductDialog>
          <ProductDialog label={tp.add} title={tp.addTitle} closeLabel={tp.close} variant="primary">
            <ProductForm key={added} t={tp} action={saveProduct} />
          </ProductDialog>
          <p className="dash__fresh" data-stale={stale || !dataDate || undefined}>
            {dataDate ? fill(t.dataAsOf, { date: dateLabel }) : t.noData}
            {stale && <strong> · {t.dataStale}</strong>}
          </p>
        </div>
      </header>

      {rows.some((r) => !r.match_key) && <MatchPoller />}

      {tp.notices[notice] && (
        <p className="form-message" role="status" data-kind="notice">{tp.notices[notice]}</p>
      )}

      <nav className="dash__tiles" aria-label={t.summary}>
        {PRICE_STATUSES.map((s) => (
          <Link
            key={s}
            href={dashboardHref({ status: status === s ? null : s, q })}
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
          <ProductSearch action="/dashboard" defaultValue={q} placeholder={tp.searchPlaceholder} label={tp.search}>
            {status && <input type="hidden" name="status" value={status} />}
          </ProductSearch>
          <nav className="dash__chips" aria-label={t.filter}>
            <Link href={dashboardHref({ q })} className="dash__chip" aria-current={!status ? 'page' : undefined}>
              {t.all} <span>{total}</span>
            </Link>
            {PRICE_STATUSES.map((s) => (
              <Link key={s} href={dashboardHref({ status: s, q })} className="dash__chip" aria-current={status === s ? 'page' : undefined}>
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
              </>
            ) : q ? (
              <>
                <p className="muted">{fill(tp.noResults, { q })}</p>
                <Link href={dashboardHref({ status })} className="button">{tp.clearSearch}</Link>
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
                <tr key={r.id} data-status={r.price_status} data-new={r.id === added || undefined}>
                  <th scope="row" className="dash__product">
                    <Link href={`/dashboard/products/${r.id}`}>{r.name}</Link>
                    {(r.brand || r.size) && <small>{[r.brand, r.size].filter(Boolean).join(' · ')}</small>}
                    {r.best_price != null && (
                      <small>
                        {fill(t.bestAt, {
                          price: formatPrice(r.best_price, lang),
                          chain: COMPETITORS[r.best_competitor] ?? r.best_competitor,
                        })}
                      </small>
                    )}
                  </th>
                  <td className="num" data-label={t.cols.yourPrice}>{formatPrice(r.price, lang)}</td>
                  <td data-label={t.cols.cheapest}>
                    {r.best_price != null ? (
                      <span className="muted">{formatPrice(r.best_price, lang)}</span>
                    ) : r.suggestion_count > 0 ? (
                      <Link href={`/dashboard/products/${r.id}`} className="dash__suggest">
                        {r.suggestion_count === 1 ? t.suggestion : fill(t.suggestions, { n: r.suggestion_count })}
                      </Link>
                    ) : (
                      <span className="muted">{t.noMatch}</span>
                    )}
                  </td>
                  <td className="num" data-label={t.cols.gap}>
                    {r.gap != null ? (
                      <span className="tracker__delta" data-dir={r.gap > 0 ? 'up' : r.gap < 0 ? 'down' : undefined}>
                        {formatPercent(Number(r.gap_ratio), lang)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="dash__status">
                    {r.match_key ? (
                      <span className="badge" data-status={r.price_status}>{dict.status[r.price_status]}</span>
                    ) : (
                      <span className="badge" data-status="matching">{tp.matching}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pages > 1 && (
          <nav className="dash__pager" aria-label={t.pagination}>
            {page > 1 ? <Link href={dashboardHref({ status, q, page: page - 1 })} className="dash__chip">{t.prev}</Link> : <span />}
            <span className="muted">{fill(t.page, { page, pages })}</span>
            {page < pages ? <Link href={dashboardHref({ status, q, page: page + 1 })} className="dash__chip">{t.next}</Link> : <span />}
          </nav>
        )}
      </div>
    </section>
  );
}
