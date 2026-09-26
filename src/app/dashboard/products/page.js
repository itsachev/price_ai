import Link from 'next/link';
import { redirect } from 'next/navigation';
import { importProducts, saveProduct } from '@/app/actions/products';
import MatchPoller from '@/components/MatchPoller';
import ProductDialog from '@/components/ProductDialog';
import { ImportForm, ProductForm } from '@/components/ProductForms';
import { COMPETITORS } from '@/lib/config';
import { formatPrice } from '@/lib/format';
import { matchConfig } from '@/lib/pipeline/match';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../../dictionaries';

// The merchant's product list, searchable and paged. Adding a product and the
// CSV import open in dialogs; each product opens its own page. Matching runs in
// the background after a save, never here, so saving stays instant. A product
// with no match_key is still being matched; the page polls until it lands.
const PAGE_SIZE = 50;
const COLUMNS = 'id, name, brand, size, price, price_status, match_key';

const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);

function productsHref(q, page = 1) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (page > 1) params.set('page', page);
  const query = params.toString();
  return query ? `/dashboard/products?${query}` : '/dashboard/products';
}

export default async function ProductsPage({ searchParams }) {
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.products;
  const d = dict.dashboard;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect('/login?next=/dashboard/products');

  const params = await searchParams;
  const { notice } = params;
  const added = /^\d+$/.test(params.added ?? '') ? Number(params.added) : null;
  // Strip what PostgREST's or() filter syntax would read as operators.
  const q = String(params.q ?? '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(params.page, 10) || 1);

  let listQuery = supabase
    .from('products')
    .select(COLUMNS, { count: 'exact' })
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) listQuery = listQuery.or(`name.ilike.*${q}*,brand.ilike.*${q}*,sku.ilike.*${q}*`);
  // A just-added product goes first, wherever its name sorts.
  const [listRes, addedRes] = await Promise.all([
    listQuery,
    added ? supabase.from('products').select(COLUMNS).eq('id', added).maybeSingle() : { data: null },
  ]);
  for (const res of [listRes, addedRes]) {
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
  }
  const rows = addedRes.data ? [addedRes.data, ...listRes.data.filter((r) => r.id !== added)] : listRes.data;

  // Market best (cheapest confirmed competitor) and open suggestions for the
  // rows on this page, from the same stored overview the dashboard reads.
  // ponytail: product_overview computes the whole catalog before the id filter
  // (its SET clause blocks inlining); take ids as a parameter if catalogs grow large.
  const market = new Map();
  if (rows.length) {
    const res = await supabase
      .rpc('product_overview', { active_days: matchConfig().activeDays })
      .select('id, best_price, best_competitor, best_on_promo, chain_count, suggestion_count')
      .in('id', rows.map((r) => r.id));
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
    for (const o of res.data) market.set(o.id, o);
  }

  const count = listRes.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <section className="dash catalog">
      <header className="dash__head">
        <div className="dash__title">
          <h1>{t.title}</h1>
          <p className="muted">{t.intro}</p>
        </div>
        <div className="dash__actions">
          <ProductDialog label={t.importOpen} title={t.import.title} closeLabel={t.close}>
            <p className="muted">
              {t.import.help}{' '}
              <Link href="/catalog-template.csv" download className="catalog__link">{t.import.template}</Link>
            </p>
            <ImportForm t={t} action={importProducts} />
          </ProductDialog>
          <ProductDialog label={t.add} title={t.addTitle} closeLabel={t.close} variant="primary">
            <ProductForm key={added} t={t} action={saveProduct} />
          </ProductDialog>
        </div>
      </header>

      {rows.some((r) => !r.match_key) && <MatchPoller />}

      {t.notices[added ? 'added' : notice] && (
        <p className="form-message" role="status" data-kind="notice">{t.notices[added ? 'added' : notice]}</p>
      )}

      <div className="dash__panel">
        <div className="dash__panel-head">
          <h2 className="count-head">
            {t.countLabel} <span className="count-badge num">{count.toLocaleString(lang === 'bg' ? 'bg-BG' : 'en-GB')}</span>
          </h2>
          <form role="search" className="catalog__search" action="/dashboard/products">
            <input type="search" name="q" defaultValue={q} placeholder={t.searchPlaceholder} aria-label={t.search} autoComplete="off" />
            <button className="button">{t.searchSubmit}</button>
          </form>
        </div>

        {rows.length === 0 ? (
          <div className="dash__empty">
            {q ? (
              <>
                <p className="muted">{fill(t.noResults, { q })}</p>
                <Link href="/dashboard/products" className="button">{t.clearSearch}</Link>
              </>
            ) : (
              <>
                <h3>{t.empty}</h3>
                <p className="muted">{t.emptyText}</p>
              </>
            )}
          </div>
        ) : (
          <table className="dash__table">
            <thead>
              <tr>
                <th scope="col">{t.cols.product}</th>
                <th scope="col" className="num">{t.cols.best}</th>
                <th scope="col" className="num">{t.cols.price}</th>
                <th scope="col">{t.cols.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = market.get(r.id) ?? {};
                const similar = r.price_status === 'unmatched' ? m.suggestion_count : 0;
                return (
                <tr key={r.id} data-status={r.price_status} data-new={r.id === added || undefined}>
                  <th scope="row" className="dash__product">
                    <Link href={`/dashboard/products/${r.id}`}>{r.name}</Link>
                    {(r.brand || r.size) && <small>{[r.brand, r.size].filter(Boolean).join(' · ')}</small>}
                    {similar > 0 && (
                      <Link href={`/dashboard/products/${r.id}`} className="dash__similar">
                        <span>{fill(similar === 1 ? t.similarOne : t.similar, { n: similar })}</span>
                      </Link>
                    )}
                  </th>
                  <td className="num" data-label={t.cols.best}>
                    {m.best_price != null ? (
                      <>
                        <span className="num">{formatPrice(m.best_price, lang)}</span>
                        {m.best_on_promo && <span className="dash__promo">{d.promo}</span>}
                        <small>
                          {COMPETITORS[m.best_competitor] ?? m.best_competitor}
                          {m.chain_count > 1 && ` · ${fill(d.chains, { n: m.chain_count })}`}
                        </small>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="num" data-label={t.cols.price}>{formatPrice(r.price, lang)}</td>
                  <td className="dash__status">
                    {r.match_key ? (
                      <span className="badge" data-status={r.price_status}>{dict.status[r.price_status]}</span>
                    ) : (
                      <span className="badge" data-status="matching">{t.matching}</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {pages > 1 && (
          <nav className="dash__pager" aria-label={d.pagination}>
            {page > 1 ? <Link href={productsHref(q, page - 1)} className="dash__chip">{d.prev}</Link> : <span />}
            <span className="muted">{fill(d.page, { page, pages })}</span>
            {page < pages ? <Link href={productsHref(q, page + 1)} className="dash__chip">{d.next}</Link> : <span />}
          </nav>
        )}
      </div>

    </section>
  );
}
