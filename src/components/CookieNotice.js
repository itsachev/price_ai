import Link from 'next/link';
import ButtonLabel from './ButtonLabel';
import { dismissCookieNotice } from '@/app/actions/cookieNotice';

export default function CookieNotice({ t }) {
  return (
    <div className="cookie-notice card" role="dialog" aria-label={t.title}>
      <svg className="cookie-notice__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 9 9 3.2 3.2 0 0 1-4-4 3.2 3.2 0 0 1-4-4 3.2 3.2 0 0 1-1-1z" />
        <circle cx="9" cy="13" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="13" cy="16" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="15" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
      </svg>
      <p>
        {t.text} <Link href="/privacy">{t.link}</Link>
      </p>
      <form action={dismissCookieNotice}>
        <button className="button button--primary">
          <ButtonLabel>{t.accept}</ButtonLabel>
        </button>
      </form>
    </div>
  );
}
