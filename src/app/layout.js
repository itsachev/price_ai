import Link from 'next/link';
import { JetBrains_Mono, Unbounded } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll';
import { COMPETITORS, LOCALES } from '@/lib/config';
import { getDictionary, getLocale } from './dictionaries';
import { setLocale } from './actions/locale';
import { setTheme } from './actions/theme';
import { signOut } from './actions/auth';
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
  // Nav hint only: the session cookie exists (chunks end in .0, .1). No network
  // call, so every page stays fast; the proxy and pages do the real check.
  const signedIn = cookieStore.getAll().some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));

  return (
    <html lang={lang} data-theme={theme} className={`${unbounded.variable} ${jetbrainsMono.variable}`}>
      <body>
        {/* Decorative AI backdrop: pure CSS, transform-only motion. */}
        <div className="ai-bg" aria-hidden="true">
          <span className="ai-bg__glow" />
          <span className="ai-bg__glow" />
          <span className="ai-bg__glow" />
          <span className="ai-bg__scan" />
        </div>
        <SmoothScroll>
          <header className="site-header">
            <div className="container site-header__inner">
              <Link href="/" className="brand">
                Price<span>AI</span>
              </Link>
              <nav className="site-header__nav" aria-label={dict.nav.main}>
                {signedIn ? (
                  <>
                    <Link href="/dashboard" className="site-header__link">
                      {dict.nav.dashboard}
                    </Link>
                    <form action={signOut}>
                      <button className="site-header__icon" aria-label={dict.auth.signOut} title={dict.auth.signOut}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                      </button>
                    </form>
                  </>
                ) : (
                  <Link href="/login" className="site-header__link">
                    {dict.auth.signIn}
                  </Link>
                )}
              </nav>
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
              <section className="site-footer__col" aria-labelledby="footer-chains">
                <h2 id="footer-chains" className="eyebrow">{dict.footer.coverage}</h2>
                <ul className="site-footer__chains">
                  {Object.values(COMPETITORS).map((name) => <li key={name}>{name}</li>)}
                </ul>
              </section>
              <section className="site-footer__col" aria-labelledby="footer-data">
                <h2 id="footer-data" className="eyebrow">{dict.footer.data}</h2>
                <p>{dict.footer.dataText}</p>
              </section>
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
