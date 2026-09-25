import { PRICE_STATUSES } from '@/lib/config';
import { getDictionary, getLocale } from '../dictionaries';

export default async function DashboardPage() {
  const dict = await getDictionary(await getLocale());

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
