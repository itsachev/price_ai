'use client';

import { useLenis } from 'lenis/react';

// Shown by a CSS scroll-driven animation (back-to-top.css), so nothing runs on scroll.
// Scrolls through Lenis so it glides like the wheel; jumps under reduced motion.
export default function BackToTop({ label }) {
  const lenis = useLenis();

  const toTop = () => {
    const immediate = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (lenis) lenis.scrollTo(0, { immediate });
    else scrollTo({ top: 0, behavior: immediate ? 'instant' : 'smooth' });
  };

  return (
    <button type="button" className="button back-to-top" onClick={toTop} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
    </button>
  );
}
