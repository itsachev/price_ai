import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../../dictionaries';

// ponytail: placeholder so the nav link works; build real reports (price moves,
// promo calendar, margin impact) once the daily job has collected history.
export default async function ReportsPage() {
  const dict = await getDictionary(await getLocale());
  const t = dict.reports;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login?next=/dashboard/reports');

  return (
    <section className="dash">
      <header className="dash__head">
        <div className="dash__title">
          <h1>{t.title}</h1>
          <p className="muted">{t.intro}</p>
        </div>
      </header>
      <div className="dash__panel">
        <div className="dash__empty">
          <h2>{t.soon}</h2>
          <p className="muted">{t.soonText}</p>
          <Link href="/dashboard" className="button button--primary">{t.back}</Link>
        </div>
      </div>
    </section>
  );
}
