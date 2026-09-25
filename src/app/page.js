import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { COMPETITORS, PRICE_STATUSES } from '@/lib/config';
import { formatPercent, formatPrice } from '@/lib/format';
import { getDictionary, getLocale } from './dictionaries';

// Illustrative sample catalog for the home page, not real data.
// Swap for stored Supabase results once the pipeline is connected.
const SCAN = { product: 'Кисело мляко Верея 2%, 400 г', sku: 'SKU-1042', yours: 1.35, rivals: [['kaufland', 1.42], ['lidl', 1.45], ['billa', 1.4]] };

const ROWS = [
  { name: 'Прясно мляко 3,2%, 1 л', cat: 'dairy', yours: 2.29, best: 2.15, status: 'at-risk' },
  { name: 'Пшеничен хляб, 650 г', cat: 'bakery', yours: 1.49, best: 1.59, status: 'opportunity' },
  { name: 'Кисело мляко БДС, 400 г', cat: 'dairy', yours: 1.35, best: 1.38, status: 'competitive' },
  { name: 'Слънчогледово олио, 1 л', cat: 'pantry', yours: 3.49, best: 3.45, status: 'competitive' },
  { name: 'Кашкавал Витоша, 400 г', cat: 'dairy', yours: 6.49, best: 7.19, status: 'opportunity' },
  { name: 'Яйца M, 10 бр.', cat: 'dairy', yours: 4.99, best: 4.2, status: 'at-risk' },
  { name: 'Брашно тип 500, 1 кг', cat: 'pantry', yours: 1.19, best: null, status: 'unmatched' },
];
const CATEGORIES = ['dairy', 'bakery', 'pantry'];

// Six months, April to September 2026.
const TREND = { yours: [1.29, 1.29, 1.32, 1.35, 1.35, 1.38], market: [1.35, 1.34, 1.33, 1.34, 1.36, 1.3] };
const TREND_TICKS = [1.25, 1.29, 1.34, 1.38, 1.42];

const MATCHES = [['billa', 45], ['kaufland', 42], ['lidl', 37], ['fantastico', 31], ['metro', 28], ['hitmax', 24]];

const ICONS = [
  'M4 12h4l3-8 4 16 3-8h2', // pulse: AI matching
  'M4 6h16M4 12h10M4 18h6', // statuses
  'M12 3v4M12 17v4M3 12h4M17 12h4M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0', // daily scan
  'M4 19V5M4 19h16M8 15l4-4 3 3 5-6', // history
  'M6 3h9l3 3v15H6zM9 11h6M9 15h6', // reports
  'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3 12h18M12 3c3 3 3 15 0 18', // EN/BG + EUR
];

const delta = (row) => (row.best ? (row.yours - row.best) / row.best : null);
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);

// Chart coordinates in percent of the plot area.
const [LO, HI] = [TREND_TICKS[0], TREND_TICKS.at(-1)];
const yPct = (v) => ((HI - v) / (HI - LO)) * 100;
const xPct = (i) => (i / (TREND.yours.length - 1)) * 100;
const points = (series) => series.map((v, i) => `${xPct(i)},${yPct(v)}`).join(' ');

