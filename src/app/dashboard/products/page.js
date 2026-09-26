import Link from 'next/link';
import { redirect } from 'next/navigation';
import { importProducts, saveProduct } from '@/app/actions/products';
import ProductDialog from '@/components/ProductDialog';
import { ImportForm, ProductForm } from '@/components/ProductForms';
import { formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../../dictionaries';

// The merchant's product list, searchable and paged. Adding a product and the
// CSV import open in dialogs; each product opens its own page. Matching runs in
// the background after a save, never here, so saving stays instant.
const PAGE_SIZE = 50;

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
  // Strip what PostgREST's or() filter syntax would read as operators.
  const q = String(params.q ?? '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(params.page, 10) || 1);

  let listQuery = supabase
    .from('products')
    .select('id, name, brand, size, sku, price, price_status', { count: 'exact' })
    .order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) listQuery = listQuery.or(`name.ilike.*${q}*,brand.ilike.*${q}*,sku.ilike.*${q}*`);
  const listRes = await listQuery;
  if (listRes.error) throw new Error(`${listRes.error.code}: ${listRes.error.message}`, { cause: listRes.error });

  const rows = listRes.data;
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
            <ProductForm t={t} action={saveProduct} />
          </ProductDialog>
        </div>
      </header>

      {t.notices[notice] && (
        <p className="form-message" role="status" data-kind="notice">{t.notices[notice]}</p>
      )}

      <div className="dash__panel">
        <div className="dash__panel-head">
          <h2>{fill(t.count, { n: count })}</h2>
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
                <th scope="col">{t.cols.sku}</th>
                <th scope="col" className="num">{t.cols.price}</th>
                <th scope="col">{t.cols.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-status={r.price_status}>
                  <th scope="row" className="dash__product">
                    <Link href={`/dashboard/products/${r.id}`}>{r.name}</Link>
                    {(r.brand || r.size) && <small>{[r.brand, r.size].filter(Boolean).join(' · ')}</small>}
                  </th>
                  <td data-label={t.cols.sku}>{r.sku ?? <span className="muted">—</span>}</td>
                  <td className="num" data-label={t.cols.price}>{formatPrice(r.price, lang)}</td>
                  <td className="dash__status">
                    <span className="badge" data-status={r.price_status}>{dict.status[r.price_status]}</span>
                  </td>
                </tr>
              ))}
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
