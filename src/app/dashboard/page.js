import Link from 'next/link';
import { redirect } from 'next/navigation';
import { applySuggestions, importProducts, saveProduct } from '@/app/actions/products';
import ButtonLabel from '@/components/ButtonLabel';
import MatchPoller from '@/components/MatchPoller';
import PageMotion from '@/components/PageMotion';
import Pager from '@/components/Pager';
import ProductDialog from '@/components/ProductDialog';
import { ImportForm, ProductForm } from '@/components/ProductForms';
import ProductSearch from '@/components/ProductSearch';
import ScrollToOnMount from '@/components/ScrollToOnMount';
import { COMPETITORS, PRICE_STATUSES } from '@/lib/config';
import { formatPercent, formatPrice } from '@/lib/format';
import { matchConfig } from '@/lib/pipeline/match';
import { createClient } from '@/lib/supabase/server';
import { PAGE_SIZE } from '@/lib/pagination';
import { loadSuggestions } from '@/lib/suggestions';
import { getDictionary, getLocale } from '../dictionaries';

// Tiles lead with the statuses that cost money; the quiet ones need no action.
const TILE_ORDER = ['at-risk', 'opportunity', 'competitive', 'unmatched'];
const QUIET = new Set(['competitive', 'unmatched']);
// KZP publishes yesterday's prices each morning; older than this means the daily job missed runs.
const STALE_DAYS = 2;
const isStale = (date) => Date.now() - Date.parse(date) > (STALE_DAYS + 1) * 86_400_000;
// The export dialog's default start: a week of changes.
const EXPORT_DAYS = 7;
// Suggestions previewed on the dashboard card; the rest are in the review dialog.
const ADVICE_PREVIEW = 3;
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

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
export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.nav.dashboard };
}


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
  const q = String(params.q ?? '').replace(/[,()*%\\"]/g, ' ').trim().slice(0, 100);
  const added = /^\d+$/.test(params.added ?? '') ? Number(params.added) : null;
  const applied = /^\d+$/.test(params.applied ?? '') ? Number(params.applied) : null;
  const notice = added ? 'added' : params.notice;
  const { activeDays, priceTolerance } = matchConfig();

  let rowsQuery = supabase
    .rpc('product_overview', { active_days: activeDays }, { count: 'exact' })
    .order('status_rank')
    .order('held')
    .order('urgency', { ascending: false, nullsFirst: false })
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) rowsQuery = rowsQuery.eq('price_status', status);
  if (q) rowsQuery = rowsQuery.or(`name.ilike.*${q}*,brand.ilike.*${q}*,sku.ilike.*${q}*`);

  const countQuery = (s) =>
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('price_status', s);

  const [suggestions, rowsRes, addedRes, latestRes, movesRes, ...countRes] = await Promise.all([
    loadSuggestions(supabase),
    rowsQuery,
    // A just-added product goes first, wherever it sorts.
    added ? supabase.rpc('product_overview', { active_days: activeDays }).eq('id', added).maybeSingle() : { data: null },
    supabase.from('competitor_listing_price_history').select('data_date').order('data_date', { ascending: false }).limit(1),
    // The day's price moves at the chains (Reports), counted for the link above the tiles.
    supabase.rpc('price_moves').select('kind'),
    ...PRICE_STATUSES.map(countQuery),
  ]);
  for (const res of [rowsRes, addedRes, latestRes, movesRes, ...countRes]) {
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
  }

  const counts = Object.fromEntries(PRICE_STATUSES.map((s, i) => [s, countRes[i].count ?? 0]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const moves = movesRes.data.length;
  const undercut = movesRes.data.filter((m) => m.kind === 'undercut').length;
  const rows = addedRes.data ? [addedRes.data, ...rowsRes.data.filter((r) => r.id !== added)] : rowsRes.data;
  const pages = Math.max(1, Math.ceil((rowsRes.count ?? 0) / PAGE_SIZE));

  const dataDate = latestRes.data[0]?.data_date;
  const stale = dataDate && isStale(dataDate);
  const dateLabel = dataDate &&
    new Intl.DateTimeFormat(lang === 'bg' ? 'bg-BG' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(dataDate));
  const pct = formatPercent(priceTolerance, lang, 'auto');
  const today = daysAgo(0);

  // Bulk apply: every suggested price in one reviewed step. A price below cost
  // starts unticked, so a margin loss is never applied by default.
  const tb = t.bulk;
  const suggestionById = new Map(suggestions.map((s) => [s.id, s]));
  const ready = suggestions.filter((s) => !s.held && !s.dismissed);
  const bulkApply = ready.length > 0 && (
    <ProductDialog key={applied ?? 'bulk'} label={tb.open} title={tb.title} closeLabel={tp.close} variant="signal">
      <p className="muted">{tb.help}</p>
      <form action={applySuggestions} className="bulk">
        <ul className="bulk__list">
          {ready.map((s) => {
            const belowCost = s.cost != null && s.suggested < s.cost;
            return (
              <li key={s.id}>
                <label className="bulk__row" data-status={s.status}>
                  <input type="checkbox" name="id" value={s.id} defaultChecked={!belowCost} />
                  <span className="bulk__name">
                    {s.name}
                    <small>
                      {[s.detail, fill(tb.best, { price: formatPrice(s.best, lang), chain: COMPETITORS[s.competitor] ?? s.competitor })]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                  <span className="bulk__prices">
                    <s>{formatPrice(s.price, lang)}</s>
                    <span aria-hidden="true">→</span>
                    <strong>{formatPrice(s.suggested, lang)}</strong>
                    <small>
                      {formatPercent((s.suggested - s.price) / s.price, lang)}
                    </small>
                  </span>
                  {s.limit && <small className="bulk__margin">{tb.limits[s.limit]}</small>}
                  {s.cost != null && (
                    <small className="bulk__margin" data-warn={belowCost || undefined}>
                      {belowCost
                        ? fill(tb.belowCost, { cost: formatPrice(s.cost, lang) })
                        : fill(tb.margin, { pct: formatPercent((s.suggested - s.cost) / s.suggested, lang, 'auto') })}
                    </small>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
        <div className="product-form__actions">
          <button className="button button--primary"><ButtonLabel>{tb.submit}</ButtonLabel></button>
        </div>
      </form>
    </ProductDialog>
  );

  // The suggestions card: what the changes are (cuts to win back the cheapest
  // spot, raises that earn more), what they're worth, and the most urgent few,
  // with the review dialog one click away.
  const ta = t.advice;
  const cuts = ready.filter((s) => s.suggested < s.price);
  const raises = ready.filter((s) => s.suggested > s.price);
  const gain = raises.reduce((sum, s) => sum + s.suggested - s.price, 0);
  const belowCost = ready.filter((s) => s.cost != null && s.suggested < s.cost).length;
  const heldCount = suggestions.filter((s) => s.held).length;
  const dismissedCount = suggestions.filter((s) => s.dismissed && !s.held).length;
  const plural = (n, one, many) => fill(n === 1 ? one : many, { n });
  const advice = ready.length > 0 && (
    <section className="advice" aria-labelledby="advice-title">
      <div className="advice__head">
        <div className="advice__title">
          <p className="advice__kicker">{fill(ta.kicker, { date: dateLabel ?? '' })}</p>
          <h2 id="advice-title">{plural(ready.length, ta.titleOne, ta.title)}</h2>
        </div>
        {bulkApply}
      </div>
      <ul className="advice__stats">
        {cuts.length > 0 && (
          <li data-status="at-risk">
            <strong>{plural(cuts.length, ta.cutsOne, ta.cuts)}</strong>
            <span>{ta.cutsHint}</span>
          </li>
        )}
        {raises.length > 0 && (
          <li data-status="opportunity">
            <strong>{plural(raises.length, ta.raisesOne, ta.raises)}</strong>
            <span>{fill(ta.raisesHint, { amount: formatPrice(gain, lang) })}</span>
          </li>
        )}
        {belowCost > 0 && (
          <li data-warn>
            <strong>{fill(ta.belowCost, { n: belowCost })}</strong>
            <span>{ta.belowCostHint}</span>
          </li>
        )}
      </ul>
      <ol className="advice__list">
        {ready.slice(0, ADVICE_PREVIEW).map((s) => (
          <li key={s.id}>
            <Link href={`/dashboard/products/${s.id}`} className="advice__row" data-status={s.status}>
              <span className="advice__name">
                {s.name}
                <small>
                  {fill(tb.best, { price: formatPrice(s.best, lang), chain: COMPETITORS[s.competitor] ?? s.competitor })}
                </small>
              </span>
              <span className="advice__prices">
                <s>{formatPrice(s.price, lang)}</s>
                <span aria-hidden="true">→</span>
                <strong>{formatPrice(s.suggested, lang)}</strong>
                <small>{formatPercent((s.suggested - s.price) / s.price, lang)}</small>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {(ready.length > ADVICE_PREVIEW || heldCount > 0 || dismissedCount > 0) && (
        <p className="advice__foot">
          {ready.length > ADVICE_PREVIEW && <span>{fill(ta.more, { n: ready.length - ADVICE_PREVIEW })}</span>}
          {heldCount > 0 && <Link href="/dashboard/settings#rules">{fill(ta.held, { n: heldCount })}</Link>}
          {dismissedCount > 0 && <span>{fill(ta.dismissed, { n: dismissedCount })}</span>}
        </p>
      )}
    </section>
  );

  const movesLink = moves > 0 && (
    <Link href="/dashboard/reports" className="dash__moves" data-urgent={undercut > 0 || undefined}>
      {fill(t.movesToday, { n: moves })}
      {undercut > 0 && <strong>{fill(t.movesUndercut, { n: undercut })}</strong>}
    </Link>
  );

  // Export: the prices changed here, as a CSV for the till or POS.
  const te = t.export;
  const exportPrices = (
    <ProductDialog label={te.open} title={te.title} closeLabel={tp.close} variant="quiet">
      <p className="muted">{te.help}</p>
      <form method="get" action="/dashboard/export" className="product-form">
        <label className="field">
          <span>{te.since}</span>
          <input type="date" name="since" defaultValue={daysAgo(EXPORT_DAYS)} max={today} required />
        </label>
        <div className="product-form__actions">
          <button className="button button--primary"><ButtonLabel>{te.submit}</ButtonLabel></button>
        </div>
      </form>
    </ProductDialog>
  );

  // Add and Import: in the header once there are products, in the empty state before.
  const addImport = (
    <>
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
    </>
  );

  // Four groups, spaced apart: today's state, today's to-do, catalog health, the list.
  // Entrance: CSS (dashboard.css) on every load; PageMotion adds the title split
  // and tile counters on in-app navigations.
  return (
    <PageMotion as="section" className="dash dash--overview">
      <div className="dash__group">
        <header className="dash__head">
          <div className="dash__title">
            <h1>{t.title}</h1>
            <p className="dash__fresh" data-stale={stale || !dataDate || undefined}>
              {dataDate ? fill(t.dataAsOf, { date: dateLabel }) : t.noData}
            </p>
          </div>
          {total > 0 && <div className="dash__actions">{exportPrices}{addImport}</div>}
        </header>

        {rows.some((r) => !r.match_key) && <MatchPoller />}

        {/* Repricing from an old feed is the costly mistake, so staleness gets its own line. */}
        {stale && (
          <p className="dash__alert" role="status">{fill(t.staleBanner, { date: dateLabel })}</p>
        )}

        {applied != null && (
          <p className="form-message" role="status" data-kind="notice">
            {fill(t.bulk.applied, { n: applied })}{' '}
            {applied > 0 && (
              <Link href={`/dashboard/export?since=${today}`} download prefetch={false} className="catalog__link">{t.bulk.download}</Link>
            )}
          </p>
        )}

        {tp.notices[notice] && (
          <p className="form-message" role="status" data-kind="notice">{tp.notices[notice]}</p>
        )}
      </div>

      {(advice || moves > 0) && (
        <div className="dash__group">
          {/* An undercut is the day's most urgent news, so it leads; otherwise the moves trail the advice. */}
          {undercut > 0 && movesLink}
          {advice}
          {undercut === 0 && movesLink}
        </div>
      )}

      {total > 0 && (
        <section className="dash__summary" aria-labelledby="summary-title">
          <div className="dash__summary-head">
            <h2 id="summary-title">{t.health}</h2>
            <p>{plural(total, t.trackedOne, t.tracked)}</p>
          </div>
          {/* The catalog's split by status at a glance; the tiles below carry the numbers. */}
          <div className="dash__meter" aria-hidden="true">
            {TILE_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <span key={s} data-status={s} data-dim={(status && status !== s) || undefined} style={{ flexGrow: counts[s] }} />
            ))}
          </div>
          {/* The status filter: each tile toggles ?status=. */}
          <nav className="dash__tiles" aria-label={t.summary}>
            {TILE_ORDER.map((s) => (
              <Link
                key={s}
                href={dashboardHref({ status: status === s ? null : s, q })}
                className="dash__tile"
                data-status={s}
                data-quiet={QUIET.has(s) || undefined}
                aria-current={status === s ? 'page' : undefined}
              >
                <span className="dash__tile-label">{dict.status[s]}</span>
                <span className="dash__tile-num" data-count={counts[s]}>{counts[s]}</span>
                <span className="dash__tile-hint">{fill(t.hints[s], { pct })}</span>
              </Link>
            ))}
          </nav>
        </section>
      )}

      <div className="dash__panel" id="products">
        {/* Bring the new row and its matching status into view. */}
        {added && <ScrollToOnMount key={added} target="#products" />}
        <div className="dash__panel-head">
          <h2>{status ? dict.status[status] : t.products}</h2>
          {(status || q) && (
            <p className="dash__showing">
              {fill(t.showing, { n: rowsRes.count ?? 0, total })}{' '}
              <Link href={dashboardHref()}>{t.showAll}</Link>
            </p>
          )}
          <ProductSearch action="/dashboard" defaultValue={q} placeholder={tp.searchPlaceholder} label={tp.search}>
            {status && <input type="hidden" name="status" value={status} />}
          </ProductSearch>
        </div>

        {rows.length === 0 ? (
          <div className="dash__empty">
            {total === 0 ? (
              <>
                <h3>{t.empty}</h3>
                <p className="muted">{t.emptyText}</p>
                <div className="dash__actions">{addImport}</div>
              </>
            ) : q ? (
              <>
                <p className="muted">{fill(tp.noResults, { q })}</p>
                <Link href={dashboardHref({ status })} className="button"><ButtonLabel>{tp.clearSearch}</ButtonLabel></Link>
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
                <th scope="col">{t.cols.suggested}</th>
                <th scope="col">{t.cols.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const best = r.best_price == null ? null : Number(r.best_price);
                const s = r.match_key ? suggestionById.get(r.id) : null;
                return (
                  <tr key={r.id} data-status={r.price_status} data-new={r.id === added || undefined} data-matching={!r.match_key || undefined}>
                    <th scope="row" className="dash__product">
                      <Link href={`/dashboard/products/${r.id}`}>{r.name}</Link>
                      {(r.brand || r.size) && <small>{[r.brand, r.size].filter(Boolean).join(' · ')}</small>}
                    </th>
                    <td className="num" data-label={t.cols.yourPrice}>{formatPrice(r.price, lang)}</td>
                    <td data-label={t.cols.cheapest}>
                      {best != null ? (
                        <>
                          {formatPrice(best, lang)}
                          <small>
                            {COMPETITORS[r.best_competitor] ?? r.best_competitor}
                            {r.best_on_promo && ` · ${t.promo}`}
                          </small>
                        </>
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
                    <td data-label={t.cols.suggested}>
                      {s?.held || s?.dismissed ? (
                        <span className="muted">{s.held ? t.held : t.dismissed}</span>
                      ) : s ? (
                        <span className="dash__advice">
                          {fill(s.suggested < s.price ? t.lowerTo : t.raiseTo, { price: formatPrice(s.suggested, lang) })}
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
                );
              })}
            </tbody>
          </table>
        )}

        <Pager page={page} pages={pages} href={(n) => dashboardHref({ status, q, page: n })} t={t} />
      </div>
    </PageMotion>
  );
}
