import { PRICE_STATUSES } from '@/lib/config';
import { getDictionary } from '../dictionaries';

export default async function DashboardPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <section className="stack">
      <h1>{dict.dashboard.title}</h1>
      <p className="muted">{dict.dashboard.intro}</p>
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
