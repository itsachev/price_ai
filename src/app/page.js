import { Fragment } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import ButtonLabel from '@/components/ButtonLabel';
import HomeMotion from '@/components/HomeMotion';
import PriceTrend from '@/components/PriceTrend';
import ShelfTag from '@/components/ShelfTag';
import { hasSession } from '@/lib/auth';
import { COMPETITORS, SITE_URL } from '@/lib/config';
import { formatPercent, formatPrice } from '@/lib/format';
import { matchConfig, priceStatus, suggestPrice } from '@/lib/pipeline/match';
import { getDictionary, getLocale } from './dictionaries';

// Everything below is an illustrative sample catalog, labelled "Example data"
// on the page, never real merchant or chain data. Statuses and suggested
// prices come from the real pricing logic (priceStatus, suggestPrice).

// Hero tag: one product per verdict.
const TAGS = [
  { name: 'Яйца M, 10 бр.', sku: 'SKU-2210', yours: 4.99, rivals: [['kaufland', 4.39], ['lidl', 4.2], ['fantastico', 4.59]] },
  { name: 'Кашкавал Витоша, 400 г', sku: 'SKU-0815', yours: 6.49, rivals: [['billa', 7.19], ['kaufland', 7.29], ['tmarket', 7.49]] },
  { name: 'Слънчогледово олио, 1 л', sku: 'SKU-0307', yours: 3.49, rivals: [['kaufland', 3.45], ['lidl', 3.55], ['billa', 3.59]] },
];

// Pipeline story: one product and the listings the nightly run sees.
// role: same (confirmed match), different (shortlisted, rejected by AI), drop (never shortlisted).
const PIPE = {
  name: 'Кисело мляко Верея 2%, 400 г',
  yours: 1.49,
  feed: [
    ['kaufland', 'Кисело мляко Верея 2% 400г', 1.42, 'same'],
    ['lidl', 'Pilos кисело мляко 3,6% 400 г', 1.19, 'drop'],
    ['billa', 'Верея кисело мляко 2 % 400 g', 1.4, 'same'],
    ['fantastico', 'Кисело мляко Верея 3,6% 400 г', 1.49, 'different'],
    ['tmarket', 'Прясно мляко Верея 2% 1 л', 2.39, 'drop'],
    ['metro', 'Верея кисело мляко 2% 400 г', 1.44, 'same'],
  ],
};

// Six months, April to September 2026.
const TREND = { yours: [1.29, 1.29, 1.32, 1.35, 1.35, 1.38], market: [1.35, 1.34, 1.33, 1.34, 1.36, 1.3] };

// Dashboard sample, sorted the way the dashboard sorts: most urgent first.
const ROWS = [
  { name: 'Яйца M, 10 бр.', cat: 'dairy', yours: 4.99, best: 4.2, status: 'at-risk' },
  { name: 'Прясно мляко 3,2%, 1 л', cat: 'dairy', yours: 2.29, best: 2.15, status: 'at-risk' },
  { name: 'Кашкавал Витоша, 400 г', cat: 'dairy', yours: 6.49, best: 7.19, status: 'opportunity' },
  { name: 'Пшеничен хляб, 650 г', cat: 'bakery', yours: 1.49, best: 1.59, status: 'opportunity' },
  { name: 'Слънчогледово олио, 1 л', cat: 'pantry', yours: 3.49, best: 3.45, status: 'competitive' },
  { name: 'Кисело мляко БДС, 400 г', cat: 'dairy', yours: 1.35, best: 1.38, status: 'competitive' },
  { name: 'Брашно тип 500, 1 кг', cat: 'pantry', yours: 1.19, best: null, status: 'unmatched' },
];

