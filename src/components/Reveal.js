'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Fades up every [data-reveal] child and counts up every [data-count] number
// as it scrolls into view. Skipped for reduced motion.
export default function Reveal({ children, className }) {
  const scope = useRef(null);

  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.set('[data-reveal]', { autoAlpha: 0, y: 24 });
        ScrollTrigger.batch('[data-reveal]', {
          start: 'top 90%',
          once: true,
          onEnter: (els) =>
            gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 }),
        });

        // Count [data-count] numbers up from 0; the server-rendered value is the final one.
        gsap.utils.toArray('[data-count]').forEach((el) => {
          const n = { v: 0 };
          el.textContent = '0';
          gsap.to(n, {
            v: Number(el.dataset.count),
            duration: 1.4,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
            onUpdate: () => (el.textContent = Math.round(n.v)),
          });
        });
      });
    },
    { scope }
  );

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
