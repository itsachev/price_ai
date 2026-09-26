import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { applyPrice, deleteProduct, linkListing, saveProduct, unlinkListing } from '@/app/actions/products';
import ProductDialog from '@/components/ProductDialog';
import { DeleteForm, ProductForm } from '@/components/ProductForms';
import { COMPETITORS } from '@/lib/config';
import { formatPercent, formatPrice } from '@/lib/format';
import { matchConfig, suggestPrice } from '@/lib/pipeline/match';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../../../dictionaries';

// One product: what to do about its price first (the suggestion and possible
// matches), then the numbers behind it, the competitor listings and the
// merchant's own price history. Everything is read from stored results; no AI
// runs here.
const LISTING = 'id, competitor_key, title, price, on_promo, captured_at, url';
const HISTORY_ROWS = 12;

// Listings not seen within this window count as delisted.
const activeSince = (days) => new Date(Date.now() - days * 864e5).toISOString();

const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);

function check(...results) {
  for (const res of results) {
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
  }
}

export default async function ProductPage({ params, searchParams }) {
  const { id } = await params;
  const { notice } = await searchParams;
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.products;
  const p = t.page;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect(`/login?next=/dashboard/products/${id}`);
  if (!/^\d+$/.test(id)) notFound();

  const { activeDays, priceTolerance } = matchConfig();
  const since = activeSince(activeDays);

  const productRes = await supabase
    .from('products')
    .select('id, name, brand, size, sku, price, cost, price_status, match_key, updated_at')
    .eq('id', id)
    .maybeSingle();
  check(productRes);
  const product = productRes.data;
  if (!product) notFound();

  // A product with no match_key hasn't been matched yet, so it has no verdicts.
  const verdicts = (confirmed) =>
    product.match_key
      ? supabase
          .from('match_verdicts')
          .select(`confidence, reason, listing:competitor_listings!inner(${LISTING})`)
          .eq('match_key', product.match_key)
          .eq(confirmed ? 'confirmed' : 'possible', true)
          .gte('listing.captured_at', since)
      : { data: [] };

  const [overviewRes, confirmedRes, possibleRes, linksRes, ownHistoryRes] = await Promise.all([
    supabase.rpc('product_overview', { active_days: activeDays }).eq('id', id).maybeSingle(),
    verdicts(true),
    verdicts(false),
    supabase.from('product_links').select(`listing:competitor_listings!inner(${LISTING})`).eq('product_id', id),
    supabase
      .from('product_price_history')
      .select('price, recorded_at')
      .eq('product_id', id)
      .order('recorded_at', { ascending: false })
      .limit(HISTORY_ROWS),
  ]);
  check(overviewRes, confirmedRes, possibleRes, linksRes, ownHistoryRes);

  // Competitor listings that count: confirmed by Gemini, or linked by the merchant.
  const linked = new Set(linksRes.data.map((l) => l.listing.id));
  const matches = new Map();
  for (const v of confirmedRes.data) matches.set(v.listing.id, { ...v.listing, confidence: v.confidence });
  for (const { listing } of linksRes.data) {
    if (Date.parse(listing.captured_at) >= Date.parse(since) && !matches.has(listing.id)) matches.set(listing.id, { ...listing, linked: true });
  }
  const listings = [...matches.values()].sort((a, b) => a.price - b.price);
  const possible = possibleRes.data
    .map((v) => ({ ...v.listing, reason: v.reason, linked: linked.has(v.listing.id) }))
    .sort((a, b) => a.price - b.price);

  // Latest KZP day per matched listing: regular price, promo end, store count.
  const latest = new Map();
  if (listings.length) {
    const historyRes = await supabase
      .from('competitor_listing_price_history')
      .select('listing_id, regular_price, promo_ends_on, store_count')
      .in('listing_id', listings.map((l) => l.id))
      .gte('data_date', since.slice(0, 10))
      .order('data_date', { ascending: false });
    check(historyRes);
    for (const h of historyRes.data) if (!latest.has(h.listing_id)) latest.set(h.listing_id, h);
  }

  const o = overviewRes.data ?? {};
  const price = Number(product.price);
  const best = o.best_price == null ? null : Number(o.best_price);
  const bestChain = COMPETITORS[o.best_competitor] ?? o.best_competitor;
  const suggested = suggestPrice(price, best, priceTolerance);
  const bestListing = listings.find((l) => l.competitor_key === o.best_competitor && Number(l.price) === best);
  const promoEnds = bestListing && latest.get(bestListing.id)?.promo_ends_on;

  const date = (value, opts = { dateStyle: 'medium' }) =>
    new Intl.DateTimeFormat(lang === 'bg' ? 'bg-BG' : 'en-GB', opts).format(new Date(value));
  const money = (value) => formatPrice(value, lang);
  // Gross margin on the selling price; null until the merchant enters a cost.
  const cost = product.cost == null ? null : Number(product.cost);
  const margin = (at) => (cost == null ? null : { amount: at - cost, pct: formatPercent((at - cost) / at, lang, 'auto') });
  const current = margin(price);
  const atSuggested = suggested != null && margin(suggested);
  const history = ownHistoryRes.data;

  return (
    <article className="dash pd">
      <Link href="/dashboard/products" className="pd__back">← {p.back}</Link>

      <header className="dash__head">
        <div className="dash__title">
          <span className="badge" data-status={product.price_status}>{dict.status[product.price_status]}</span>
          <h1>{product.name}</h1>
          <p className="muted">
            {[product.brand, product.size, product.sku && `${t.fields.sku} ${product.sku}`].filter(Boolean).join(' · ') || p.noDetails}
          </p>
        </div>
        <div className="dash__actions">
          <ProductDialog key={product.updated_at} label={p.edit} title={t.editTitle} closeLabel={t.close} variant="primary">
            <ProductForm t={t} action={saveProduct} product={product} />
          </ProductDialog>
          <DeleteForm t={t} action={deleteProduct} id={product.id} />
        </div>
      </header>

      {t.notices[notice] && (
        <p className="form-message" role="status" data-kind="notice">{t.notices[notice]}</p>
      )}

      {/* Suggestions first: they're what the merchant came to act on. */}
      <section className="pd__ai" aria-labelledby="pd-ai">
        <h2 id="pd-ai"><span className="pd__ai-tag">AI</span> {p.aiTitle}</h2>

        {suggested != null ? (
          <div className="pd__advice" data-status={product.price_status}>
            <div className="pd__advice-text">
              <p className="pd__advice-head">
                {fill(product.price_status === 'at-risk' ? p.lower : p.raise, { price: money(suggested) })}
              </p>
              <p>
                {product.price_status === 'at-risk'
                  ? fill(p.lowerWhy, { chain: bestChain, best: money(best), gap: money(price - best), pct: formatPercent(Number(o.gap_ratio), lang, 'auto') })
                  : fill(p.raiseWhy, { chain: bestChain, best: money(best), gain: money(suggested - price) })}
              </p>
              {atSuggested && (
                <p className={atSuggested.amount < 0 ? 'pd__advice-note pd__advice-note--warn' : 'pd__advice-note'}>
                  {atSuggested.amount < 0
                    ? fill(p.belowCost, { price: money(suggested), cost: money(cost), loss: money(-atSuggested.amount) })
                    : fill(p.marginAt, { price: money(suggested), pct: atSuggested.pct, amount: money(atSuggested.amount) })}
                </p>
              )}
              {o.best_on_promo && (
                <p className="pd__advice-note">
                  {promoEnds ? fill(p.promoUntil, { date: date(promoEnds) }) : p.promo}
                </p>
              )}
            </div>
            <div className="pd__advice-act">
              <p className="pd__advice-price num">
                <s>{money(price)}</s> <strong>{money(suggested)}</strong>
              </p>
              <form action={applyPrice}>
                <input type="hidden" name="id" value={product.id} />
                <input type="hidden" name="price" value={suggested} />
                <button className="button button--primary">{fill(p.apply, { price: money(suggested) })}</button>
              </form>
            </div>
          </div>
        ) : (
          <p className="pd__advice pd__advice--quiet">
            {best != null ? fill(p.competitive, { chain: bestChain, best: money(best) }) : possible.length ? p.reviewMatches : p.nothing}
          </p>
        )}

        {possible.length > 0 && (
          <section className="suggest" aria-labelledby="suggest-title">
            <h3 id="suggest-title">{t.suggest.title}</h3>
            <p className="muted">{t.suggest.help}</p>
            <ul className="suggest__list">
              {possible.map((l) => (
                <li key={l.id} className="suggest__item" data-linked={l.linked || undefined}>
                  <div className="suggest__text">
                    <span className="suggest__chain">{COMPETITORS[l.competitor_key] ?? l.competitor_key}</span>
                    <span className="suggest__title">{l.title}</span>
                    {l.reason && <small className="muted">{l.reason}</small>}
                  </div>
                  <span className="suggest__price num">
                    {money(l.price)}
                    {l.on_promo && <span className="dash__promo">{dict.dashboard.promo}</span>}
                  </span>
                  <form action={l.linked ? unlinkListing : linkListing}>
                    <input type="hidden" name="product_id" value={product.id} />
                    <input type="hidden" name="listing_id" value={l.id} />
                    <button className={l.linked ? 'button' : 'button button--primary'}>
                      {l.linked ? t.suggest.unlink : t.suggest.link}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>

      <dl className="pd__stats">
        <div>
          <dt>{p.yourPrice}</dt>
          <dd className="num">{money(price)}</dd>
        </div>
        <div>
          <dt>{p.margin}</dt>
          <dd className="num">{current ? current.pct : '—'}</dd>
          <small>{current ? fill(p.marginPer, { amount: money(current.amount) }) : p.noCost}</small>
        </div>
        <div>
          <dt>{p.cheapest}</dt>
          <dd className="num">{best != null ? money(best) : '—'}</dd>
          {best != null && <small>{bestChain}{o.best_on_promo && ` · ${dict.dashboard.promo}`}</small>}
        </div>
        <div data-status={product.price_status}>
          <dt>{p.gap}</dt>
          <dd className="num pd__gap">
            {o.gap != null ? `${o.gap > 0 ? '+' : o.gap < 0 ? '−' : ''}${money(Math.abs(o.gap))}` : '—'}
          </dd>
          {o.gap_ratio != null && <small>{formatPercent(Number(o.gap_ratio), lang)}</small>}
        </div>
        <div>
          <dt>{p.chains}</dt>
          <dd className="num">{o.chain_count ?? 0}</dd>
          <small>{fill(p.listings, { n: listings.length })}</small>
        </div>
      </dl>

      <section className="dash__panel" aria-labelledby="pd-listings">
        <div className="dash__panel-head">
          <h2 id="pd-listings">{p.listingsTitle}</h2>
        </div>
        {listings.length === 0 ? (
          <div className="dash__empty">
            <p className="muted">{product.match_key ? p.noListings : p.pending}</p>
          </div>
        ) : (
          <table className="dash__table">
            <thead>
              <tr>
                <th scope="col">{p.cols.listing}</th>
                <th scope="col" className="num">{p.cols.price}</th>
                <th scope="col" className="num">{p.cols.diff}</th>
                <th scope="col">{p.cols.source}</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => {
                const h = latest.get(l.id);
                const diff = price - Number(l.price);
                return (
                  <tr key={l.id}>
                    <th scope="row" className="dash__product">
                      <small>{COMPETITORS[l.competitor_key] ?? l.competitor_key}</small>
                      {l.url ? <a href={l.url} target="_blank" rel="noreferrer">{l.title}</a> : l.title}
                      {h?.store_count > 0 && <small>{fill(p.stores, { n: h.store_count })}</small>}
                    </th>
                    <td className="num" data-label={p.cols.price}>
                      <span className="num">{money(l.price)}</span>
                      {l.on_promo && <span className="dash__promo">{dict.dashboard.promo}</span>}
                      {l.on_promo && h?.regular_price > l.price && <small>{fill(p.was, { price: money(h.regular_price) })}</small>}
                      {l.on_promo && h?.promo_ends_on && <small>{fill(p.until, { date: date(h.promo_ends_on) })}</small>}
                    </td>
                    <td className="num" data-label={p.cols.diff}>
                      {diff > 0 ? '+' : diff < 0 ? '−' : ''}
                      {money(Math.abs(diff))}
                    </td>
                    <td data-label={p.cols.source}>
                      {l.linked ? p.linked : fill(p.confirmed, { pct: formatPercent(l.confidence ?? 1, lang, 'auto') })}
                      <small>{fill(p.seen, { date: date(l.captured_at) })}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {history.length > 0 && (
        <section className="dash__panel" aria-labelledby="pd-history">
          <div className="dash__panel-head">
            <h2 id="pd-history">{p.historyTitle}</h2>
          </div>
          <ol className="pd__history">
            {history.map((h, i) => {
              const prev = history[i + 1];
              const change = prev ? Number(h.price) - Number(prev.price) : null;
              return (
                <li key={h.recorded_at}>
                  <time dateTime={h.recorded_at}>{date(h.recorded_at, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  <span className="num">
                    {money(h.price)}
                    {change ? <small>{change > 0 ? '+' : '−'}{money(Math.abs(change))}</small> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </article>
  );
}