// Interface icons: Solar by 480 Design (CC BY 4.0, https://creativecommons.org/licenses/by/4.0/),
// from Iconify (https://icon-sets.iconify.design/solar/). Inlined, so no outside origin.
const ICONS = {
  tag: (
    <>
      <path d="M4.72848 16.1369C3.18295 14.5914 2.41018 13.8186 2.12264 12.816C1.83509 11.8134 2.08083 10.7485 2.57231 8.61875L2.85574 7.39057C3.26922 5.59881 3.47597 4.70292 4.08944 4.08944C4.70292 3.47597 5.5988 3.26922 7.39057 2.85574L8.61875 2.57231C10.7485 2.08083 11.8134 1.83509 12.816 2.12264C13.8186 2.41018 14.5914 3.18295 16.1369 4.72848L17.9665 6.55812C20.6555 9.24711 22 10.5916 22 12.2623C22 13.933 20.6555 15.2775 17.9665 17.9665C15.2775 20.6555 13.933 22 12.2623 22C10.5916 22 9.24711 20.6555 6.55812 17.9665L4.72848 16.1369Z" />
      <path d="M15.3893 15.3891C15.9751 14.8033 16.0542 13.9327 15.5661 13.4445C15.0779 12.9564 14.2073 13.0355 13.6215 13.6213C13.0358 14.2071 12.1652 14.2863 11.677 13.7981C11.1888 13.3099 11.268 12.4393 11.8538 11.8536M15.3893 15.3891L15.7429 15.7426M15.3893 15.3891C14.9883 15.7901 14.4539 15.9537 14 15.8604M11.5002 11.5L11.8538 11.8536M11.8538 11.8536C12.185 11.5223 12.6073 11.3531 13 11.3568" />
      <circle cx="8.607" cy="8.879" r="2" transform="rotate(-45 8.607 8.879)" />
    </>
  ),
  rules: (
    <>
      <path d="M9.5 14C11.1569 14 12.5 15.3431 12.5 17C12.5 18.6568 11.1569 20 9.5 20C7.84315 20 6.5 18.6568 6.5 17C6.5 15.3431 7.84315 14 9.5 14Z" />
      <path d="M14.5 3.99998C12.8431 3.99998 11.5 5.34312 11.5 6.99998C11.5 8.65683 12.8431 9.99998 14.5 9.99998C16.1569 9.99998 17.5 8.65683 17.5 6.99998C17.5 5.34312 16.1569 3.99998 14.5 3.99998Z" />
      <path d="M15 16.9585L22 16.9585" />
      <path d="M9 6.9585L2 6.9585" />
      <path d="M2 16.9585L4 16.9585" />
      <path d="M22 6.9585L20 6.9585" />
    </>
  ),
  bell: (
    <>
      <path d="M18.7491 9.70957V9.00496C18.7491 5.13623 15.7274 2 12 2C8.27256 2 5.25087 5.13623 5.25087 9.00496V9.70957C5.25087 10.5552 5.00972 11.3818 4.5578 12.0854L3.45036 13.8095C2.43882 15.3843 3.21105 17.5249 4.97036 18.0229C9.57274 19.3257 14.4273 19.3257 19.0296 18.0229C20.789 17.5249 21.5612 15.3843 20.5496 13.8095L19.4422 12.0854C18.9903 11.3818 18.7491 10.5552 18.7491 9.70957Z" />
      <path d="M7.5 19C8.15503 20.7478 9.92246 22 12 22C14.0775 22 15.845 20.7478 16.5 19" />
    </>
  ),
  transfer: (
    <>
      <path d="M10 4L10 20L4 14.5" />
      <path d="M14 20L14 4L20 9.5" />
    </>
  ),
  history: (
    <>
      <path d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z" />
      <path d="M7 14L9.29289 11.7071C9.68342 11.3166 10.3166 11.3166 10.7071 11.7071L12.2929 13.2929C12.6834 13.6834 13.3166 13.6834 13.7071 13.2929L17 10M14.5 10H17V12.5" />
    </>
  ),
  same: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8.5 12.5L10.5 14.5L15.5 9.5" />
    </>
  ),
  different: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M14.5 9.50002L9.5 14.5M9.49998 9.5L14.5 14.5" />
    </>
  ),
};
const FEATURE_ICONS = ['tag', 'rules', 'bell', 'transfer', 'history'];

const Icon = ({ name }) => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>
);

const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);

export const metadata = { alternates: { canonical: '/' } };

