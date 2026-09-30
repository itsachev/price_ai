import Pager from '@/components/Pager';
import { adminFormat, check, fill, requireAdmin } from '@/lib/admin';
import { PAGE_SIZE, pageHref, paginate } from '@/lib/pagination';
import { getDictionary, getLocale } from '../../../dictionaries';

// The daily scrape: each chain's result in the last run and how fresh its
// listings are, then every run, newest first. Both lists page (?chains, ?runs).
const PATH = '/dashboard/admin/pipeline';
const FAILED_DAYS = 30;
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

export async function generateMetadata() {
  const t = (await getDictionary(await getLocale())).admin;
  return { title: `${t.nav.pipeline} · ${t.title}` };
}

export default async function AdminPipeline({ searchParams }) {
  const { admin } = await requireAdmin();
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.admin;
  const params = await searchParams;
  const runPage = paginate(params.runs, Infinity);
  const p = t.pipeline;
  const { dateTime, duration, num } = adminFormat(lang);

  const [statsRes, lastRes, runsRes, failedRes] = await Promise.all([
    admin.rpc('admin_stats'),
    admin.from('scrape_runs').select('*, scrape_run_results(*)').order('id', { ascending: false }).limit(1).maybeSingle(),
    admin
      .from('scrape_runs')
      .select('*, scrape_run_results(*)', { count: 'exact' })
      .order('id', { ascending: false })
      .range(runPage.from, runPage.to - 1),
    admin.from('scrape_runs').select('id', { count: 'exact', head: true }).gt('failed_count', 0).gte('finished_at', daysAgo(FAILED_DAYS)),
  ]);
  check(statsRes, lastRes, runsRes, failedRes);

  const { chains } = statsRes.data;
  const runs = runsRes.data;
  const runPages = Math.max(1, Math.ceil((runsRes.count ?? 0) / PAGE_SIZE));
  const lastRun = lastRes.data;
  const chainPage = paginate(params.chains, chains.length);
  const lastResult = new Map(lastRun?.scrape_run_results.map((r) => [r.competitor_key, r]));
  const chainName = new Map(chains.map((c) => [c.key, c.name]));
  const active = chains.reduce((sum, c) => sum + c.active, 0);
  const result = (run) => (run.ok_count === run.total_count ? 'competitive' : run.ok_count ? 'opportunity' : 'at-risk');

  return (
    <>
      <header className="dash__head">
        <div className="dash__title">
          <h1>{p.title}</h1>
          <p className="muted">{p.intro}</p>
        </div>
      </header>

      <dl className="stat-grid">
        <div>
          <dt>{p.chainsOk}</dt>
          <dd>{lastRun ? `${lastRun.ok_count}/${lastRun.total_count}` : '—'}</dd>
          <small>{lastRun ? fill(p.lastRun, { date: dateTime(lastRun.finished_at) }) : p.noRuns}</small>
        </div>
        <div>
          <dt>{p.took}</dt>
          <dd>{lastRun ? duration(new Date(lastRun.finished_at) - new Date(lastRun.started_at)) : '—'}</dd>
        </div>
        <div>
          <dt>{p.activeListings}</dt>
          <dd>{num(active)}</dd>
          <small>{fill(p.chains, { n: num(chains.length) })}</small>
        </div>
        <div>
          <dt>{p.failedRuns}</dt>
          <dd>{num(failedRes.count)}</dd>
          <small>{fill(p.failedRunsHint, { n: FAILED_DAYS })}</small>
        </div>
      </dl>

      <section className="dash__panel" aria-labelledby="admin-chains">
        <div className="dash__panel-head">
          <h2 id="admin-chains">{p.chainsTitle}</h2>
        </div>
        <table className="dash__table">
          <thead>
            <tr>
              <th scope="col">{p.chain}</th>
              <th scope="col">{p.status}</th>
              <th scope="col" className="num">{p.codes}</th>
              <th scope="col" className="num">{p.active}</th>
              <th scope="col">{p.lastSeen}</th>
            </tr>
          </thead>
          <tbody>
            {chains.slice(chainPage.from, chainPage.to).map((c) => {
              const r = lastResult.get(c.key);
              return (
                <tr key={c.key}>
                  <th scope="row" className="dash__product">{c.name}</th>
                  <td data-label={p.status}>
                    {r ? (
                      <span className="badge" data-status={r.ok ? 'competitive' : 'at-risk'}>{r.ok ? p.ok : p.failed}</span>
                    ) : (
                      <span className="badge">{p.notRun}</span>
                    )}
                    {r?.error_message && <small className="admin__error">{r.error_message}</small>}
                  </td>
                  <td className="num" data-label={p.codes}>{r?.listing_count != null ? num(r.listing_count) : '—'}</td>
                  <td className="num" data-label={p.active}>{num(c.active)} / {num(c.listings)}</td>
                  <td data-label={p.lastSeen}>{dateTime(c.lastSeen)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pager {...chainPage} href={pageHref(PATH, params, 'chains')} t={dict.dashboard} label={p.chainsTitle} />
      </section>

      <section className="dash__panel" aria-labelledby="admin-runs">
        <div className="dash__panel-head">
          <h2 id="admin-runs">{p.runsTitle}</h2>
          <p className="muted">{fill(p.recent, { n: num(runsRes.count) })}</p>
        </div>
        {runs.length ? (
          <table className="dash__table">
            <thead>
              <tr>
                <th scope="col">{p.finished}</th>
                <th scope="col">{p.result}</th>
                <th scope="col">{p.took}</th>
                <th scope="col">{p.failedChainsCol}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const failed = run.scrape_run_results.filter((r) => !r.ok).map((r) => chainName.get(r.competitor_key) ?? r.competitor_key);
                return (
                  <tr key={run.id}>
                    <th scope="row" className="dash__product">{dateTime(run.finished_at)}</th>
                    <td data-label={p.result}>
                      <span className="badge" data-status={result(run)}>{run.ok_count}/{run.total_count}</span>
                    </td>
                    <td data-label={p.took}>{duration(new Date(run.finished_at) - new Date(run.started_at))}</td>
                    <td data-label={p.failedChainsCol}>{failed.length ? failed.join(', ') : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="admin__clear">{p.noRuns}</p>
        )}
        <Pager page={runPage.page} pages={runPages} href={pageHref(PATH, params, 'runs')} t={dict.dashboard} label={p.runsTitle} />
      </section>
    </>
  );
}
