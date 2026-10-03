import { addToList } from '@/app/actions/shoppingList';
import { COMPETITORS } from '@/lib/config';
import { formatPrice } from '@/lib/format';
import { matchConfig } from '@/lib/pipeline/match';
import { activeSince } from '@/lib/shoppingList';
import { createClient } from '@/lib/supabase/server';
import ButtonLabel from './ButtonLabel';

const LIMIT = 20;

// Ids of the listings already on the shopper's list (RLS: own rows only).
export async function listedIds(supabase) {
  const { data } = await supabase.from('shopping_list_items').select('listing_id');
  return new Set((data ?? []).map((r) => r.listing_id));
}

// Add, or a quiet "On list" once it's there (the form re-renders in place).
export function ListButton({ listing, onList, t }) {
  if (onList.has(listing.id)) return <span className="finder__added">{t.onList}</span>;
  return (
    <form action={addToList}>
      <input type="hidden" name="listing" value={listing.id} />
      <button className="button button--quiet finder__add" aria-label={`${t.add}: ${listing.title}`}>
        <ButtonLabel>{t.add}</ButtonLabel>
      </button>
    </form>
  );
}

// The finder's results for ?q= (shared by /info and the Add dialog on
// /info/list): the cheapest hit as a card, the rest as a price-sorted list.
// ponytail: plain ilike per word on the chain's title, so "vereya" won't find
// "Верея"; search translit tokens (match.js) if shoppers type Latin.
export default async function FinderResults({ q, lang, t }) {
  const words = q.split(/\s+/).filter(Boolean).slice(0, 6);
  if (!words.length) return null;

  const supabase = await createClient();
  let query = supabase
    .from('competitor_listings')
    .select('id, competitor_key, title, price, on_promo')
    .gte('captured_at', activeSince(matchConfig().activeDays));
  for (const w of words) query = query.ilike('title', `%${w.replace(/[\\%_]/g, '\\$&')}%`);
  const [{ data: results }, onList] = await Promise.all([query.order('price').limit(LIMIT), listedIds(supabase)]);
  const [best, ...rest] = results ?? [];
  if (!best) return <p className="finder__empty">{t.empty}</p>;

  const add = (l) => <ListButton listing={l} onList={onList} t={t} />;
  const top = rest.at(-1)?.price ?? best.price;

  return (
    <div className="finder__results">
      <article className="finder__best">
        <div className="finder__best-body">
          <p className="finder__eyebrow">{t.cheapest}</p>
          <h2>{best.title}</h2>
          <p className="finder__where">
            <span className="finder__store">{COMPETITORS[best.competitor_key] ?? best.competitor_key}</span>
            {best.on_promo && <span className="badge" data-status="opportunity">{t.promo}</span>}
          </p>
        </div>
        <div className="finder__best-buy">
          <span className="finder__price">{formatPrice(best.price, lang)}</span>
          {add(best)}
        </div>
      </article>
      {rest.length > 0 && (
        <>
          <h2 className="finder__subhead">{t.others.replace('{count}', rest.length)}</h2>
          <ol className="finder__list finder__list--bars">
            {rest.map((l) => (
              <li key={l.id}>
                <span className="finder__title">{l.title}</span>
                <span className="finder__chain">{COMPETITORS[l.competitor_key] ?? l.competitor_key}</span>
                {l.on_promo && <span className="badge" data-status="opportunity">{t.promo}</span>}
                <span className="finder__bar" aria-hidden="true">
                  <span data-grow style={{ '--w': `${Math.max((l.price / top) * 100, 4)}%` }} />
                </span>
                <span className="finder__price">{formatPrice(l.price, lang)}</span>
                {add(l)}
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="finder__note">{t.note}</p>
    </div>
  );
}
