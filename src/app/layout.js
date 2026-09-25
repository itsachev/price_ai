import Link from 'next/link';
import { JetBrains_Mono, Unbounded } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll';
import { LOCALES } from '@/lib/config';
import { getDictionary, getLocale } from './dictionaries';
import { setLocale } from './actions/locale';
import { setTheme } from './actions/theme';
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
  const theme = (await cookies()).get('theme')?.value;

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
              <Link href="/dashboard" className="site-header__link">
                {dict.nav.dashboard}
              </Link>
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
        </SmoothScroll>
      </body>
    </html>
  );
}
