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
//   the whole title as the accessible name and hides the word spans.
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
          if (ScrollTrigger.isInViewport(title)) return; // already showing (restored scroll): don't hide it
          SplitText.create(title, {
            type: 'words',
            mask: 'words',
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.words, {
                yPercent: 110,
                duration: 0.9,
                ease: 'expo.out',
                stagger: 0.05,
                scrollTrigger: { trigger: title, start: 'top 85%', once: true },
              }),
          });
        });
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
