'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// One pointer listener for the whole page: it tells the button and the
// spotlight surface ([data-spotlight], e.g. the header bar) under the pointer
// where to centre their glow (--x/--y), and buttons which way to lean
// (--mx/--my, -0.5 to 0.5). Skipped on touch screens, which have no hover.
//
// It also replays the entry of each button (button.css) and of the footer's
// scan line and each of its rows (footer.css) when it scrolls into view: one first seen out of view (below
// the fold, in a closed dialog or menu) gets [data-reveal], which hides it,
// and loses it once it shows up. Ones already in view keep the entry they
// played on first paint. The footer outlives client navigations (root
// layout), so each new page hides it again and it replays on that page too.
const FOOTER = '.site-footer, .site-footer__inner > *';
const REVEAL = `.button, ${FOOTER}`;

export default function ButtonSpotlight() {
  const pathname = usePathname();
  const firstPage = useRef(true);

  useEffect(() => {
    if (!matchMedia('(hover: hover)').matches) return;

    const move = (event) => {
      for (const el of [event.target.closest?.('.button'), event.target.closest?.('[data-spotlight]')]) {
        if (!el) continue;
        const box = el.getBoundingClientRect();
        const x = event.clientX - box.left;
        const y = event.clientY - box.top;
        el.style.setProperty('--x', `${x}px`);
        el.style.setProperty('--y', `${y}px`);
        if (el.classList.contains('button')) {
          el.style.setProperty('--mx', (x / box.width - 0.5).toFixed(3));
          el.style.setProperty('--my', (y / box.height - 0.5).toFixed(3));
        }
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
    if (firstPage.current) firstPage.current = false;
    else document.querySelectorAll(FOOTER).forEach((el) => { el.dataset.reveal = ''; });
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
