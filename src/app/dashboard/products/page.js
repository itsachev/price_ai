import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { deleteProduct, importProducts, linkListing, saveProduct, unlinkListing } from '@/app/actions/products';
import { ImportForm, ProductForm } from '@/components/ProductForms';
import { COMPETITORS } from '@/lib/config';
import { formatPrice } from '@/lib/format';
import { matchConfig } from '@/lib/pipeline/match';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../../dictionaries';

// Catalog management: add one product, edit one (?edit=<id>, linked from the
// dashboard table) or import a CSV price list. Matching happens in the daily
// job, never here, so saving stays instant.
// Listings Gemini judged "could be this product, but the text is too vague to be
// sure" for this product, cheapest first, with the ones the merchant linked.
// Read from stored verdicts only; no AI runs here.
async function possibleMatches(supabase, product) {
  if (!product.match_key) return [];
  const since = new Date(Date.now() - matchConfig().activeDays * 864e5).toISOString();
  const [verdicts, links] = await Promise.all([
    supabase
      .from('match_verdicts')
      .select('reason, listing:competitor_listings!inner(id, competitor_key, title, price, on_promo)')
      .eq('match_key', product.match_key)
      .eq('possible', true)
      .gte('listing.captured_at', since),
    supabase.from('product_links').select('listing_id').eq('product_id', product.id),
  ]);
  for (const res of [verdicts, links]) {
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
  }
  const linked = new Set(links.data.map((l) => l.listing_id));
  return verdicts.data
    .map((v) => ({ ...v.listing, reason: v.reason, linked: linked.has(v.listing.id) }))
    .sort((a, b) => a.price - b.price);
}

export default async function ProductsPage({ searchParams }) {
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.products;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect('/login?next=/dashboard/products');

  const { edit, notice } = await searchParams;
  let product = null;
  let suggestions = [];
  if (edit) {
    const { data, error } = await supabase.from('products').select('id, name, brand, size, sku, price, match_key').eq('id', edit).maybeSingle();
    if (error && error.code !== '22P02') throw new Error(`${error.code}: ${error.message}`, { cause: error });
    if (!data) notFound();
    product = data;
    suggestions = await possibleMatches(supabase, product);
  }
  const s = t.suggest;

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

      {suggestions.length > 0 && (
        <section className="dash__panel catalog__card suggest" aria-labelledby="suggest-title">
          <div className="catalog__card-head">
            <h2 id="suggest-title">{s.title}</h2>
          </div>
          <p className="muted">{s.help}</p>
          <ul className="suggest__list">
            {suggestions.map((l) => (
              <li key={l.id} className="suggest__item" data-linked={l.linked || undefined}>
                <div className="suggest__text">
                  <span className="suggest__chain">{COMPETITORS[l.competitor_key] ?? l.competitor_key}</span>
                  <span className="suggest__title">{l.title}</span>
                  {l.reason && <small className="muted">{l.reason}</small>}
                </div>
                <span className="suggest__price num">
                  {formatPrice(l.price, lang)}
                  {l.on_promo && <span className="dash__promo">{dict.dashboard.promo}</span>}
                </span>
                <form action={l.linked ? unlinkListing : linkListing}>
                  <input type="hidden" name="product_id" value={product.id} />
                  <input type="hidden" name="listing_id" value={l.id} />
                  <button className={l.linked ? 'button' : 'button button--primary'}>
                    {l.linked ? s.unlink : s.link}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="muted catalog__note">{t.matchNote}</p>
    </section>
  );
}
