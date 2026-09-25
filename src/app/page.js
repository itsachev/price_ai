import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { COMPETITORS, PRICE_STATUSES } from '@/lib/config';
import { formatPrice } from '@/lib/format';
import { getDictionary, getLocale } from './dictionaries';

// Illustrative numbers for the hero preview, not real data.
const PREVIEW = { yours: 1.39, rivals: [['kaufland', 1.19], ['lidl', 1.25], ['billa', 1.45]], atRisk: 12, room: 0.14 };

export default async function HomePage() {
  const lang = await getLocale();
  const { home } = await getDictionary(lang);
  const chainCount = Object.keys(COMPETITORS).length;
  const max = Math.max(PREVIEW.yours, ...PREVIEW.rivals.map(([, p]) => p));
  const stats = [
    [chainCount, home.stats.chains],
    ['07:00', home.stats.fresh],
    [PRICE_STATUSES.length, home.stats.statuses],
    ['€', home.stats.currency],
  ];

  return (
    <Reveal className="home">
      <section className="hero">
        <div className="hero__copy stack">
          <p className="pill" data-reveal>
            <span className="pill__dot" aria-hidden="true" />
            {home.eyebrow}
          </p>
          <h1 data-reveal>
            {home.title} <em>{home.titleAccent}</em>
          </h1>
          <p className="lead" data-reveal>{home.lead.replace('{count}', chainCount)}</p>
          <div className="actions" data-reveal>
            <Link href="/dashboard" className="button button--primary">
              {home.cta} <span aria-hidden="true">→</span>
            </Link>
            <a href="#how" className="button">
              {home.ctaSecondary}
            </a>
          </div>
        </div>

        <div className="hero__visual" data-reveal>
          <figure className="preview card" aria-label={home.preview.label}>
            <figcaption className="preview__head">
              <span className="stack preview__title">
                <small>{home.preview.updated}</small>
                {home.preview.product}
              </span>
              <span className="badge" data-status="at-risk">{home.status['at-risk'].name}</span>
            </figcaption>
            <ul className="preview__rows">
              <li className="preview__row preview__row--yours" style={{ '--w': PREVIEW.yours / max }}>
                <span>{home.preview.yours}</span>
                <span className="preview__bar" />
                <strong>{formatPrice(PREVIEW.yours, lang)}</strong>
              </li>
              {PREVIEW.rivals.map(([key, price]) => (
                <li key={key} className="preview__row" style={{ '--w': price / max }}>
                  <span>{COMPETITORS[key]}</span>
                  <span className="preview__bar" />
                  <strong>{formatPrice(price, lang)}</strong>
                </li>
              ))}
            </ul>
            <p className="preview__note">{home.preview.note}</p>
          </figure>
          <p className="kpi kpi--risk">
            <strong>{PREVIEW.atRisk}</strong>
            {home.preview.kpiRisk}
          </p>
          <p className="kpi kpi--room">
            <strong>+{formatPrice(PREVIEW.room, lang)}</strong>
            {home.preview.kpiRoom}
          </p>
        </div>
      </section>

      <section className="chain-strip" aria-labelledby="chains-title" data-reveal>
        <h2 id="chains-title" className="chain-strip__title">{home.chains.title}</h2>
        <ul className="chains">
          {Object.values(COMPETITORS).map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </section>

      <dl className="stats section">
        {stats.map(([value, label]) => (
          <div key={label} data-reveal>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section id="how" className="section stack">
        <p className="eyebrow" data-reveal>{home.how.eyebrow}</p>
        <h2 data-reveal>{home.how.title}</h2>
        <ol className="bento">
          {home.how.steps.map((step, i) => (
            <li key={i} className="card bento__item" data-reveal>
              <span className="bento__num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p className="muted">{step.text}</p>
              {i === 0 && <p className="muted bento__foot">{home.chains.text}</p>}
              {i === 1 && (
                <div className="match" aria-hidden="true">
                  <span className="match__row">{home.how.match.yours}</span>
                  <span className="match__row">{home.how.match.theirs}</span>
                  <span className="badge" data-status="competitive">{home.how.match.confirmed}</span>
                </div>
              )}
              {i === 2 && (
                <div className="status-list" aria-hidden="true">
                  {PRICE_STATUSES.slice(0, 3).map((s) => (
                    <span key={s} className="badge" data-status={s}>{home.status[s].name}</span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="section stack">
        <h2 data-reveal>{home.statusTitle}</h2>
        <ul className="statuses">
          {PRICE_STATUSES.map((s) => (
            <li key={s} className="card" data-status={s} data-reveal>
              <span className="badge" data-status={s}>{home.status[s].name}</span>
              <p className="muted">{home.status[s].text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section cta stack" data-reveal>
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
