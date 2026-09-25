import { redirect } from 'next/navigation';
import { PRICE_STATUSES } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../dictionaries';

export default async function DashboardPage() {
  const dict = await getDictionary(await getLocale());
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login');

  return (
    <section className="stack">
      <h1>{dict.dashboard.title}</h1>
      <p className="muted">{dict.dashboard.intro}</p>
      <p className="note">{dict.auth.signedInAs} {data.claims.email}</p>
      <ul className="status-list">
        {PRICE_STATUSES.map((s) => (
          <li key={s} className="badge" data-status={s}>
            {dict.status[s]}
          </li>
        ))}
      </ul>
    </section>
  );
}
