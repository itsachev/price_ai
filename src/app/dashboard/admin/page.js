import Link from 'next/link';
import Pager from '@/components/Pager';
import { adminFormat, age, catalogTotals, check, fill, listAccounts, requireAdmin } from '@/lib/admin';
import { formatPercent } from '@/lib/format';
import { pageHref, paginate } from '@/lib/pagination';
import { getDictionary, getLocale } from '../../dictionaries';

// Admin overview: one card per section with its headline number and health
// tone, each drilling into its own page, then the few things that need action.
const DAY = 86_400_000;

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.nav.admin };
}

function Card({ href, tone, label, value, hint, open }) {
  return (
    <Link href={href} className="admin__card" data-status={tone}>
      <span className="admin__card-label">{label}</span>
      <span className="admin__card-num">{value}</span>
      <span className="admin__card-hint">{hint}</span>
      <span className="admin__card-open">
        {open}
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    </Link>
  );
}

export default async function AdminOverview({ searchParams }) {
  const { admin } = await requireAdmin();
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.admin;
  const o = t.overview;
  const { dateTime, num } = adminFormat(lang);
  const params = await searchParams;

  const [users, statsRes, runRes] = await Promise.all([
    listAccounts(admin),
    admin.rpc('admin_stats'),
    admin.from('scrape_runs').select('*, scrape_run_results(*)').order('id', { ascending: false }).limit(1).maybeSingle(),
  ]);
  check(statsRes, runRes);

  const { merchants, chains } = statsRes.data;
  const run = runRes.data;
  const totals = catalogTotals(merchants);
  const chainName = new Map(chains.map((c) => [c.key, c.name]));
  const failed = run?.scrape_run_results.filter((r) => !r.ok) ?? [];
  const stale = chains.filter((c) => !c.active);
  const staleRun = run && age(run.finished_at) > 1.5 * DAY;
  const fresh = users.filter((u) => age(u.created_at) < 7 * DAY).length;
  const unconfirmed = users.filter((u) => !u.email_confirmed_at).length;

  const attention = [
    !run && { href: 'pipeline', tone: 'at-risk', text: o.noRuns },
    staleRun && { href: 'pipeline', tone: 'at-risk', text: fill(o.staleRun, { date: dateTime(run.finished_at) }) },
    ...failed.map((r) => ({ href: 'pipeline', tone: 'at-risk', text: fill(o.chainFailed, { chain: chainName.get(r.competitor_key) ?? r.competitor_key }) })),
    ...stale.map((c) => ({ href: 'pipeline', tone: 'opportunity', text: fill(o.chainStale, { chain: c.name }) })),
    totals.matching > 0 && { href: 'matching', tone: 'opportunity', text: fill(o.waiting, { n: num(totals.matching) }) },
    unconfirmed > 0 && { href: 'users?show=unconfirmed', tone: 'opportunity', text: fill(o.unconfirmed, { n: num(unconfirmed) }) },
  ].filter(Boolean);
  const issues = paginate(params.issues, attention.length);

  return (
    <>
      <header className="dash__head">
        <div className="dash__title">
          <h1>{t.title}</h1>
          <p className="muted">{o.intro}</p>
        </div>
      </header>

      <div className="admin__cards">
        <Card
          href="/dashboard/admin/pipeline"
          tone={!run || staleRun || failed.length === run.total_count ? 'at-risk' : failed.length ? 'opportunity' : 'competitive'}
          label={t.nav.pipeline}
          value={run ? `${run.ok_count}/${run.total_count}` : '—'}
          hint={run ? fill(o.pipelineHint, { date: dateTime(run.finished_at) }) : o.noRuns}
          open={o.open}
        />
        <Card
          href="/dashboard/admin/matching"
          tone={totals.matching ? 'opportunity' : 'competitive'}
          label={t.nav.matching}
          value={num(totals.products)}
          hint={fill(o.matchingHint, {
            n: num(totals.matching),
            pct: totals.products ? formatPercent(totals.unmatched / totals.products, lang, 'auto') : '—',
          })}
          open={o.open}
        />
        <Card
          href="/dashboard/admin/users"
          tone="admin"
          label={t.nav.users}
          value={num(users.length)}
          hint={fill(o.usersHint, { n: num(fresh) })}
          open={o.open}
        />
      </div>

      <section className="dash__panel" aria-labelledby="admin-attention">
        <div className="dash__panel-head">
          <h2 id="admin-attention">{o.attention}</h2>
        </div>
        {attention.length ? (
          <ul className="admin__attention">
            {attention.slice(issues.from, issues.to).map((item) => (
              <li key={item.text} data-status={item.tone}>
                <Link href={`/dashboard/admin/${item.href}`}>{item.text}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin__clear">{o.allClear}</p>
        )}
        <Pager {...issues} href={pageHref('/dashboard/admin', params, 'issues')} t={dict.dashboard} label={o.attention} />
      </section>
    </>
  );
}
