import Link from 'next/link';
import Pager from '@/components/Pager';
import { accountName, adminFormat, adminHealth, fill } from '@/lib/admin';
import { formatPercent } from '@/lib/format';
import { pageHref, paginate } from '@/lib/pagination';
import { getDictionary, getLocale } from '../../dictionaries';

// Admin overview: one status headline (all clear, or how many things need
// action), a card per section with its headline number and a small picture of
// it, each drilling into its page, then the queue of issues.
export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.nav.admin };
}

const Arrow = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Card({ href, tone, label, value, count, hint, open, children }) {
  return (
    <Link href={href} className="admin-card" data-status={tone}>
      <span className="admin-card__label">{label}</span>
      <span className="admin-card__num" data-count={count}>{value}</span>
      <span className="admin-card__viz">{children}</span>
      <span className="admin-card__hint">{hint}</span>
      <span className="admin-card__open">{open}<Arrow /></span>
    </Link>
  );
}

export default async function AdminOverview({ searchParams }) {
  const { users, run, totals, chainName, issues, issueTone, pipelineTone, fresh } = await adminHealth();
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.admin;
  const o = t.overview;
  const { dateTime, num } = adminFormat(lang);
  const params = await searchParams;
  const page = paginate(params.issues, issues.length);
  const matched = totals.products - totals.unmatched - totals.matching;
  const text = (i) => fill(o[i.kind], { date: dateTime(i.date), chain: i.chain, n: num(i.n) });
  const headline = issues.length === 0 ? o.headlineClear : issues.length === 1 ? o.headlineOne : fill(o.headline, { n: num(issues.length) });

  return (
    <>
      <header className="admin-hero" data-status={issueTone}>
        <p className="admin-hero__kicker">
          <span className="admin-pulse" aria-hidden="true" />
          {run ? fill(o.checked, { date: dateTime(run.finished_at) }) : o.noRuns}
        </p>
        <h1>{headline}</h1>
        <p className="admin-hero__intro">{o.intro}</p>
      </header>

      <div className="admin-cards">
        <Card
          href="/dashboard/admin/pipeline"
          tone={pipelineTone}
          label={t.nav.pipeline}
          value={run ? `${run.ok_count}/${run.total_count}` : '—'}
          hint={run ? fill(o.pipelineHint, { date: dateTime(run.finished_at) }) : o.noRuns}
          open={o.open}
        >
          {run && (
            <span className="admin-chainbar">
              {run.scrape_run_results.map((r) => (
                <span key={r.competitor_key} data-status={r.ok ? 'competitive' : 'at-risk'} title={chainName.get(r.competitor_key) ?? r.competitor_key} data-grow />
              ))}
            </span>
          )}
        </Card>
        <Card
          href="/dashboard/admin/matching"
          tone={totals.matching ? 'opportunity' : 'competitive'}
          label={t.nav.matching}
          value={num(totals.products)}
          count={totals.products}
          hint={fill(o.matchingHint, {
            n: num(totals.matching),
            pct: totals.products ? formatPercent(totals.unmatched / totals.products, lang, 'auto') : '—',
          })}
          open={o.open}
        >
          <span className="admin-meter">
            <span data-status="competitive" style={{ flexGrow: matched }} data-grow />
            <span data-status="at-risk" style={{ flexGrow: totals.unmatched }} data-grow />
            <span data-status="opportunity" style={{ flexGrow: totals.matching }} data-grow />
          </span>
        </Card>
        <Card
          href="/dashboard/admin/users"
          tone="admin"
          label={t.nav.users}
          value={num(users.length)}
          count={users.length}
          hint={fill(o.usersHint, { n: num(fresh) })}
          open={o.open}
        >
          <span className="admin-faces">
            {users.slice(0, 5).map((u) => (
              <span key={u.id} className="admin-avatar" title={accountName(u)}>{accountName(u)[0].toUpperCase()}</span>
            ))}
          </span>
        </Card>
      </div>

      <section className="dash__panel" aria-labelledby="admin-attention">
        <div className="dash__panel-head">
          <h2 id="admin-attention">{o.attention}</h2>
          {issues.length > 0 && <span className="admin-count">{num(issues.length)}</span>}
        </div>
        {issues.length ? (
          <ul className="admin-queue">
            {issues.slice(page.from, page.to).map((i) => (
              <li key={text(i)} data-status={i.tone}>
                <Link href={`/dashboard/admin/${i.href}`}>
                  <span className="admin-queue__text">{text(i)}</span>
                  <span className="admin-queue__go">{t.nav[i.href.split('?')[0]]}<Arrow /></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-clear">{o.allClear}</p>
        )}
        <Pager {...page} href={pageHref('/dashboard/admin', params, 'issues')} t={dict.dashboard} label={o.attention} />
      </section>
    </>
  );
}
