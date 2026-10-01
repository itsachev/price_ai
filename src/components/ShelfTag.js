'use client';

import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

const DIGITS = [...'0123456789'];

// Price on reels: each digit is a column of 0–9 shifted to its value (--d), so
// a new price rolls in by CSS transition. The real price is the hidden text.
function Reels({ text }) {
  const chars = [...text];
  return (
    <>
      <span className="visually-hidden">{text}</span>
      <span className="tag__reels" aria-hidden="true">
        {chars.map((c, i) => {
          const key = chars.length - i; // keyed from the end, so the cents keep their reels
          return /\d/.test(c) ? (
            <span key={key} className="tag__reel" style={{ '--d': c, '--i': i }}>
              <span>{DIGITS.map((d) => <span key={d}>{d}</span>)}</span>
            </span>
          ) : (
            <span key={key}>{c}</span>
          );
        })}
      </span>
    </>
  );
}

// The home page hero: one example product's shelf tag, checked against the
// chains. The server renders it complete; the scan (a band sweeps the tag, the
// chain rows tick past, the verdict stamps down) runs once after hydration and
// again on every pick. products: [{ name, sku, price, status, statusName,
// verdict, why, rows: [{ chain, price, delta, cheapest }] }], all preformatted.
export default function ShelfTag({ products, t }) {
  const [active, setActive] = useState(0);
  const scope = useRef(null);
  const first = useRef(true);
  const p = products[active];

  useGSAP(
    () => {
      const intro = first.current;
      first.current = false;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap
        .timeline({ delay: intro ? 0.6 : 0, defaults: { overwrite: 'auto' } })
        .fromTo('.tag__sweep', { xPercent: -100, autoAlpha: 1 }, { xPercent: 100, duration: 1.1, ease: 'power2.inOut' })
        .set('.tag__sweep', { autoAlpha: 0 })
        .fromTo('.tag__row', { opacity: 0.35 }, { opacity: 1, duration: 0.4, stagger: 0.14 }, 0.25)
        .fromTo('.tag__verdict', { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(2.5)' }, 0.8);
    },
    { scope, dependencies: [active] }
  );

  return (
    <div ref={scope} className="hero__tag">
      <figure className="tag" aria-label={t.label}>
        <div className="tag__paper" data-status={p.status} data-spotlight>
          <span className="tag__sweep" aria-hidden="true" />
          <p className="tag__name">
            <strong>{p.name}</strong>
            <small>{p.sku}</small>
          </p>
          <p className="tag__price">
            <Reels text={p.price} />
            <small>{t.yours}</small>
          </p>
          <div className="tag__chains">
            <p className="tag__caption">{t.chains}</p>
            <ul>
              {p.rows.map((r) => (
                <li key={r.chain} className="tag__row">
                  <span>
                    {r.chain}
                    {r.cheapest && <span className="tag__flag">{t.cheapest}</span>}
                  </span>
                  <strong>{r.price}</strong>
                  <span className="tag__delta">{r.delta}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="tag__verdict">
            <span className="badge" data-status={p.status}>{p.statusName}</span>
            <strong>{p.verdict}</strong>
            <small>{p.why}</small>
          </p>
        </div>
      </figure>
      <div className="tag-pick" role="group" aria-label={t.pick}>
        {t.products.map((name, i) => (
          <button key={name} type="button" data-status={products[i].status} aria-pressed={i === active} onClick={() => setActive(i)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
