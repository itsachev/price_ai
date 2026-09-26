import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { deleteProduct, importProducts, saveProduct } from '@/app/actions/products';
import { ImportForm, ProductForm } from '@/components/ProductForms';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../../dictionaries';

// Catalog management: add one product, edit one (?edit=<id>, linked from the
// dashboard table) or import a CSV price list. Matching happens in the daily
// job, never here, so saving stays instant.
export default async function ProductsPage({ searchParams }) {
  const dict = await getDictionary(await getLocale());
  const t = dict.products;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect('/login?next=/dashboard/products');

  const { edit, notice } = await searchParams;
  let product = null;
  if (edit) {
    const { data, error } = await supabase.from('products').select('id, name, brand, size, sku, price').eq('id', edit).maybeSingle();
    if (error && error.code !== '22P02') throw new Error(`${error.code}: ${error.message}`, { cause: error });
    if (!data) notFound();
    product = data;
  }

  return (
    <section className="dash catalog">
      <header className="dash__head">
        <div className="dash__title">
          <h1>{t.title}</h1>
          <p className="muted">{t.intro}</p>
        </div>
        <Link href="/dashboard" className="button">{t.back}</Link>
      </header>

      {t.notices[notice] && (
        <p className="form-message" role="status" data-kind="notice">{t.notices[notice]}</p>
      )}

      <div className="catalog__grid">
        <div className="dash__panel catalog__card">
          <div className="catalog__card-head">
            <h2>{product ? t.editTitle : t.addTitle}</h2>
            {product && <Link href="/dashboard/products" className="catalog__link">{t.cancel}</Link>}
          </div>
          <ProductForm key={product?.id ?? 'new'} t={t} action={saveProduct} deleteAction={deleteProduct} product={product} />
        </div>

        <div className="dash__panel catalog__card">
          <div className="catalog__card-head">
            <h2>{t.import.title}</h2>
            <Link href="/catalog-template.csv" download className="catalog__link">{t.import.template}</Link>
          </div>
          <p className="muted">{t.import.help}</p>
          <ImportForm t={t} action={importProducts} />
        </div>
      </div>

      <p className="muted catalog__note">{t.matchNote}</p>
    </section>
  );
}