export default async function HomePage() {
  const lang = await getLocale();
  const { home, meta } = await getDictionary(lang);
  const price = (v) => formatPrice(v, lang);
  const pct = (v) => formatPercent(v, lang);
  const chainCount = Object.keys(COMPETITORS).length;
  const { priceTolerance } = matchConfig();
  // Cookie read only, no network call (the root layout already does the same).
  const signedIn = await hasSession(await cookies());

  // A product's verdict, worded the way the product page words it.
  const verdict = (yours, rivals) => {
    const cheapest = rivals.reduce((a, b) => (b[1] < a[1] ? b : a));
    const status = priceStatus(yours, rivals.map(([, p]) => p), priceTolerance);
    const next = suggestPrice(yours, cheapest[1], priceTolerance);
    const action = { 'at-risk': home.tag.lower, opportunity: home.tag.raise }[status] ?? home.tag.hold;
    return {
      status,
      statusName: home.status[status].name,
      verdict: fill(action, { price: next && price(next.price) }),
      why: fill(home.tag.why[status], {
        chain: COMPETITORS[cheapest[0]],
        pct: formatPercent(Math.abs((yours - cheapest[1]) / cheapest[1]), lang, 'auto'),
      }),
      cheapest: cheapest[0],
    };
  };

  const tags = TAGS.map(({ name, sku, yours, rivals }) => {
    const v = verdict(yours, rivals);
    return {
      name, sku, price: price(yours), ...v,
      rows: rivals.map(([key, p]) => ({ chain: COMPETITORS[key], price: price(p), delta: pct((p - yours) / yours), cheapest: key === v.cheapest })),
    };
  });
  const pipe = verdict(PIPE.yours, PIPE.feed.filter((l) => l[3] === 'same').map(([key, , p]) => [key, p]));

  // Long name cut to 3 letters: Bulgarian 'short' months are numeric ("04").
  const months = TREND.yours.map((_, i) => new Date(2026, 3 + i, 1).toLocaleString(lang, { month: 'long' }).slice(0, 3));
  const count = (s) => ROWS.filter((r) => r.status === s).length;
  // Global word index across lines drives the staggered CSS reveal.
  const titleLines = home.title.map((line) => line.split(' '));
  const lineStart = titleLines.map((_, i) => titleLines.slice(0, i).flat().length);

  // Structured data for search results. `<` is escaped so the JSON can't close the script tag.
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${SITE_URL}/#org`, name: 'PriceAI', url: SITE_URL },
      {
        '@type': 'WebSite', '@id': `${SITE_URL}/#site`, name: 'PriceAI', url: SITE_URL,
        inLanguage: lang, publisher: { '@id': `${SITE_URL}/#org` },
      },
      {
        '@type': 'SoftwareApplication', name: 'PriceAI', url: SITE_URL,
        applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
        description: meta.description, inLanguage: lang, areaServed: 'BG',
        publisher: { '@id': `${SITE_URL}/#org` },
      },
    ],
  }).replace(/</g, '\\u003c');

  const start = signedIn ? (
    <Link href="/dashboard" className="button button--signal">
      <ButtonLabel>{home.cta}</ButtonLabel>
    </Link>
  ) : (
    <Link href="/signup" className="button button--signal">
      <ButtonLabel hover={home.final.signupHover}>{home.final.signup}</ButtonLabel>
    </Link>
  );

  return (
    <HomeMotion>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      {/* Hero: server-rendered and complete; CSS runs the entrance, so first paint never waits on JS. */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__copy">
          <h1 id="hero-title" className="hero__title">
            {titleLines.map((line, i) => (
              <span key={i} className="line">
                {line.map((w, j) => (
                  <Fragment key={j}>
                    <span className="word-mask">
                      <span className="word" style={{ '--i': lineStart[i] + j }}>{w}</span>
                    </span>{' '}
                  </Fragment>
                ))}
              </span>
            ))}
          </h1>
          <p className="lead">{fill(home.lead, { count: chainCount })}</p>
          <div className="actions">
            {start}
            <a href="#how" className="button button--quiet"><ButtonLabel>{home.ctaSecondary}</ButtonLabel></a>
          </div>
          <ul className="trust">
            {home.trust.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
        <div className="hero__visual">
          <ShelfTag products={tags} t={home.tag} />
          <p className="note">{home.example}</p>
        </div>
      </section>

      {/* The shelf edge: every chain whose prices we read. */}
      <section className="rail" aria-labelledby="rail-title">
        <h2 id="rail-title" className="rail__title">{fill(home.chains.title, { count: chainCount })}</h2>
        <ul className="rail__chains">
          {Object.values(COMPETITORS).map((name) => <li key={name}>{name}</li>)}
        </ul>
      </section>

      <section id="how" className="section how" aria-labelledby="how-title">
        <header className="home-head">
          <h2 id="how-title" data-split>{home.how.title}</h2>
          <p className="muted">{home.how.text}</p>
        </header>
        <div className="how__body">
          <ol className="how__steps">
            {home.how.steps.map((step, i) => (
              <li key={step.title}>
                <span className="how__num" aria-hidden="true">{i + 1}</span>
                <h3>{step.title}</h3>
                <p className="muted">{step.text}</p>
              </li>
            ))}
          </ol>
          <figure className="pipe" data-step={home.how.steps.length} aria-label={home.how.visual.label}>
            <p className="pipe__yours">
              <small>{home.how.visual.yours}</small>
              <strong>{PIPE.name}</strong>
              <span>{price(PIPE.yours)}</span>
            </p>
            <p className="pipe__caption">{home.how.visual.feed}</p>
            <ul className="pipe__feed">
              {PIPE.feed.map(([key, title, p, role], i) => (
                <li key={key + title} data-role={role} style={{ '--i': i }}>
                  <span className="pipe__chain">{COMPETITORS[key]}</span>
                  <span className="pipe__title">{title}</span>
                  <strong>{price(p)}</strong>
                  <span className="pipe__mark">
                    {role !== 'drop' && (
                      <>
                        <Icon name={role} />
                        <span className="visually-hidden">{home.how.visual[role]}</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="pipe__verdict" data-status={pipe.status}>
              <span className="badge" data-status={pipe.status}>{pipe.statusName}</span>
              <strong>{pipe.verdict}</strong>
              <small>{pipe.why}</small>
              <span className="pipe__apply" aria-hidden="true">{home.how.visual.apply}</span>
            </p>
            <figcaption className="note">{home.example}</figcaption>
          </figure>
        </div>
      </section>

      <section className="section features" aria-labelledby="features-title">
        <header className="home-head">
          <h2 id="features-title" data-split>{home.features.title}</h2>
          <p className="muted">{home.features.text}</p>
        </header>
        <div className="features__body">
          <ul className="features__list">
            {home.features.items.map((f, i) => (
              <li key={f.title}>
                <Icon name={FEATURE_ICONS[i]} />
                <h3>{f.title}</h3>
                <p className="muted">{f.text}</p>
              </li>
            ))}
          </ul>
          <PriceTrend
            t={home.features.chart}
            product={PIPE.name}
            yours={TREND.yours}
            market={TREND.market}
            xLabels={months}
            money={price}
            pct={pct}
          />
        </div>
      </section>

      <section className="section" aria-labelledby="tracker-title">
        <header className="home-head">
          <h2 id="tracker-title" data-split>{home.tracker.title}</h2>
          <p className="muted">{home.tracker.text}</p>
        </header>
        <div className="tracker card">
          <div className="tracker__head">
            <h3>{home.tracker.card}</h3>
            <p className="muted">{fill(home.tracker.live, { count: chainCount })}</p>
          </div>
          <dl className="tracker__counts">
            <div><dt>{home.tracker.total}</dt><dd>{ROWS.length}</dd></div>
            {['at-risk', 'opportunity', 'unmatched'].map((s) => (
              <div key={s} data-status={s}><dt>{home.status[s].name}</dt><dd>{count(s)}</dd></div>
            ))}
          </dl>
          <table>
            <thead>
              <tr>
                {Object.values(home.tracker.cols).map((c) => <th key={c} scope="col">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const d = r.best ? (r.yours - r.best) / r.best : null;
                return (
                  <tr key={r.name}>
                    <th scope="row">
                      {r.name}
                      <small>{home.tracker.categories[r.cat]}</small>
                    </th>
                    <td data-label={home.tracker.cols.yours}>{price(r.yours)}</td>
                    <td data-label={home.tracker.cols.best} className="muted">{r.best ? price(r.best) : '—'}</td>
                    <td data-label={home.tracker.cols.delta} className="tracker__delta" data-dir={d > 0 ? 'up' : d < 0 ? 'down' : undefined}>
                      {d === null ? '—' : pct(d)}
                    </td>
                    <td data-label={home.tracker.cols.status}>
                      <span className="badge" data-status={r.status}>{home.status[r.status].name}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="note">{home.example}</p>
        </div>
      </section>

      <section className="section cta" aria-labelledby="cta-title">
        <h2 id="cta-title" data-split>{home.final.title}</h2>
        <p>{home.final.text}</p>
        <div className="actions">
          {start}
          {!signedIn && (
            <>
              <span className="cta__or">{home.final.or}</span>
              <Link href="/login" className="button cta__ghost">
                <ButtonLabel>{home.final.login}</ButtonLabel>
              </Link>
            </>
          )}
        </div>
        <ul className="cta__points">
          {home.final.points.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </section>
    </HomeMotion>
  );
}
