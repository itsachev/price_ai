import Link from 'next/link';
import { resendConfirmation, setAdmin, setBanned } from '@/app/actions/admin';
import AccountBadges from '@/components/AccountBadges';
import AdminAction, { ConfirmAction } from '@/components/AdminAction';
import Pager from '@/components/Pager';
import { accountName, adminFormat, check, fill, isAdmin, isBanned, listAccounts, requireAdmin } from '@/lib/admin';
import { pageHref, paginate } from '@/lib/pagination';
import { getDictionary, getLocale } from '../../../dictionaries';

// Every account with its catalog and the quick account actions, filterable by
// ?show=. Each name opens the account's page, which also holds Sign in as and
// Delete. The actions land back here with ?notice=<code>.
const FILTERS = {
  admins: isAdmin,
  banned: isBanned,
  unconfirmed: (u) => !u.email_confirmed_at,
};
const PAGE = '/dashboard/admin/users';
const ERRORS = ['failed', 'self', 'missing', 'rateLimited', 'unconfirmed'];

export async function generateMetadata() {
  const t = (await getDictionary(await getLocale())).admin;
  return { title: `${t.nav.users} · ${t.title}` };
}

export default async function AdminUsers({ searchParams }) {
  const { admin, userId } = await requireAdmin();
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.admin;
  const tu = t.users;
  const { date, dateTime, num } = adminFormat(lang);
  const params = await searchParams;
  const { notice, show } = params;
  const filter = FILTERS[show] ? show : null;

  const [users, statsRes] = await Promise.all([listAccounts(admin), admin.rpc('admin_stats')]);
  check(statsRes);
  const { merchants } = statsRes.data;
  const shown = filter ? users.filter(FILTERS[filter]) : users;
  const pager = paginate(params.page, shown.length);
  const chips = [[null, users.length], ...Object.entries(FILTERS).map(([key, test]) => [key, users.filter(test).length])];

  return (
    <>
      <header className="dash__head">
        <div className="dash__title">
          <h1>{tu.title}</h1>
          <p className="muted">{tu.intro}</p>
        </div>
      </header>

      {t.notices[notice] && (
        <p className="form-message" role="status" data-kind={ERRORS.includes(notice) ? 'error' : 'notice'}>
          {t.notices[notice]}
        </p>
      )}

      <nav className="admin__filters" aria-label={tu.filters.label}>
        {chips.map(([key, n]) => (
          <Link
            key={key ?? 'all'}
            href={key ? `${PAGE}?show=${key}` : PAGE}
            className="dash__chip"
            aria-current={filter === key ? 'page' : undefined}
          >
            {tu.filters[key ?? 'all']}
            <span className="admin__count">{num(n)}</span>
          </Link>
        ))}
      </nav>

      <section className="dash__panel" aria-labelledby="admin-users">
        <div className="dash__panel-head">
          <h2 id="admin-users">{tu.filters[filter ?? 'all']}</h2>
          <p className="muted">{fill(tu.count, { n: num(shown.length) })}</p>
        </div>
        {shown.length ? (
          <table className="dash__table">
            <thead>
              <tr>
                <th scope="col">{tu.user}</th>
                <th scope="col">{tu.joined}</th>
                <th scope="col">{tu.lastSignIn}</th>
                <th scope="col" className="num">{tu.products}</th>
                <th scope="col" className="num">{tu.atRisk}</th>
                <th scope="col">{tu.actions}</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(pager.from, pager.to).map((u) => {
                const m = merchants[u.id];
                const self = u.id === userId;
                const banned = isBanned(u);
                return (
                  <tr key={u.id}>
                    <td className="dash__product">
                      <Link href={`${PAGE}/${u.id}`}>{accountName(u)}</Link>
                      <small className="muted admin__email">{u.email}</small>
                      <AccountBadges user={u} self={self} t={tu} />
                    </td>
                    <td data-label={tu.joined}>{date(u.created_at)}</td>
                    <td data-label={tu.lastSignIn}>{dateTime(u.last_sign_in_at)}</td>
                    <td className="num" data-label={tu.products}>{num(m?.products)}</td>
                    <td className="num" data-label={tu.atRisk}>{num(m?.['at-risk'])}</td>
                    <td className="admin__cell" data-label={tu.actions}>
                      {self ? (
                        <span className="muted">—</span>
                      ) : (
                        <div className="admin__actions">
                          <ConfirmAction
                            action={setAdmin}
                            id={u.id}
                            on={!isAdmin(u)}
                            label={isAdmin(u) ? tu.removeAdmin : tu.makeAdmin}
                            text={fill(isAdmin(u) ? tu.removeAdminConfirm : tu.makeAdminConfirm, { email: u.email })}
                            closeLabel={t.close}
                            variant="quiet"
                            confirm={isAdmin(u) ? 'danger' : 'primary'}
                          />
                          {!u.email_confirmed_at && (
                            <AdminAction action={resendConfirmation} id={u.id} variant="quiet">{tu.resend}</AdminAction>
                          )}
                          <ConfirmAction
                            action={setBanned}
                            id={u.id}
                            on={!banned}
                            label={banned ? tu.unban : tu.ban}
                            text={fill(banned ? tu.unbanConfirm : tu.banConfirm, { email: u.email })}
                            closeLabel={t.close}
                            variant="danger-quiet"
                            confirm={banned ? 'primary' : 'danger'}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="admin__clear">{tu.empty}</p>
        )}
        <Pager {...pager} href={pageHref(PAGE, params, 'page')} t={dict.dashboard} label={tu.title} />
      </section>
    </>
  );
}
