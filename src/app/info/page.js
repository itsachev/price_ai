import Link from 'next/link';
import { redirect } from 'next/navigation';
import FinderResults from '@/components/FinderResults';
import PageMotion from '@/components/PageMotion';
import ProductSearch from '@/components/ProductSearch';
import ShopperInsights from '@/components/ShopperInsights';
import { COMPETITORS } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../dictionaries';

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.info.title, robots: { index: false } };
}

// Shopper's price finder (consumer accounts land here): search the chains'
// still-listed products and show where each is cheapest, cheapest first.
// With no search it shows the day's insights instead.
export default async function InfoPage({ searchParams }) {
  const lang = await getLocale();
  const { info: t } = await getDictionary(lang);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect('/login?next=/info');

  const q = String((await searchParams).q ?? '').trim().slice(0, 80);
  const { count } = await supabase.from('shopper_prices').select('listing_id', { count: 'exact', head: true });
  const fmt = new Intl.NumberFormat(lang === 'bg' ? 'bg-BG' : 'en-IE');

  return (
    <PageMotion as="section" className="finder finder--board" reveal=".insights__section">
      <header className="finder__hero">
        {count > 0 && (
          <p className="finder__eyebrow">
            <span className="finder__live" aria-hidden="true" />
            {t.stats.replace('{count}', fmt.format(count)).replace('{chains}', Object.keys(COMPETITORS).length)}
          </p>
        )}
        <h1>{t.title}</h1>
        <p className="finder__lead">{t.lead}</p>
        <div className="finder__searchbar">
          <svg className="finder__glass" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <ProductSearch action="/info" defaultValue={q} placeholder={t.placeholder} label={t.search} />
        </div>
        <nav className="finder__quick" aria-label={t.quickLabel}>
          {t.quick.map(({ label, q: term }) => (
            <Link key={term} href={`/info?q=${encodeURIComponent(term)}`} scroll={false} aria-current={term === q ? 'true' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </header>
      {q ? <FinderResults q={q} lang={lang} t={t} /> : <ShopperInsights lang={lang} t={t} />}
    </PageMotion>
  );
}
