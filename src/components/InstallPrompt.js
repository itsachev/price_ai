'use client';

import { useEffect, useState } from 'react';
import ButtonLabel from './ButtonLabel';

const KEY = 'install_prompt_dismissed';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const snoozed = () => {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) || 0) < SNOOZE_MS;
  } catch {
    return false;
  }
};
// iOS has no install event: Safari installs only through Share → Add to Home Screen.
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Desktop Firefox can't install web apps at all.
const cantInstall = () => /firefox/i.test(navigator.userAgent) && !/android/i.test(navigator.userAgent);

// Asks visitors to install PriceAI as an app, shortly after every page load.
// Chromium hands over its install prompt (beforeinstallprompt) only after some
// engagement, so until then the card shows the browser-menu steps and gains
// an Install button once the event lands; iOS gets the Share-sheet steps.
// Hidden once installed, and for two weeks after "Not now".
export default function InstallPrompt({ t }) {
  const [mode, setMode] = useState(null); // null | 'menu' | 'ios' | 'prompt'
  const [event, setEvent] = useState(null);

  useEffect(() => {
    if (installed() || snoozed() || cantInstall()) return;
    const onPrompt = (e) => {
      e.preventDefault();
      setEvent(e);
      setMode('prompt');
    };
    const onInstalled = () => setMode(null);
    addEventListener('beforeinstallprompt', onPrompt);
    addEventListener('appinstalled', onInstalled);
    // A short wait lets the page settle before the card slides in.
    const timer = setTimeout(() => setMode((m) => m ?? (isIos() ? 'ios' : 'menu')), 1500);
    return () => {
      clearTimeout(timer);
      removeEventListener('beforeinstallprompt', onPrompt);
      removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    setMode(null);
  };
  const install = async () => {
    event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'dismissed') dismiss();
    else setMode(null);
  };

  return (
    <section className="dock-card install-prompt" aria-labelledby="install-prompt-title">
      <span className="dock-card__icon install-prompt__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path fillRule="evenodd" d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7.4a1.5 1.5 0 0 1 1.06.44l7.6 7.6a1.5 1.5 0 0 1 0 2.12l-7.4 7.4a1.5 1.5 0 0 1-2.12 0l-7.6-7.6A1.5 1.5 0 0 1 3 11.9zM8 9.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5z" /></svg>
      </span>
      <div className="dock-card__body">
        <p className="eyebrow">{t.eyebrow}</p>
        <p id="install-prompt-title" className="dock-card__title">{t.title}</p>
        <p>{t.text}</p>
        {mode !== 'prompt' && (
          <ol className="dock-card__steps">
            {t.steps[mode].map((step) => <li key={step}>{step}</li>)}
          </ol>
        )}
        <p className="dock-card__hint">{t.anytime[mode === 'ios' ? 'ios' : 'browser']}</p>
      </div>
      <div className="dock-card__actions">
        <button type="button" className="button button--quiet" onClick={dismiss}>
          <ButtonLabel>{t.later}</ButtonLabel>
        </button>
        {mode === 'prompt' && (
          <button type="button" className="button button--primary" onClick={install}>
            <ButtonLabel>{t.install}</ButtonLabel>
          </button>
        )}
      </div>
    </section>
  );
}
