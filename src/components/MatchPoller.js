'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const EVERY_MS = 4000;
const GIVE_UP_MS = 2 * 60 * 1000;

// Rendered only while a product on the page is still being matched in the
// background. It re-reads the stored results (no AI runs on refresh) until the
// match lands, then the server stops rendering it. A run cut short by the Gemini
// quota finishes in the daily job, so polling gives up after a while.
export default function MatchPoller() {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > GIVE_UP_MS) clearInterval(timer);
      else if (document.visibilityState === 'visible') router.refresh();
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
