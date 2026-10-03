import { redirect } from 'next/navigation';
import ButtonLabel from '@/components/ButtonLabel';
import FinderResults from '@/components/FinderResults';
import ProductDialog from '@/components/ProductDialog';
import ProductSearch from '@/components/ProductSearch';
import { COMPETITORS } from '@/lib/config';
import { formatPrice } from '@/lib/format';
import { matchConfig } from '@/lib/pipeline/match';
import { activeSince, planList } from '@/lib/shoppingList';
import { createClient } from '@/lib/supabase/server';
import { clearList, removeFromList, setQuantity } from '../../actions/shoppingList';
import { getDictionary, getLocale } from '../../dictionaries';

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.info.list.title, robots: { index: false } };
}

const chain = (key) => COMPETITORS[key] ?? key;

// The shopper's list: what the whole basket costs in each chain, and the
// cheapest way to buy it if they shop at more than one.
// Add products opens the finder in a dialog on ?q=, so the shopper never leaves
// the list; the dialog stays open while they search and add.
export default async function ShoppingListPage({ searchParams }) {
  const lang = await getLocale();
  const { info } = await getDictionary(lang);
  const t = info.list;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect('/login?next=/info/list');
  const q = String((await searchParams).q ?? '').trim().slice(0, 80);

  const { data: items } = await supabase
    .from('shopping_list_items')
    .select('id, quantity, listing:competitor_listings(id, competitor_key, category_code, title, price, on_promo)')
    .order('created_at');
  const categories = [...new Set((items ?? []).map((i) => i.listing.category_code).filter((c) => c != null))];
  let listings = [];
  if (categories.length) {
    const since = activeSince(matchConfig().activeDays);
    const { data } = await supabase
      .from('competitor_listings')
      .select('id, competitor_key, category_code, title, price, on_promo')
      .in('category_code', categories)
      .gte('captured_at', since);
    listings = data ?? [];
  }
  const { rows, chains, split } = planList(items ?? [], listings);
  const euros = (c) => formatPrice(c / 100, lang);
  const bestChain = chains.find((c) => c.missing === 0);
  const saving = bestChain ? bestChain.total - split.total : 0;

  return (
    <section className="finder">
      <div className="finder__head">
        <h1>{t.title}</h1>
        <ProductDialog label={t.addMore} title={t.addMore} closeLabel={t.close}>
          <p className="finder__lead">{info.lead}</p>
          <ProductSearch action="/info/list" defaultValue={q} placeholder={info.placeholder} label={info.search} />
          <FinderResults q={q} lang={lang} t={info} />
        </ProductDialog>
      </div>

      {!rows.length ? (
        <p className="finder__empty">{t.empty}</p>
      ) : (
        <div className="shopping__grid">
          <div className="shopping__col">
            <article className="finder__best">
              <p className="finder__eyebrow">{t.cheapestWay}</p>
              <p className="finder__where">
                <span className="finder__price">{euros(split.total)}</span>
                <span>{split.stores === 1 ? t.oneStore : t.stores.replace('{count}', split.stores)}</span>
              </p>
              {saving > 0 && (
                <p className="shopping__saving">
                  {t.saving.replace('{amount}', euros(saving)).replace('{chain}', chain(bestChain.key))}
                </p>
              )}
            </article>

            <h2 className="shopping__heading">{t.perChain}</h2>
            <ol className="finder__list shopping__chains">
              {chains.map((c) => (
                <li key={c.key}>
                  <strong>{chain(c.key)}</strong>
                  <span className="finder__chain">
                    {c.missing ? t.missing.replace('{count}', c.missing) : t.complete}
                  </span>
                  <span className="finder__price">{euros(c.total)}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="shopping__col">
            <h2 className="shopping__heading">{t.items}</h2>
            <ol className="finder__list shopping__items">
              {rows.map(({ item, best }) => (
                <li key={item.id}>
                  <span className="finder__title">{item.listing.title}</span>
                  <span className="finder__chain">
                    {t.bestAt.replace('{chain}', chain(best.competitor_key)).replace('{price}', formatPrice(best.price, lang))}
                    {best.id !== item.listing.id && <> · {best.title}</>}
                  </span>
                  {best.on_promo && <span className="badge">{info.promo}</span>}
                  <form action={setQuantity} className="shopping__qty">
                    <input type="hidden" name="item" value={item.id} />
                    <button name="quantity" value={item.quantity - 1} aria-label={t.less}>−</button>
                    <output aria-label={t.quantity}>{item.quantity}</output>
                    <button name="quantity" value={item.quantity + 1} disabled={item.quantity >= 99} aria-label={t.more}>+</button>
                  </form>
                  <form action={removeFromList}>
                    <input type="hidden" name="item" value={item.id} />
                    <button className="button button--danger-quiet" aria-label={`${t.remove}: ${item.listing.title}`}>
                      <ButtonLabel>{t.remove}</ButtonLabel>
                    </button>
                  </form>
                </li>
              ))}
            </ol>
            <p className="shopping__total">
              <span>{t.total.replace('{count}', rows.reduce((n, r) => n + r.item.quantity, 0))}</span>
              <span className="finder__price">{euros(split.total)}</span>
            </p>

            <form action={clearList} className="shopping__clear">
              <button className="button button--danger-quiet"><ButtonLabel>{t.clear}</ButtonLabel></button>
            </form>
            <p className="finder__note">{t.note}</p>
          </div>
        </div>
      )}
    </section>
  );
}