export default async function HomePage() {
  const lang = await getLocale();
  const { home } = await getDictionary(lang);
  const price = (v) => formatPrice(v, lang);
  const pct = (v) => formatPercent(v, lang);
  const chainCount = Object.keys(COMPETITORS).length;

  const market = SCAN.rivals.reduce((sum, [, p]) => sum + p, 0) / SCAN.rivals.length;
  const count = (s) => ROWS.filter((r) => r.status === s).length;
  // Long name cut to 3 letters: Bulgarian 'short' months are numeric ("04").
  const months = TREND.yours.map((_, i) => new Date(2026, 3 + i, 1).toLocaleString(lang, { month: 'long' }).slice(0, 3));
  const [nowYours, nowMarket] = [TREND.yours.at(-1), TREND.market.at(-1)];
  const topRisk = ROWS.filter((r) => r.status === 'at-risk').sort((a, b) => delta(b) - delta(a));
  const topOpp = ROWS.filter((r) => r.status === 'opportunity').sort((a, b) => delta(a) - delta(b));
  const maxMatches = MATCHES[0][1];
  // Global word index across lines drives the staggered CSS reveal.
  const titleLines = home.title.map((line) => line.split(' '));
  const lineStart = titleLines.map((_, i) => titleLines.slice(0, i).flat().length);

  return (
    <Reveal className="home">
      {/* Hero: no JS reveal here, so first paint is never held back. */}
      <section className="hero">
        <div className="hero__copy stack">
          <p className="pill">
            <span className="pill__dot" aria-hidden="true" />
            {home.eyebrow}
          </p>
          <h1 className="hero__title">
            {titleLines.map((line, i) => {
              const words = line.map((w, j) => (
                <span key={j} className="word-mask">
                  <span className="word" style={{ '--i': lineStart[i] + j }}>{w}</span>{' '}
                </span>
              ));
              return i === titleLines.length - 1 ? <em key={i}>{words}</em> : <span key={i} className="line">{words}</span>;
            })}
          </h1>
          <p className="lead">{fill(home.lead, { count: chainCount })}</p>
          <div className="actions">
            <Link href="/dashboard" className="button button--primary">
              {home.cta} <span aria-hidden="true">→</span>
            </Link>
            <a href="#how" className="button">{home.ctaSecondary}</a>
          </div>
          <ul className="trust">
            {home.trust.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>

        <figure className="scan card" aria-label={home.scan.label}>
          <div className="scan__bar">
            <span className="scan__dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="scan__url">priceai.bg/scan</span>
            <span className="scan__live">{home.scan.live}</span>
          </div>
          <div className="scan__product">
            <span className="stack">
              <small>{home.scan.product}</small>
              <strong>{SCAN.product}</strong>
            </span>
            <code>{SCAN.sku}</code>
          </div>
          <p className="scan__summary">
            <span>{home.scan.compare}</span>
            <span className="badge" data-status="competitive">
              {fill(home.scan.below, { pct: formatPercent(Math.abs((SCAN.yours - market) / market), lang, 'auto') })}
            </span>
          </p>
          <ul className="scan__rows">
            {SCAN.rivals.map(([key, p], i) => (
              <li key={key} style={{ '--i': i }}>
                <span className="scan__logo" aria-hidden="true">{COMPETITORS[key][0]}</span>
                <span>{COMPETITORS[key]}</span>
                <strong>{price(p)}</strong>
                <span className="scan__delta">{pct((p - SCAN.yours) / SCAN.yours)}</span>
              </li>
            ))}
            <li className="scan__yours" style={{ '--i': SCAN.rivals.length }}>
              <span className="scan__logo" aria-hidden="true">★</span>
              <span>{home.scan.yours}</span>
              <strong>{price(SCAN.yours)}</strong>
              <span className="scan__delta">{home.scan.best}</span>
            </li>
          </ul>
          <p className="scan__ai">
            <strong>{home.scan.aiLabel}</strong> {fill(home.scan.ai, { price: price(SCAN.yours) })}
          </p>
          <figcaption className="note">{home.example}</figcaption>
        </figure>
      </section>

      <section className="chain-strip" aria-labelledby="chains-title" data-reveal>
        <h2 id="chains-title" className="chain-strip__title">{home.chains.title}</h2>
        <ul className="chains">
          {Object.values(COMPETITORS).map((name) => <li key={name}>{name}</li>)}
        </ul>
      </section>

      <dl className="stats section">
        {[
          [chainCount, '', home.stats.chains],
          [100, '+', home.stats.basket],
          ['07:00', '', home.stats.fresh],
          [PRICE_STATUSES.length, '', home.stats.statuses],
        ].map(([value, suffix, label]) => (
          <div key={label} className="card" data-reveal>
            <dt>{label}</dt>
            <dd>
              <span data-count={typeof value === 'number' ? value : undefined}>{value}</span>
              {suffix}
            </dd>
          </div>
        ))}
      </dl>

      <section className="section stack" aria-labelledby="features-title">
        <header className="section-head" data-reveal>
          <p className="eyebrow">{home.features.eyebrow}</p>
          <h2 id="features-title">{home.features.title}</h2>
          <p className="muted">{home.features.text}</p>
        </header>
        <ul className="features">
          {home.features.items.map((f, i) => (
            <li key={f.title} className="card feature" data-reveal>
              <svg className="feature__icon" viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[i]} /></svg>
              <h3>{f.title}</h3>
              <p className="muted">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section stack" aria-labelledby="tracker-title">
        <header className="section-head" data-reveal>
          <p className="eyebrow">{home.tracker.eyebrow}</p>
          <h2 id="tracker-title">{home.tracker.title}</h2>
          <p className="muted">{home.tracker.text}</p>
        </header>
        <div className="tracker card" data-reveal>
          <div className="tracker__head">
            <h3>{home.tracker.card}</h3>
            <p className="muted">{fill(home.tracker.live, { count: chainCount })}</p>
          </div>
          <dl className="tracker__counts">
            <div><dt>{home.tracker.total}</dt><dd>{ROWS.length}</dd></div>
            {['opportunity', 'at-risk', 'unmatched'].map((s) => (
              <div key={s} data-status={s}><dt>{home.status[s].name}</dt><dd>{count(s)}</dd></div>
            ))}
          </dl>
          <fieldset className="chips">
            <legend className="visually-hidden">{home.tracker.filter}</legend>
            {['all', ...CATEGORIES].map((c) => (
              <label key={c}>
                <input type="radio" name="cat" value={c} defaultChecked={c === 'all'} />
                {c === 'all' ? home.tracker.all : home.tracker.categories[c]}
              </label>
            ))}
          </fieldset>
          <table>
            <thead>
              <tr>
                {Object.values(home.tracker.cols).map((c) => <th key={c} scope="col">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const d = delta(r);
                return (
                  <tr key={r.name} data-cat={r.cat}>
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

      <section className="section stack" aria-labelledby="insights-title">
        <header className="section-head" data-reveal>
          <p className="eyebrow">{home.insights.eyebrow}</p>
          <h2 id="insights-title">{home.insights.title}</h2>
          <p className="muted">{home.insights.text}</p>
        </header>
        <div className="insights">
          <figure className="chart card" data-reveal>
            <figcaption className="chart__head">
              <span className="stack">
                <strong>{home.insights.chart.title}</strong>
                <span>{SCAN.product}</span>
                <small>{home.insights.chart.subtitle}</small>
              </span>
              <span className="chart__legend">
                <span data-series="yours">{home.insights.chart.yours}</span>
                <span data-series="market">{home.insights.chart.market}</span>
              </span>
            </figcaption>
            <div className="chart__area" role="img" aria-label={fill(home.insights.chart.label, { yours: price(nowYours), market: price(nowMarket) })}>
              {TREND_TICKS.map((t) => (
                <span key={t} className="chart__tick" style={{ '--y': `${yPct(t)}%` }}>{price(t)}</span>
              ))}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline data-series="market" points={points(TREND.market)} />
                <polyline data-series="yours" points={points(TREND.yours)} />
              </svg>
              {['market', 'yours'].map((s) =>
                TREND[s].map((v, i) => (
                  <span key={s + i} className="chart__dot" data-series={s} style={{ '--x': `${xPct(i)}%`, '--y': `${yPct(v)}%` }} />
                ))
              )}
            </div>
            <ol className="chart__x" aria-hidden="true">
              {months.map((m) => <li key={m}>{m}</li>)}
            </ol>
            <dl className="chart__foot">
              <div><dt>{home.insights.chart.current}</dt><dd>{price(nowYours)}</dd></div>
              <div data-series="market"><dt>{home.insights.chart.market}</dt><dd>{price(nowMarket)}</dd></div>
              <div data-status="at-risk"><dt>{home.insights.chart.delta}</dt><dd>{pct((nowYours - nowMarket) / nowMarket)}</dd></div>
            </dl>
          </figure>

          <div className="stack insight-list">
            <div className="insight-list__head" data-reveal>
              <h3>{home.insights.heading}</h3>
              <p className="muted">{home.insights.sub}</p>
            </div>
            {home.insights.items.map((item, i) => (
              <article key={item.title} className="card insight" data-status={['at-risk', 'competitive', 'unmatched'][i]} data-reveal>
                <h4>{item.title}</h4>
                <p className="muted">
                  {fill(item.text, {
                    product: SCAN.product,
                    pct: pct((nowYours - nowMarket) / nowMarket),
                    price: price(nowMarket + 0.04),
                    match: price(9.79),
                    chain: COMPETITORS.hitmax,
                    count: count('unmatched'),
                  })}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section stack" aria-labelledby="reports-title">
        <header className="section-head" data-reveal>
          <p className="eyebrow">{home.reports.eyebrow}</p>
          <h2 id="reports-title">{home.reports.title}</h2>
          <p className="muted">{home.reports.text}</p>
        </header>
        <div className="reports">
          {[
            ['at-risk', home.reports.atRisk, topRisk],
            ['opportunity', home.reports.opportunity, topOpp],
          ].map(([status, title, rows]) => (
            <article key={status} className="card report" data-status={status} data-reveal>
              <h3>{title}</h3>
              <ol>
                {rows.map((r) => (
                  <li key={r.name}>
                    <span>{r.name}</span>
                    <strong>{pct(delta(r))}</strong>
                  </li>
                ))}
              </ol>
            </article>
          ))}
          <article className="card report" data-reveal>
            <h3>{home.reports.byChain}</h3>
            <ul className="report__bars">
              {MATCHES.map(([key, n]) => (
                <li key={key} style={{ '--w': n / maxMatches }}>
                  <span>{COMPETITORS[key]}</span>
                  <span className="report__bar" aria-hidden="true" />
                  <strong>{n}</strong>
                </li>
              ))}
            </ul>
          </article>
        </div>
        <p className="note" data-reveal>{home.reports.note}</p>
      </section>

      <section id="how" className="section stack" aria-labelledby="how-title">
        <header className="section-head" data-reveal>
          <p className="eyebrow">{home.how.eyebrow}</p>
          <h2 id="how-title">{home.how.title}</h2>
          <p className="muted">{home.how.text}</p>
        </header>
        <ol className="steps">
          {home.how.steps.map((step, i) => (
            <li key={step.title} className="card step" data-reveal>
              <span className="step__num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p className="muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section cta stack" data-reveal>
        <p className="eyebrow">{home.final.eyebrow}</p>
        <h2>{home.final.title}</h2>
        <p>{home.final.text}</p>
        <div className="actions">
          <Link href="/dashboard" className="button button--signal">
            {home.cta} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </Reveal>
  );
}
