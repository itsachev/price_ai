import Link from 'next/link';
import { JetBrains_Mono, Unbounded } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll';
import MenuCloser from '@/components/MenuCloser';
import NavLink from '@/components/NavLink';
import SessionSwitch from '@/components/SessionSwitch';
import { LOCALES } from '@/lib/config';
import { getDictionary, getLocale } from './dictionaries';
import { setLocale } from './actions/locale';
import { setTheme } from './actions/theme';
import { signOut } from './actions/auth';
import { sessionUser } from '@/lib/auth';
import { cookies } from 'next/headers';
import '@/styles/main.css';

// Variable fonts: one file per subset covers every weight.
const unbounded = Unbounded({ subsets: ['latin', 'cyrillic'], variable: '--font-unbounded' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-jetbrains-mono' });

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: 'PriceAI', description: dict.meta.description };
}

export default async function RootLayout({ children }) {
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const cookieStore = await cookies();
  const theme = cookieStore.get('theme')?.value;
  // Nav hint only, no network call, so every page stays fast; the proxy and pages do the real check.
  const user = await sessionUser(cookieStore);
  const signedIn = Boolean(user);
  const userName = user?.name || dict.nav.account;

  return (
    <html lang={lang} data-theme={theme} className={`${unbounded.variable} ${jetbrainsMono.variable}`}>
      <body>
        {/* Decorative AI backdrop: pure CSS, transform-only motion. */}
        <div className="ai-bg" aria-hidden="true">
          <span className="ai-bg__aurora" />
          <span className="ai-bg__aurora" />
          <span className="ai-bg__aurora" />
        </div>
        <SmoothScroll>
          <header className="site-header">
            <div className="container site-header__inner">
              <Link href="/" className="brand">
                Price<span>AI</span>
              </Link>
              {/* Inline row from 60rem up; below that a native popover opened by the menu button. */}
              <nav id="site-menu" className="site-menu" popover="auto" aria-label={dict.nav.main}>
                <SessionSwitch
                  initial={signedIn}
                  signedIn={
                    <ul className="site-menu__links">
                      <li><NavLink href="/dashboard" exact>{dict.nav.dashboard}</NavLink></li>
                      <li><NavLink href="/dashboard/products">{dict.nav.products}</NavLink></li>
                      <li><NavLink href="/dashboard/reports">{dict.nav.reports}</NavLink></li>
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
                    // Desktop: a dropdown under the name button. In the phone menu it shows inline.
                    <div className="account">
                      <button type="button" className="account__toggle" popoverTarget="account-menu">
                        <span className="account__avatar" aria-hidden="true">{userName[0].toUpperCase()}</span>
                        <span className="account__name">{userName}</span>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                      <div id="account-menu" className="account__menu" popover="auto">
                        <p className="account__who">
                          <span className="account__avatar" aria-hidden="true">{userName[0].toUpperCase()}</span>
                          {userName}
                        </p>
                        <NavLink href="/dashboard/settings">{dict.nav.settings}</NavLink>
                        <form action={signOut}>
                          <button>{dict.auth.signOut}</button>
                        </form>
                      </div>
                    </div>
                  }
                  signedOut={<Link href="/login" className="site-menu__account">{dict.auth.signIn}</Link>}
                />
              </nav>
              <SessionSwitch
                initial={signedIn}
                signedIn={null}
                signedOut={<Link href="/signup" className="button button--signal site-header__cta">{dict.auth.signUp}</Link>}
              />
              <button className="site-header__menu" popoverTarget="site-menu" aria-label={dict.nav.menu} title={dict.nav.menu}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 16h16" /></svg>
              </button>
              <MenuCloser id="site-menu" />
            </div>
          </header>
          <main className="container">{children}</main>
          <footer className="site-footer">
            <div className="container site-footer__inner">
              <div className="site-footer__intro stack">
                <Link href="/" className="brand">
                  Price<span>AI</span>
                </Link>
                <p>{dict.footer.tagline}</p>
                <p className="site-footer__live">{dict.footer.updated}</p>
              </div>
              <nav className="site-footer__col" aria-labelledby="footer-product">
                <h2 id="footer-product" className="eyebrow">{dict.footer.product}</h2>
                <ul>
                  <li><Link href="/dashboard">{dict.nav.dashboard}</Link></li>
                  <li><Link href="/#how">{dict.home.how.eyebrow}</Link></li>
                </ul>
              </nav>
              <p className="site-footer__wordmark" aria-hidden="true">PriceAI</p>
              <div className="site-footer__bar">
                <p>© {new Date().getFullYear()} PriceAI. {dict.footer.rights}</p>
                <p>{dict.footer.currency}</p>
              </div>
            </div>
          </footer>
        </SmoothScroll>
      </body>
    </html>
  );
}
