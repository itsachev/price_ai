'use client';

import { useEffect } from 'react';

// Tints the site backdrop (glows, dots, particles) with a status colour while
// the page is mounted: sets <html data-tone>, which AiBackground watches.
export default function PageTone({ tone }) {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.tone = tone;
    return () => delete html.dataset.tone;
  }, [tone]);
  return null;
}
