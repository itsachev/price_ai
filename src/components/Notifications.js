import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';
import { createClient } from '@/lib/supabase/server';
import { notificationText as text } from '@/lib/notifications';

const HEADER_LIMIT = 8;

// Newest first; within a day in the order the job wrote them (most urgent first).
export function loadNotifications(supabase, limit) {
  return supabase
    .from('notifications')
    .select('id, kind, data_date, old_price, new_price, count, read_at, product_id, product:products(name), listing:competitor_listings(competitor_key)')
    .order('data_date', { ascending: false })
    .order('id')
    .limit(limit);
}

export const dayLabel = (date, lang) =>
  new Intl.DateTimeFormat(lang === 'bg' ? 'bg-BG' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date));

// One list, used by the header popover and /dashboard/notifications. `showDate`
// adds each item's feed date (the page groups by date instead).
export function NotificationList({ items, t, lang, showDate = false }) {
  return (
    <ul className="notif-list">
      {items.map((n) => (
        <li key={n.id} data-kind={n.kind} data-unread={n.read_at ? undefined : ''}>
          <Link href={n.product_id ? `/dashboard/products/${n.product_id}` : '/dashboard'}>
            <span>{text(n, t, lang)}</span>
            {showDate && <time dateTime={n.data_date}>{dayLabel(n.data_date, lang)}</time>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Header bell. Streams in its own Suspense boundary, so no page waits on it.
// The root layout isn't re-rendered on client navigation, so the count is read
// once per page load (and after actions that refresh the layout).
// ponytail: a tab left open overnight shows yesterday's count until reload;
// re-read on focus if merchants miss new alerts.
export default async function Notifications({ dict, lang }) {
  const t = dict.notifications;
  const supabase = await createClient();
  const [list, unread] = await Promise.all([
    loadNotifications(supabase, HEADER_LIMIT),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ]);
  // Expired token on a marketing page (no proxy refresh there): show nothing.
  if (list.error || unread.error) return null;

  return (
    <NotificationBell unread={unread.count ?? 0} label={t.title}>
      <div className="bell__head">
        <p>{t.title}</p>
        <Link href="/dashboard/notifications">{t.seeAll}</Link>
      </div>
      {list.data.length ? (
        <NotificationList items={list.data} t={t} lang={lang} showDate />
      ) : (
        <p className="bell__empty">{t.empty}</p>
      )}
    </NotificationBell>
  );
}
