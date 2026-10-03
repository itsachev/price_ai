import Link from 'next/link';
import ButtonLabel from './ButtonLabel';
import { dismissCookieNotice } from '@/app/actions/cookieNotice';

export default function CookieNotice({ t }) {
  return (
    <section className="dock-card cookie-notice" aria-labelledby="cookie-notice-title">
      <span className="dock-card__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 3a9 9 0 1 0 9 9 3.2 3.2 0 0 1-4-4 3.2 3.2 0 0 1-4-4 3.2 3.2 0 0 1-1-1z" />
          <circle cx="9" cy="13" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="13" cy="16" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="15" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <div className="dock-card__body">
        <p className="eyebrow">{t.eyebrow}</p>
        <p id="cookie-notice-title" className="dock-card__title">{t.title}</p>
        <p>
          {t.text} <Link href="/privacy">{t.link}</Link>
        </p>
        <ul className="dock-card__chips">
          {t.kinds.map((kind) => <li key={kind}>{kind}</li>)}
        </ul>
      </div>
      <form action={dismissCookieNotice} className="dock-card__actions">
        <button className="button button--primary">
          <ButtonLabel>{t.accept}</ButtonLabel>
        </button>
      </form>
    </section>
  );
}
