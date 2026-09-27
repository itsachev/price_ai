'use client';

import { useEffect } from 'react';

// One pointer listener for the whole page: it tells the button and the
// spotlight surface ([data-spotlight], e.g. the header bar) under the pointer
// where to centre their glow (--x/--y). Skipped on touch screens, which have
// no hover.
export default function ButtonSpotlight() {
  useEffect(() => {
    if (!matchMedia('(hover: hover)').matches) return;

    const move = (event) => {
      for (const el of [event.target.closest?.('.button'), event.target.closest?.('[data-spotlight]')]) {
        if (!el) continue;
        const box = el.getBoundingClientRect();
        el.style.setProperty('--x', `${event.clientX - box.left}px`);
        el.style.setProperty('--y', `${event.clientY - box.top}px`);
      }
    };
    document.addEventListener('pointermove', move, { passive: true });
    return () => document.removeEventListener('pointermove', move);
  }, []);

  return null;
}
