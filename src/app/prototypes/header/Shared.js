'use client';

import { setLocale } from '@/app/actions/locale';
import { setTheme } from '@/app/actions/theme';
import { useSyncExternalStore } from 'react';

export const SECTIONS = ['Dashboard', 'Reports', 'Settings'];
export const USER = { name: 'Ivan Petrov', email: 'ivan@fresh-market.bg' };

export const NOTIFS = [
  { kind: 'at-risk', text: 'Kaufland undercut Vereya fresh milk 3% 1L', meta: '€1.29 vs your €1.39' },
  { kind: 'opportunity', text: 'Lidl raised Olympus yoghurt 2% 400g', meta: '€1.19 → €1.35' },
  { kind: 'competitive', text: '4 new products matched', meta: 'Billa, Fantastico' },
];

export const Mark = () => (
  <svg className="proto-mark" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7.4a1.5 1.5 0 0 1 1.06.44l7.6 7.6a1.5 1.5 0 0 1 0 2.12l-7.4 7.4a1.5 1.5 0 0 1-2.12 0l-7.6-7.6A1.5 1.5 0 0 1 3 11.9zM8 9.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5z" />
  </svg>
);

export const Wordmark = () => <span className="proto-wordmark">Price<span>AI</span></span>;

// Real locale and theme actions, so the switches work in the prototype too.
export function LangSwitch() {
  const lang = useSyncExternalStore(() => () => {}, () => document.documentElement.lang, () => null);
  return (
    <form action={setLocale} className="proto-seg" aria-label="Language">
      {['bg', 'en'].map((l) => (
        <button key={l} name="lang" value={l} aria-pressed={l === lang}>{l.toUpperCase()}</button>
      ))}
    </form>
  );
}

export function ThemeSwitch({ label = false }) {
  return (
    <form action={setTheme} className="proto-theme">
      <button name="theme" value="dark" aria-label="Switch to dark theme" data-theme-btn="dark">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
        {label && <span>Dark theme</span>}
      </button>
      <button name="theme" value="light" aria-label="Switch to light theme" data-theme-btn="light">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        {label && <span>Light theme</span>}
      </button>
    </form>
  );
}

export function Bell({ id }) {
  return (
    <>
      <button className="proto-icon proto-bell" popoverTarget={id} aria-label="Notifications, 3 unread">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        <span className="proto-bell__count">3</span>
      </button>
      <div id={id} popover="auto" className="proto-pop proto-pop--wide">
        <p className="proto-pop__head">Today</p>
        <ul className="proto-notifs">
          {NOTIFS.map((n) => (
            <li key={n.text}>
              <span className={`proto-dot proto-dot--${n.kind}`} aria-hidden="true" />
              <span><strong>{n.text}</strong><small>{n.meta}</small></span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export const Avatar = ({ name }) => <span className="proto-avatar" aria-hidden="true">{name[0]}</span>;
