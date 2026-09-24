import { notFound } from 'next/navigation';
import { Inter } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll';
import { LOCALES } from '@/lib/config';
import { getDictionary, hasLocale } from './dictionaries';
import '../globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: 'PriceAI', description: dict.meta.description };
}

export default async function RootLayout({ children, params }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <html lang={lang} className={inter.variable}>
      <body>
        <SmoothScroll>
          <header className="site-header">
            <div className="container site-header__inner">
              <a href={`/${lang}`} className="brand">
                Price<span>AI</span>
              </a>
              <a href={`/${lang}/dashboard`} className="site-header__link">
                {dict.nav.dashboard}
              </a>
              <nav className="lang-switch" aria-label={dict.nav.language}>
                {LOCALES.map((l) => (
                  <a key={l} href={`/${l}`} aria-current={l === lang ? 'true' : undefined} hrefLang={l}>
                    {l.toUpperCase()}
                  </a>
                ))}
              </nav>
            </div>
          </header>
          <main className="container">{children}</main>
        </SmoothScroll>
      </body>
    </html>
  );
}
