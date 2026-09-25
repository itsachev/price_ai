import Link from 'next/link';
import { Inter, Parkinsans } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll';
import { LOCALES } from '@/lib/config';
import { getDictionary, getLocale } from './dictionaries';
import { setLocale } from './actions/locale';
import '@/styles/main.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });
// Latin only — Cyrillic headings fall back to Inter via --font-heading.
const parkinsans = Parkinsans({ subsets: ['latin'], weight: ['500'], variable: '--font-parkinsans' });

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: 'PriceAI', description: dict.meta.description };
}

export default async function RootLayout({ children }) {
  const lang = await getLocale();
  const dict = await getDictionary(lang);

  return (
    <html lang={lang} className={`${inter.variable} ${parkinsans.variable}`}>
      <body>
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
            </div>
          </header>
          <main className="container">{children}</main>
        </SmoothScroll>
      </body>
    </html>
  );
}
