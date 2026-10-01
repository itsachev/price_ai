'use client';

import { useEffect } from 'react';
import { useLenis } from 'lenis/react';

// Smooth-scrolls to `target` once Lenis is ready (a URL hash would jump). Give it
// a `key` that changes per event so it runs again, e.g. after each product add.
export default function ScrollToOnMount({ target }) {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    lenis.scrollTo(target, { offset: -96, immediate: reduce });
  }, [lenis, target]);

  return null;
}
