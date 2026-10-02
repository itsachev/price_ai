import { Suspense } from 'react';
import Link from 'next/link';
import { Inter, JetBrains_Mono, Unbounded } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll';
import AiBackground from '@/components/AiBackground';
import ButtonLabel from '@/components/ButtonLabel';
import ButtonSpotlight from '@/components/ButtonSpotlight';
import BackToTop from '@/components/BackToTop';
import FooterMotion from '@/components/FooterMotion';import CookieNotice from '@/components/CookieNotice';
import MenuCloser from '@/components/MenuCloser';
import NavLink from '@/components/NavLink';
import SessionSwitch from '@/components/SessionSwitch';
import Notifications from '@/components/Notifications';
import { LOCALES, SITE_URL } from '@/lib/config';
import { getDictionary, getLocale } from './dictionaries';
import { setLocale } from './actions/locale';
import { setTheme } from './actions/theme';
import { signOut } from './actions/auth';
import { sessionUser } from '@/lib/auth';
import { cookies } from 'next/headers';
import '@/styles/main.css';

// Variable fonts: one file per subset covers every weight. Inter sets the UI
// and body text (tabular figures for prices); Unbounded only the headings and logo.
const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });
const unbounded = Unbounded({ subsets: ['latin', 'cyrillic'], variable: '--font-unbounded' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-jetbrains-mono' });

export async function generateMetadata() {
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const title = `PriceAI · ${dict.home.eyebrow}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: '%s · PriceAI' },
    description: dict.meta.description,
    applicationName: 'PriceAI',
    // ponytail: one URL serves both languages (cookie locale), so no hreflang alternates.
    // Add them if locales ever get their own URLs.
    openGraph: {
      type: 'website',
      siteName: 'PriceAI',
      title,
      description: dict.meta.description,
      locale: lang === 'bg' ? 'bg_BG' : 'en_US',
      url: '/',
    },
    twitter: { card: 'summary_large_image' },
    formatDetection: { telephone: false },
  };
}

// Brand mark: a shelf price tag hanging from its hole (header.css swings it).
const brandMark = (
  <svg className="brand__mark" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7.4a1.5 1.5 0 0 1 1.06.44l7.6 7.6a1.5 1.5 0 0 1 0 2.12l-7.4 7.4a1.5 1.5 0 0 1-2.12 0l-7.6-7.6A1.5 1.5 0 0 1 3 11.9zM8 9.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5z" />
  </svg>
);

// Dark by default; the `theme` cookie can switch to light.
const themeOf = (cookieStore) => (cookieStore.get('theme')?.value === 'light' ? 'light' : 'dark');

// Matches --bg in src/styles/base/tokens.css.
export async function generateViewport() {
  return { themeColor: themeOf(await cookies()) === 'light' ? '#f4f6fa' : '#0a0f1a' };
}

export default async function RootLayout({ children }) {
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const cookieStore = await cookies();
  const theme = themeOf(cookieStore);
  // Nav hint only, no network call, so every page stays fast; the proxy and pages do the real check.
  const user = await sessionUser(cookieStore);
  const signedIn = Boolean(user);
  const userName = user?.name || dict.nav.account;
  const cookieNoticeSeen = Boolean(cookieStore.get('cookie_notice')?.value);

  return (
    <html lang={lang} data-theme={theme} className={`${inter.variable} ${unbounded.variable} ${jetbrainsMono.variable}`}>
      <body>
        {/* Decorative AI backdrop: WebGL shader over a pure-CSS fallback. */}
        <AiBackground />
        <ButtonSpotlight />
        <SmoothScroll>
          <header className="site-header">
            <div className="container site-header__inner" data-spotlight>
              <Link href="/" className="brand">
                {brandMark}
                <span>Price<span>AI</span></span>
              </Link>
              {/* Inline row from 60rem up; below that a native popover opened by the menu button. */}
              <nav id="site-menu" className="site-menu" popover="auto" aria-label={dict.nav.main} data-lenis-prevent>
                <SessionSwitch
                  initial={signedIn}
                  signedIn={
                    <ul className="site-menu__links">
                      <li><NavLink href="/dashboard" exact><ButtonLabel>{dict.nav.dashboard}</ButtonLabel></NavLink></li>
                      <li><NavLink href="/dashboard/reports"><ButtonLabel>{dict.nav.reports}</ButtonLabel></NavLink></li>
                      <li><NavLink href="/dashboard/settings"><ButtonLabel>{dict.nav.settings}</ButtonLabel></NavLink></li>
                      {user?.admin && <li><NavLink href="/dashboard/admin"><ButtonLabel>{dict.nav.admin}</ButtonLabel></NavLink></li>}
                    </ul>
                  }
                />
                <div className="site-menu__tools">
                  <form action={setLocale} className="lang-switch" aria-label={dict.nav.language}>
                    {LOCALES.map((l) => (
                      <button key={l} name="lang" value={l} aria-pressed={l === lang} lang={l}>
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </form>
                  {/* Both buttons render; CSS shows the one that switches away from the active theme. */}
                  <form action={setTheme} className="theme-switch" aria-label={dict.nav.theme}>
                    <button name="theme" value="dark" aria-label={dict.nav.themeDark} title={dict.nav.themeDark}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
                    </button>
                    <button name="theme" value="light" aria-label={dict.nav.themeLight} title={dict.nav.themeLight}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
                    </button>
                  </form>
                </div>
                <SessionSwitch
                  initial={signedIn}
                  signedIn={
                    <div className="account">
                      <Link href="/dashboard/settings" className="account__who" title={dict.nav.settings}>
                        <span className="account__avatar" aria-hidden="true">{userName[0].toUpperCase()}</span>
                        <span className="account__name">{userName}</span>
                      </Link>
                      <form action={signOut}>
                        <button className="site-menu__account"><ButtonLabel>{dict.auth.signOut}</ButtonLabel></button>
                      </form>
                    </div>
                  }
                  signedOut={<Link href="/login" className="site-menu__account"><ButtonLabel>{dict.auth.signIn}</ButtonLabel></Link>}
                />
              </nav>
              {/* Streams in after the page; the placeholder keeps the bar from shifting. */}
              <SessionSwitch
                initial={signedIn}
                signedIn={
                  signedIn && (
                    <Suspense fallback={<span className="bell" aria-hidden="true" />}>
                      <Notifications dict={dict} lang={lang} />
                    </Suspense>
                  )
                }
              />
              <button className="site-header__menu" popoverTarget="site-menu" aria-label={dict.nav.menu} title={dict.nav.menu}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16" /><path d="M4 16h16" /></svg>
              </button>
              <MenuCloser id="site-menu" />
            </div>
          </header>
          <main className="container">{children}</main>
          <FooterMotion>
            <div className="container site-footer__inner">
              <div className="site-footer__intro stack">
                <Link href="/" className="brand">
                  {brandMark}
                  <span>Price<span>AI</span></span>
                </Link>
                <p>{dict.footer.tagline}</p>
                <p className="site-footer__live">{dict.footer.updated}</p>
              </div>
              <nav className="site-footer__col" aria-labelledby="footer-product">
                <h2 id="footer-product" className="eyebrow">{dict.footer.product}</h2>
                <ul>
                  <li><Link href="/dashboard">{dict.nav.dashboard}</Link></li>
                  <li><Link href="/#how">{dict.home.how.link}</Link></li>
                </ul>
              </nav>
              <nav className="site-footer__col" aria-labelledby="footer-legal">
                <h2 id="footer-legal" className="eyebrow">{dict.footer.legal}</h2>
                <ul>
                  <li><Link href="/terms">{dict.legal.terms.title}</Link></li>
                  <li><Link href="/privacy">{dict.legal.privacy.title}</Link></li>
                </ul>
              </nav>
              <p className="site-footer__wordmark" aria-hidden="true" data-spotlight>PriceAI</p>
              <div className="site-footer__bar">
                <p>© {new Date().getFullYear()} PriceAI. {dict.footer.rights}</p>
                <p>{dict.footer.currency}</p>
              </div>
            </div>
          </FooterMotion>
          <BackToTop label={dict.nav.backToTop} />
        </SmoothScroll>
        {!cookieNoticeSeen && <CookieNotice t={dict.cookieNotice} />}
      </body>
    </html>
  );
}
