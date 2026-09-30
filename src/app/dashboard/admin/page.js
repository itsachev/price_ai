import { deleteUser, impersonate, resendConfirmation, setAdmin, setBanned } from '@/app/actions/admin';
import ButtonLabel from '@/components/ButtonLabel';
import ProductDialog from '@/components/ProductDialog';
import { isAdmin, requireAdmin } from '@/lib/admin';
import { formatPercent } from '@/lib/format';
import { getDictionary, getLocale } from '../../dictionaries';

// Operator view, admins only (app_metadata.role, checked live by requireAdmin;
// everyone else gets a 404). Reads through the service-role client: the daily
// pipeline's health, the match cache and every account, with account actions.
// ponytail: first 1000 accounts and 10 runs; page both when they outgrow it.
const USERS_LIMIT = 1000;
const RUNS = 10;
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);

function check(...results) {
  for (const res of results) {
    if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`, { cause: res.error });
  }
}

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.nav.admin };
}

// A small action form: hidden id (and flag), one button.
function Action({ action, id, on, variant, children }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {on != null && <input type="hidden" name="on" value={on ? '1' : ''} />}
      <button className={variant ? `button button--${variant}` : 'button'}>
        <ButtonLabel>{children}</ButtonLabel>
      </button>
    </form>
  );
}

export default async function AdminPage({ searchParams }) {
  const { admin, userId } = await requireAdmin();
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.admin;
  const { notice } = await searchParams;

  const [usersRes, statsRes, runsRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: USERS_LIMIT }),
    admin.rpc('admin_stats'),
    admin.from('scrape_runs').select('*, scrape_run_results(*)').order('id', { ascending: false }).limit(RUNS),
  ]);
  check(usersRes, statsRes, runsRes);

  const locale = lang === 'bg' ? 'bg-BG' : 'en-IE';
  const date = (value) => (value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value)) : '—');
  const dateTime = (value) => (value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—');
  const num = (n) => new Intl.NumberFormat(locale).format(n ?? 0);

  const { merchants, verdicts, chains } = statsRes.data;
  const runs = runsRes.data;
  const users = usersRes.data.users.toSorted((a, b) => b.created_at.localeCompare(a.created_at));
  const totals = Object.values(merchants).reduce(
    (sum, m) => ({ products: sum.products + m.products, unmatched: sum.unmatched + m.unmatched, matching: sum.matching + m.matching }),
    { products: 0, unmatched: 0, matching: 0 },
  );
  const lastRun = runs[0];
  const lastResult = new Map(lastRun?.scrape_run_results.map((r) => [r.competitor_key, r]));
  const chainName = new Map(chains.map((c) => [c.key, c.name]));
  const banned = (u) => u.banned_until && new Date(u.banned_until) > new Date();

  return (
    <section className="dash admin">
      <header className="dash__head">
        <div className="dash__title">
          <h1>{t.title}</h1>
          <p className="muted">{t.intro}</p>
        </div>
      </header>

      {t.notices[notice] && (
        <p className="form-message" role="status" data-kind={['failed', 'self', 'missing', 'rateLimited', 'unconfirmed'].includes(notice) ? 'error' : 'notice'}>
          {t.notices[notice]}
        </p>
      )}

      <dl className="stat-grid">
        <div><dt>{t.stats.users}</dt><dd>{num(users.length)}</dd></div>
        <div><dt>{t.stats.products}</dt><dd>{num(totals.products)}</dd></div>
        <div>
          <dt>{t.stats.lastRun}</dt>
          <dd>{lastRun ? `${lastRun.ok_count}/${lastRun.total_count}` : '—'}</dd>
          <small>{dateTime(lastRun?.finished_at)}</small>
        </div>
        <div>
          <dt>{t.stats.matching}</dt>
          <dd>{num(totals.matching)}</dd>
          <small>{t.stats.matchingHint}</small>
        </div>
      </dl>

      <section className="dash__panel" id="pipeline" aria-labelledby="admin-pipeline">
        <div className="dash__panel-head">
          <h2 id="admin-pipeline">{t.pipeline.title}</h2>
          <p className="muted">{lastRun ? fill(t.pipeline.lastRun, { date: dateTime(lastRun.finished_at) }) : t.pipeline.noRuns}</p>
        </div>
        <table className="dash__table">
          <thead>
            <tr>
              <th scope="col">{t.pipeline.chain}</th>
              <th scope="col">{t.pipeline.status}</th>
              <th scope="col" className="num">{t.pipeline.codes}</th>
              <th scope="col" className="num">{t.pipeline.active}</th>
              <th scope="col">{t.pipeline.lastSeen}</th>
            </tr>
          </thead>
          <tbody>
            {chains.map((c) => {
              const r = lastResult.get(c.key);
              return (
                <tr key={c.key}>
                  <th scope="row" className="dash__product">{c.name}</th>
                  <td data-label={t.pipeline.status}>
                    {r ? (
                      <span className="badge" data-status={r.ok ? 'competitive' : 'at-risk'}>{r.ok ? t.pipeline.ok : t.pipeline.failed}</span>
                    ) : (
                      <span className="badge">{t.pipeline.notRun}</span>
                    )}
                    {r?.error_message && <small className="admin__error">{r.error_message}</small>}
                  </td>
                  <td className="num" data-label={t.pipeline.codes}>{r?.listing_count != null ? num(r.listing_count) : '—'}</td>
                  <td className="num" data-label={t.pipeline.active}>{num(c.active)} / {num(c.listings)}</td>
                  <td data-label={t.pipeline.lastSeen}>{dateTime(c.lastSeen)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {runs.length > 1 && (
          <details className="admin__runs">
            <summary>{fill(t.pipeline.recent, { n: runs.length })}</summary>
            <ul>
              {runs.map((run) => {
                const failed = run.scrape_run_results.filter((r) => !r.ok).map((r) => chainName.get(r.competitor_key) ?? r.competitor_key);
                return (
                  <li key={run.id}>
                    <span>{dateTime(run.finished_at)}</span>
                    <strong>{run.ok_count}/{run.total_count}</strong>
                    {failed.length > 0 && <span className="muted">{fill(t.pipeline.failedChains, { chains: failed.join(', ') })}</span>}
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </section>

      <section className="admin__section" id="matching" aria-labelledby="admin-matching">
        <h2 id="admin-matching">{t.matching.title}</h2>
        <dl className="stat-grid">
          <div><dt>{t.matching.confirmed}</dt><dd>{num(verdicts.confirmed)}</dd></div>
          <div><dt>{t.matching.rejected}</dt><dd>{num(verdicts.rejected)}</dd></div>
          <div>
            <dt>{t.matching.lastDay}</dt>
            <dd>{num(verdicts.lastDay)}</dd>
            <small>{fill(t.matching.latest, { date: dateTime(verdicts.latest) })}</small>
          </div>
          <div>
            <dt>{t.matching.unmatched}</dt>
            <dd>{totals.products ? formatPercent(totals.unmatched / totals.products, lang, 'auto') : '—'}</dd>
            <small>{fill(t.matching.unmatchedHint, { n: num(totals.unmatched) })}</small>
          </div>
        </dl>
      </section>

      <section className="dash__panel" id="users" aria-labelledby="admin-users">
        <div className="dash__panel-head">
          <h2 id="admin-users">{t.users.title}</h2>
          <p className="muted">{fill(t.users.count, { n: num(users.length) })}</p>
        </div>
        <table className="dash__table">
          <thead>
            <tr>
              <th scope="col">{t.users.user}</th>
              <th scope="col">{t.users.joined}</th>
              <th scope="col">{t.users.lastSignIn}</th>
              <th scope="col" className="num">{t.users.products}</th>
              <th scope="col" className="num">{t.users.atRisk}</th>
              <th scope="col">{t.users.actions}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const m = merchants[u.id];
              const self = u.id === userId;
              const name = u.user_metadata?.username || u.email?.split('@')[0] || u.id;
              return (
                <tr key={u.id}>
                  <td className="dash__product">
                    <strong>{name}</strong>
                    <small className="muted admin__email">{u.email}</small>
                    <span className="admin__badges">
                      {self && <span className="badge" data-status="admin">{t.users.you}</span>}
                      {isAdmin(u) && <span className="badge" data-status="admin">{t.users.admin}</span>}
                      {banned(u) && <span className="badge" data-status="at-risk">{t.users.banned}</span>}
                      {!u.email_confirmed_at && <span className="badge" data-status="opportunity">{t.users.unconfirmed}</span>}
                    </span>
                  </td>
                  <td data-label={t.users.joined}>{date(u.created_at)}</td>
                  <td data-label={t.users.lastSignIn}>{dateTime(u.last_sign_in_at)}</td>
                  <td className="num" data-label={t.users.products}>{num(m?.products)}</td>
                  <td className="num" data-label={t.users.atRisk}>{num(m?.['at-risk'])}</td>
                  <td className="admin__cell" data-label={t.users.actions}>
                    {self ? (
                      <span className="muted">—</span>
                    ) : (
                      <div className="admin__actions">
                        <Action action={setAdmin} id={u.id} on={!isAdmin(u)} variant="quiet">
                          {isAdmin(u) ? t.users.removeAdmin : t.users.makeAdmin}
                        </Action>
                        {u.email_confirmed_at ? (
                          <ProductDialog label={t.users.impersonate} title={t.users.impersonate} closeLabel={t.close} variant="quiet">
                            <p>{fill(t.users.impersonateConfirm, { email: u.email })}</p>
                            <div className="product-form__actions">
                              <Action action={impersonate} id={u.id} variant="primary">{t.users.impersonate}</Action>
                            </div>
                          </ProductDialog>
                        ) : (
                          <Action action={resendConfirmation} id={u.id} variant="quiet">{t.users.resend}</Action>
                        )}
                        <Action action={setBanned} id={u.id} on={!banned(u)} variant="danger-quiet">
                          {banned(u) ? t.users.unban : t.users.ban}
                        </Action>
                        <ProductDialog label={t.users.delete} title={t.users.delete} closeLabel={t.close} variant="danger-quiet">
                          <p>{fill(t.users.deleteConfirm, { email: u.email, n: num(m?.products) })}</p>
                          <div className="product-form__actions">
                            <Action action={deleteUser} id={u.id} variant="danger">{t.users.delete}</Action>
                          </div>
                        </ProductDialog>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </section>
  );
}
