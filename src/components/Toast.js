'use client';

import { useEffect } from 'react';

// A short "done" message after an action redirects with ?notice=…: it rises in
// at the bottom of the screen and fades out by itself (toast.css, no timers).
// The notice leaves the URL at once, so a reload or a copied link won't show
// it again. Give it a key that changes per action (the redirect's ?at=) so a
// second success replays it.
export default function Toast({ children }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('notice');
    url.searchParams.delete('at');
    window.history.replaceState(null, '', url);
  }, []);

  return (
    <p className="toast" role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.5 2.5L16 9.5" />
      </svg>
      {children}
    </p>
  );
}
