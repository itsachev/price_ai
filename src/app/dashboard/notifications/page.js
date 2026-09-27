import { redirect } from 'next/navigation';
import { NotificationList, dayLabel, loadNotifications } from '@/components/Notifications';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../../dictionaries';

// ponytail: newest 200 only; add paging if a big catalog outgrows it.
const PAGE_LIMIT = 200;

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.notifications.title };
}

// Every notification, grouped by the feed day it came from. Read state is set by
// opening the header bell; this page only reads.
export default async function NotificationsPage() {
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.notifications;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect('/login?next=/dashboard/notifications');

  const { data, error } = await loadNotifications(supabase, PAGE_LIMIT);
  if (error) throw new Error(`notifications: ${error.message}`, { cause: error });

  const days = Map.groupBy(data, (n) => n.data_date);

  return (
    <section className="dash">
      <header className="dash__head">
        <div className="dash__title">
          <h1>{t.title}</h1>
          <p className="muted">{t.intro}</p>
        </div>
      </header>
      {days.size ? (
        [...days].map(([date, items]) => (
          <section key={date} className="dash__panel notif-day">
            <h2><time dateTime={date}>{dayLabel(date, lang)}</time></h2>
            <NotificationList items={items} t={t} lang={lang} />
          </section>
        ))
      ) : (
        <p className="dash__panel muted">{t.empty}</p>
      )}
    </section>
  );
}
