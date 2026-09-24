import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { COMPETITORS, PRICE_STATUSES } from '@/lib/config';
import { formatPrice } from '@/lib/format';
import { getDictionary } from './dictionaries';

// Illustrative numbers for the hero preview card, not real data.
const PREVIEW = { yours: 1.39, rivals: [['kaufland', 1.19], ['lidl', 1.25], ['billa', 1.45]] };

export default async function HomePage({ params }) {
  const { lang } = await params;
  const { home } = await getDictionary(lang);
  const max = Math.max(PREVIEW.yours, ...PREVIEW.rivals.map(([, p]) => p));

  return (
    <Reveal className="home">
      <section className="hero">
        <div className="hero__copy stack">
          <p className="eyebrow">{home.eyebrow}</p>
          <h1>{home.title}</h1>
          <p className="lead">{home.lead.replace('{count}', Object.keys(COMPETITORS).length)}</p>
          <div className="actions">
            <Link href={`/${lang}/dashboard`} className="button button--primary">
              {home.cta}
            </Link>
            <a href="#how" className="button">
              {home.ctaSecondary}
            </a>
          </div>
        </div>

        <figure className="preview card" aria-label={home.preview.label}>
          <figcaption className="preview__head">
            <span>{home.preview.product}</span>
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
      </section>

      <section id="how" className="section stack">
        <h2 data-reveal>{home.how.title}</h2>
        <ol className="steps">
          {home.how.steps.map((step, i) => (
            <li key={i} className="card" data-reveal>
              <span className="steps__num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p className="muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section stack">
        <h2 data-reveal>{home.statusTitle}</h2>
        <ul className="statuses">
          {PRICE_STATUSES.map((s) => (
            <li key={s} className="card" data-reveal>
              <span className="badge" data-status={s}>{home.status[s].name}</span>
              <p className="muted">{home.status[s].text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section stack">
        <h2 data-reveal>{home.chains.title}</h2>
        <p className="muted" data-reveal>{home.chains.text}</p>
        <ul className="chains" data-reveal>
          {Object.values(COMPETITORS).map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </section>

      <section className="section cta card stack" data-reveal>
        <h2>{home.final.title}</h2>
        <p className="muted">{home.final.text}</p>
        <div className="actions">
          <Link href={`/${lang}/dashboard`} className="button button--primary">
            {home.cta}
          </Link>
        </div>
      </section>
    </Reveal>
  );
}
