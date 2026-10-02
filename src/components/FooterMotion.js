'use client';

import { useRef } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

// The site footer, scrubbed: the scan line draws along its top edge, each row
// and link lifts in, and the wordmark climbs out of its baseline as you scroll
// down, all reversing on scroll up. The footer outlives client navigations (root
// layout) but the page height changes, so it is rebuilt on every route.
// Content is complete without it (no JS, reduced motion).
export default function FooterMotion({ children }) {
  const scope = useRef(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        // Short pages (auth, legal, empty states) show the footer without any scroll, so a
        // scrub would already sit at its end: play the same reveal on a timer instead.
        // A page with no scroll room at all can never finish a scrub either (the wordmark's end is the
        // viewport bottom), even when the footer starts low in the viewport.
        const root = document.documentElement;
        const short = scope.current.getBoundingClientRect().top < window.innerHeight * 0.8 || root.scrollHeight - root.clientHeight < 2;
        let n = 0;
        const scrub = (trigger, end = 'top 80%') =>
          short ? { delay: 0.1 + n++ * 0.05, duration: 0.8 } : { scrollTrigger: { trigger, start: 'top bottom', end, scrub: 0.6 } };
        const q = (s) => gsap.utils.toArray(s, scope.current);

        gsap.fromTo(scope.current, { '--scan': 0 }, { '--scan': 1, ease: 'none', ...scrub(scope.current, 'top 40%') });

        q('.site-footer__intro, .site-footer__col, .site-footer__bar, li').forEach((el) =>
          gsap.fromTo(
            el,
            { autoAlpha: 0, y: 24 },
            { autoAlpha: 1, y: 0, ease: 'none', ...scrub(el, el.matches('.site-footer__bar') ? 'bottom bottom' : 'top 80%') }
          )
        );

        // Text behaves like the home page: every character fades 0.1 -> 1.
        // (Links and the live pill are flex boxes: split words would lose their spaces, so they only lift.)
        q('.site-footer__intro > p:not(.site-footer__live), .site-footer__col h2, .site-footer__bar p').forEach((el) =>
          SplitText.create(el, {
            type: 'words,chars',
            tag: 'span',
            autoSplit: true,
            onSplit: (self) =>
              gsap.fromTo(self.chars, { opacity: 0.1 }, { opacity: 1, ease: 'none', stagger: short ? { amount: 0.8 } : 0.1, ...scrub(el, 'bottom 85%') }),
          })
        );

        q('.site-footer__wordmark').forEach((el) =>
          gsap.fromTo(
            el,
            { yPercent: 60, clipPath: 'inset(0 0 60% 0)', letterSpacing: '0.06em' },
            { yPercent: 0, clipPath: 'inset(0 0 0% 0)', letterSpacing: '-0.04em', ease: 'none', ...scrub(el, 'bottom bottom') }
          )
        );
      });
    },
    { scope, dependencies: [pathname], revertOnUpdate: true }
  );

  return (
    <footer ref={scope} className="site-footer">
      {children}
    </footer>
  );
}
