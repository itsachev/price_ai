import Link from 'next/link';
import Pager from '@/components/Pager';
import { accountName, adminFormat, catalogTotals, check, fill, listAccounts, requireAdmin } from '@/lib/admin';
import { formatPercent } from '@/lib/format';
import { pageHref, paginate } from '@/lib/pagination';
import { getDictionary, getLocale } from '../../../dictionaries';

// Matching: the shared verdict cache, and how much of each catalog it covers.
export async function generateMetadata() {
  const t = (await getDictionary(await getLocale())).admin;
  return { title: `${t.nav.matching} · ${t.title}` };
}

export default async function AdminMatching({ searchParams }) {
  const { admin } = await requireAdmin();
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.admin;
  const params = await searchParams;
  const m = t.matching;
  const { dateTime, num } = adminFormat(lang);
  const pct = (part, whole) => (whole ? formatPercent(part / whole, lang, 'auto') : '—');

  const [users, statsRes] = await Promise.all([listAccounts(admin), admin.rpc('admin_stats')]);
  check(statsRes);

  const { merchants, verdicts } = statsRes.data;
  const totals = catalogTotals(merchants);
  const judged = verdicts.confirmed + verdicts.rejected;
  const name = new Map(users.map((u) => [u.id, accountName(u)]));
  const coverage = Object.entries(merchants)
    .map(([id, c]) => ({ id, ...c, matched: c.products - c.unmatched - c.matching }))
    .toSorted((a, b) => b.products - a.products);
  const coveragePage = paginate(params.accounts, coverage.length);

  return (
    <>
      <header className="dash__head">
        <div className="dash__title">
          <h1>{m.title}</h1>
          <p className="muted">{m.intro}</p>
        </div>
      </header>

      <dl className="stat-grid">
        <div>
          <dt>{t.stats.products}</dt>
          <dd>{num(totals.products)}</dd>
        </div>
        <div>
          <dt>{t.stats.matching}</dt>
          <dd>{num(totals.matching)}</dd>
          <small>{t.stats.matchingHint}</small>
        </div>
        <div>
          <dt>{m.unmatched}</dt>
          <dd>{pct(totals.unmatched, totals.products)}</dd>
          <small>{fill(m.unmatchedHint, { n: num(totals.unmatched) })}</small>
        </div>
        <div>
          <dt>{m.lastDay}</dt>
          <dd>{num(verdicts.lastDay)}</dd>
          <small>{fill(m.latest, { date: dateTime(verdicts.latest) })}</small>
        </div>
      </dl>

      <section className="dash__panel" aria-labelledby="admin-verdicts">
        <div className="dash__panel-head">
          <h2 id="admin-verdicts">{m.cache}</h2>
          <p className="muted">{fill(m.cacheHint, { n: num(judged) })}</p>
        </div>
        <div className="admin__split">
          <div className="admin__meter" aria-hidden="true">
            <span data-status="competitive" style={{ flexGrow: verdicts.confirmed }} />
            <span data-status="at-risk" style={{ flexGrow: verdicts.rejected }} />
          </div>
          <dl className="admin__legend">
            <div data-status="competitive">
              <dt>{m.confirmed}</dt>
              <dd>{num(verdicts.confirmed)} <small>{pct(verdicts.confirmed, judged)}</small></dd>
            </div>
            <div data-status="at-risk">
              <dt>{m.rejected}</dt>
              <dd>{num(verdicts.rejected)} <small>{pct(verdicts.rejected, judged)}</small></dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="dash__panel" aria-labelledby="admin-coverage">
        <div className="dash__panel-head">
          <h2 id="admin-coverage">{m.coverage}</h2>
        </div>
        {coverage.length ? (
          <table className="dash__table">
            <thead>
              <tr>
                <th scope="col">{t.users.user}</th>
                <th scope="col" className="num">{t.stats.products}</th>
                <th scope="col" className="num">{m.matched}</th>
                <th scope="col" className="num">{m.unmatchedCol}</th>
                <th scope="col" className="num">{m.waiting}</th>
              </tr>
            </thead>
            <tbody>
              {coverage.slice(coveragePage.from, coveragePage.to).map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="dash__product">
                    <Link href={`/dashboard/admin/users/${c.id}`}>{name.get(c.id) ?? c.id}</Link>
                  </th>
                  <td className="num" data-label={t.stats.products}>{num(c.products)}</td>
                  <td className="num" data-label={m.matched}>{pct(c.matched, c.products)}</td>
                  <td className="num" data-label={m.unmatchedCol}>{num(c.unmatched)}</td>
                  <td className="num" data-label={m.waiting}>{num(c.matching)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="admin__clear">{m.none}</p>
        )}
        <Pager {...coveragePage} href={pageHref('/dashboard/admin/matching', params, 'accounts')} t={dict.dashboard} label={m.coverage} />
      </section>
    </>
  );
}
