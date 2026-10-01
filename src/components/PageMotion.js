'use client';

import { useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

// The admin console's entrance, one choreography per section page: the title's
// lines rise out of a mask, panels and tiles lift in as they scroll into view,
// [data-count] numbers count up, [data-grow] bars fill from the start and
// [data-rise] bars grow from the baseline.
//
// It runs only when the page was rendered on the client (an in-app
// navigation). On a hard load the server HTML is already on screen, and
// hiding it to animate would flash. Content is always complete without it.
const REVEAL = '.admin__main > :not(.stat-grid, .admin-cards, .admin-panels), .stat-grid > *, .admin-cards > *, .admin-panels > *';
const subscribe = () => () => {};

export default function AdminMotion({ children }) {
  const scope = useRef(null);
  const pathname = usePathname();
  // false only while hydrating server HTML (useSyncExternalStore's server snapshot).
  const clientRender = useSyncExternalStore(subscribe, () => true, () => false);
  const animate = useRef(clientRender);

  useGSAP(
    () => {
      if (!animate.current) {
        animate.current = true;
        return;
      }
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        const ease = 'expo.out';
        const title = scope.current.querySelector('h1');
        if (title) {
          SplitText.create(title, {
            type: 'lines',
            mask: 'lines',
            autoSplit: true,
            onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1, ease, stagger: 0.08 }),
          });
        }

        gsap.set(REVEAL, { autoAlpha: 0, y: 24 });
        ScrollTrigger.batch(REVEAL, {
          start: 'top 95%',
          once: true,
          onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.8, ease, stagger: 0.06, delay: 0.1 }),
        });

        const fmt = new Intl.NumberFormat(document.documentElement.lang === 'bg' ? 'bg-BG' : 'en-IE');
        gsap.utils.toArray('[data-count]').forEach((el) => {
          const text = el.textContent;
          const n = { v: 0 };
          gsap.to(n, {
            v: Number(el.dataset.count),
            duration: 1.4,
            ease: 'power3.out',
            delay: 0.15,
            onUpdate: () => (el.textContent = fmt.format(Math.round(n.v))),
            onComplete: () => (el.textContent = text),
          });
        });

        gsap.from('[data-grow]', { scaleX: 0, transformOrigin: '0% 50%', duration: 1.2, ease, stagger: 0.05, delay: 0.25 });
        gsap.from('[data-rise]', { scaleY: 0, transformOrigin: '50% 100%', duration: 0.9, ease, stagger: { each: 0.025, from: 'end' }, delay: 0.2 });
      });
    },
    { scope, dependencies: [pathname], revertOnUpdate: true }
  );

  return (
    <div ref={scope} className="admin__main">
      {children}
    </div>
  );
}
