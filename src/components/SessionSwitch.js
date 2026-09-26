'use client';

import { useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

// The root layout isn't re-rendered on client navigation, so its signed-in
// header state goes stale once the session ends (expiry, another tab, the proxy
// dropping a dead cookie). Re-read the session cookie on every navigation and
// when the tab regains focus. Same cookie as `hasSession`, which seeds the SSR state.
const hasCookie = () => /(?:^|;\s*)sb-[^=]+-auth-token(?:\.0)?=[^;]/.test(document.cookie);
const subscribe = (onChange) => {
  window.addEventListener('focus', onChange);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    window.removeEventListener('focus', onChange);
    document.removeEventListener('visibilitychange', onChange);
  };
};

export default function SessionSwitch({ initial, signedIn, signedOut = null }) {
  usePathname(); // re-render (and so re-read the cookie) on every navigation
  const active = useSyncExternalStore(subscribe, hasCookie, () => initial);
  return active ? signedIn : signedOut;
}
