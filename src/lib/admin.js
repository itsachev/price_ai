import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Admins carry app_metadata.role = 'admin'. Users can't edit app_metadata, and
// only an admin (or `npm run make-admin`) sets it.
export const isAdmin = (user) => user?.app_metadata?.role === 'admin';
// Milliseconds since a timestamp.
export const age = (value) => Date.now() - new Date(value);
// Auth user ids are UUIDs; getUserById throws (not errors) on anything else.
export const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export const accountName = (user) => user.user_metadata?.username || user.email?.split('@')[0] || user.id;
export const isBanned = (user) => Boolean(user.banned_until && new Date(user.banned_until) > new Date());

// Guard for the admin pages and their actions. The role is read fresh from the
// auth server, not from the JWT, so granting or revoking it applies at once
// instead of after the next token refresh. Non-admins get a 404, so the pages
// don't advertise themselves. Cached per request, so the admin layout and page
// share one lookup. Returns the service-role client and the admin's id.
export const requireAdmin = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login?next=/dashboard/admin');
  const admin = createAdminClient();
  const { data: found } = await admin.auth.admin.getUserById(data.claims.sub);
  if (!isAdmin(found?.user)) notFound();
  return { admin, userId: data.claims.sub };
});

// Shared by the admin pages.
export function check(...results) {
  for (const res of results) {
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
  }
}

export const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);

export function adminFormat(lang) {
  const locale = lang === 'bg' ? 'bg-BG' : 'en-IE';
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const times = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const nums = new Intl.NumberFormat(locale);
  const unit = (u) => new Intl.NumberFormat(locale, { style: 'unit', unit: u, unitDisplay: 'short', maximumFractionDigits: 0 });
  return {
    date: (value) => (value ? dates.format(new Date(value)) : '—'),
    dateTime: (value) => (value ? times.format(new Date(value)) : '—'),
    num: (n) => nums.format(n ?? 0),
    duration: (ms) => (ms < 60_000 ? unit('second').format(ms / 1000) : unit('minute').format(ms / 60_000)),
  };
}

// ponytail: first 1000 accounts; page listUsers when there are more.
export async function listAccounts(admin) {
  const res = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  check(res);
  return res.data.users.toSorted((a, b) => b.created_at.localeCompare(a.created_at));
}

const DAY = 86_400_000;

// Everything the console's health reads: the accounts, admin_stats() and the
// last scrape run, plus the open issues (data, not text; the overview words
// them). Cached per request, so the layout's side rail and the page share one
// set of queries.
export const adminHealth = cache(async () => {
  const { admin, userId } = await requireAdmin();
  const [users, statsRes, runRes] = await Promise.all([
    listAccounts(admin),
    admin.rpc('admin_stats'),
    admin.from('scrape_runs').select('*, scrape_run_results(*)').order('id', { ascending: false }).limit(1).maybeSingle(),
  ]);
  check(statsRes, runRes);

  const stats = statsRes.data;
  const run = runRes.data;
  const totals = catalogTotals(stats.merchants);
  const chainName = new Map(stats.chains.map((c) => [c.key, c.name]));
  const failed = run?.scrape_run_results.filter((r) => !r.ok) ?? [];
  const staleRun = Boolean(run) && age(run.finished_at) > 1.5 * DAY;
  const unconfirmed = users.filter((u) => !u.email_confirmed_at).length;
  const issues = [
    !run && { kind: 'noRuns', href: 'pipeline', tone: 'at-risk' },
    staleRun && { kind: 'staleRun', href: 'pipeline', tone: 'at-risk', date: run.finished_at },
    ...failed.map((r) => ({ kind: 'chainFailed', href: 'pipeline', tone: 'at-risk', chain: chainName.get(r.competitor_key) ?? r.competitor_key })),
    ...stats.chains.filter((c) => !c.active).map((c) => ({ kind: 'chainStale', href: 'pipeline', tone: 'opportunity', chain: c.name })),
    totals.matching > 0 && { kind: 'waiting', href: 'matching', tone: 'opportunity', n: totals.matching },
    unconfirmed > 0 && { kind: 'unconfirmed', href: 'users?show=unconfirmed', tone: 'opportunity', n: unconfirmed },
  ].filter(Boolean);

  return {
    admin,
    userId,
    users,
    stats,
    run,
    totals,
    chainName,
    staleRun,
    issues,
    fresh: users.filter((u) => age(u.created_at) < 7 * DAY).length,
    pipelineTone: !run || staleRun || failed.length === run.total_count ? 'at-risk' : failed.length ? 'opportunity' : 'competitive',
    issueTone: issues.some((i) => i.tone === 'at-risk') ? 'at-risk' : issues.length ? 'opportunity' : 'competitive',
  };
});

// Catalog totals over every merchant, from admin_stats().merchants.
export function catalogTotals(merchants) {
  return Object.values(merchants).reduce(
    (sum, m) => ({ products: sum.products + m.products, unmatched: sum.unmatched + m.unmatched, matching: sum.matching + m.matching }),
    { products: 0, unmatched: 0, matching: 0 },
  );
}
