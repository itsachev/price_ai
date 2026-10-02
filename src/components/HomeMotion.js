'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

// Home page choreography below the hero. The server HTML is the finished page;
// this only adds to it.
// - [data-split] titles rise word by word as they scroll in. SplitText keeps
//   the whole title as the accessible name and hides the word spans. The
//   paragraph right after a title lifts in with it.
// - The pipeline story: from 60rem the example panel (.pipe) sticks beside the
//   steps and shows the step being read (data-step, CSS does the rest).
//   Narrower, and without JS, it shows the end state.
export default function HomeMotion({ children }) {
  const scope = useRef(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.utils.toArray('[data-split]').forEach((title) => {
          SplitText.create(title, {
            type: 'words',
            mask: 'words',
            autoSplit: true,
            onSplit: (self) => {
              // Scrubbed: the title plays in with scroll down and back out with scroll up.
              const tl = gsap.timeline({
                defaults: { ease: 'none' },
                scrollTrigger: { trigger: title, start: 'top 92%', end: 'top 55%', scrub: 0.6 },
              });
              tl.from(self.words, { yPercent: 110, duration: 0.9, stagger: 0.05 });
              return tl;
            },
          });
        });

        // Body text: every character fades 0.1 -> 1 as you scroll through it, and back on scroll up.
        gsap.utils
          .toArray([
            '.lead, .trust li, .note',
            '.rail__title, .rail__chains li',
            '.home-head > p, .how__steps h3, .how__steps p',
            '.features__list h3, .features__list p',
            '.tracker__head h3, .tracker__head p, .tracker dt, .tracker dd, .tracker th, .tracker td',
            '.cta > p, .cta__points li',
          ].join(', '))
          .forEach((el) =>
            SplitText.create(el, {
              type: 'words,chars',
              tag: 'span', // the default <div> picks up the `div` rules of cards and tiles
              autoSplit: true,
              onSplit: (self) =>
                gsap.fromTo(
                  self.chars,
                  { opacity: 0.1 },
                  {
                    opacity: 1,
                    ease: 'none',
                    stagger: 0.1,
                    scrollTrigger: { trigger: el, start: 'top 90%', end: 'bottom 60%', scrub: true },
                  }
                ),
            })
          );
      });

      // The rest of the static content lifts in, scrubbed, as it enters (reverses on scroll up).
      // The how-steps are left out: they already follow the scroll and dim by CSS.
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.utils
          .toArray('.rail__chains li, .features__list > li, .chart, .tracker, .tracker tbody tr, .cta .actions, .cta__points li')
          .forEach((el) =>
            gsap.fromTo(
              el,
              { autoAlpha: 0, y: 28 },
              { autoAlpha: 1, y: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 78%', scrub: 0.6 } }
            )
          );
      });

      mm.add('(min-width: 60rem)', () => {
        const panel = scope.current.querySelector('.pipe');
        const steps = gsap.utils.toArray('.how__steps > li');
        const show = (n) => {
          panel.dataset.step = n;
          steps.forEach((s, i) => s.toggleAttribute('data-active', i === n - 1));
        };
        // Past the whole list (restored scroll) it stays on the end state.
        show(steps.at(-1).getBoundingClientRect().bottom < innerHeight * 0.6 ? steps.length : 1);
        steps.forEach((step, i) =>
          ScrollTrigger.create({
            trigger: step,
            start: 'top 60%',
            end: 'bottom 60%',
            onToggle: (self) => self.isActive && show(i + 1),
          })
        );
        return () => {
          panel.dataset.step = steps.length;
          steps.forEach((s) => s.removeAttribute('data-active'));
        };
      });
    },
    { scope }
  );

  return (
    <div ref={scope} className="home">
      {children}
    </div>
  );
}
