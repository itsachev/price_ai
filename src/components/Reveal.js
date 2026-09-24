'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Fades up every [data-reveal] child as it scrolls into view. Skipped for reduced motion.
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
