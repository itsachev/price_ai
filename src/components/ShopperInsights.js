import { COMPETITORS } from '@/lib/config';
import { formatPercent, formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { ListButton, listedIds } from './FinderResults';

// A price needs this many feed days before "buy now" or "wait" is said about it.
const MIN_DAYS = 14;
// How far from its usual price a product must be to count as a good or bad buy.
const MOVE = 0.05;
// A promo whose price is within this of the usual regular price isn't a deal.
const FAKE_BELOW = 0.02;
// Bigger cuts than this are feed errors (a 12 kg fillet "promo" at €0.58), not deals.
const MAX_DISCOUNT = 0.6;

const chain = (key) => COMPETITORS[key] ?? key;
const FIELDS = 'listing_id, competitor_key, title, price, regular_price, usual_price, discount, real_discount, vs_usual';

// /info with no search: today's best promos
// (fake ones dropped) and what is at a low or above its usual price. All read
// from the tables refresh_shopper_insights() rebuilds after each scrape.
export default async function ShopperInsights({ lang, t: info }) {
  const t = info.insights;
  const supabase = await createClient();
  const prices = () => supabase.from('shopper_prices').select(FIELDS);
  const [{ data: deals }, { data: lows }, { data: highs }, onList] = await Promise.all([
    prices()
      .eq('on_promo', true)
      .gt('discount', 0)
      .lte('discount', MAX_DISCOUNT)
      .or(`real_discount.is.null,and(real_discount.gte.${FAKE_BELOW},real_discount.lte.${MAX_DISCOUNT})`)
      .order('discount', { ascending: false })
      .limit(12),
    prices().gte('days', MIN_DAYS).eq('at_low', true).lte('vs_usual', -MOVE).order('vs_usual').limit(8),
    prices().gte('days', MIN_DAYS).eq('on_promo', false).gte('vs_usual', MOVE).order('vs_usual', { ascending: false }).limit(8),
    listedIds(supabase),
  ]);
  if (!deals?.length) return null;

  const row = (p, detail) => (
    <li key={p.listing_id}>
      <span className="finder__title">{p.title}</span>
      <span className="finder__chain">{chain(p.competitor_key)}</span>
      {detail}
      <span className="finder__price">{formatPrice(p.price, lang)}</span>
      <ListButton listing={{ id: p.listing_id, title: p.title }} onList={onList} t={info} />
    </li>
  );

  return (
    <div className="insights">
      <section className="insights__section">
        <header className="insights__head">
          <h2>{t.dealsTitle}</h2>
          <p className="finder__note">{t.dealsNote}</p>
        </header>
        <ol className="deals">
          {deals.map((p, i) => (
            <li key={p.listing_id} className="deal" style={{ '--i': i }}>
              <span className="deal__cut">−{formatPercent(p.discount, lang, 'never')}</span>
              <span className="deal__chain">{chain(p.competitor_key)}</span>
              <span className="deal__title">{p.title}</span>
              <span className="deal__prices">
                <strong className="finder__price">{formatPrice(p.price, lang)}</strong>
                {p.regular_price && <s className="finder__was">{formatPrice(p.regular_price, lang)}</s>}
              </span>
              <span className="deal__foot">
                {p.real_discount != null && <span className="badge" data-status="competitive" title={t.realHint}>{t.real}</span>}
                <ListButton listing={{ id: p.listing_id, title: p.title }} onList={onList} t={info} />
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="insights__pair">
        <section className="insights__section insights__panel" data-tone="buy">
          <h2>{t.buyTitle}</h2>
          {lows?.length ? (
            <ol className="finder__list">
              {lows.map((p) => row(p, <span className="badge" data-status="opportunity">{t.belowUsual.replace('{pct}', formatPercent(-p.vs_usual, lang, 'never'))}</span>))}
            </ol>
          ) : <p className="finder__note">{t.building}</p>}
        </section>

        <section className="insights__section insights__panel" data-tone="wait">
          <h2>{t.waitTitle}</h2>
          {highs?.length ? (
            <ol className="finder__list">
              {highs.map((p) => row(p, (
                <span className="badge" data-status="at-risk">
                  {t.usually.replace('{price}', formatPrice(p.usual_price, lang))}
                </span>
              )))}
            </ol>
          ) : <p className="finder__note">{t.waitEmpty}</p>}
        </section>
      </div>
    </div>
  );
}
