'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// One pointer listener for the whole page: it tells the button and the
// spotlight surface ([data-spotlight], e.g. the header bar) under the pointer
// where to centre their glow (--x/--y). Skipped on touch screens, which have
// no hover.
//
// It also replays the entry of each button (button.css) when it scrolls into
// view: one first seen out of view (below the fold, in a closed dialog or
// menu) gets [data-reveal], which hides it, and loses it once it shows up.
// Ones already in view keep the entry they played on first paint. (The footer
// is scrubbed by FooterMotion instead.)
const REVEAL = '.button';

export default function ButtonSpotlight() {
  const pathname = usePathname();

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

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const seen = new WeakSet();
    const io = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        const first = !seen.has(target);
        seen.add(target);
        if (isIntersecting) {
          delete target.dataset.reveal;
          io.unobserve(target);
        } else if (first) {
          target.dataset.reveal = '';
        }
      }
    });

    const watch = (root) => {
      if (root.matches?.(REVEAL)) io.observe(root);
      root.querySelectorAll?.(REVEAL).forEach((el) => io.observe(el));
    };
    watch(document);

    // Client navigations and dialogs add buttons after mount.
    const mo = new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach(watch);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}
