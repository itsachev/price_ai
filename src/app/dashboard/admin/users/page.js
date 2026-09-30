import Link from 'next/link';
import AccountBadges from '@/components/AccountBadges';
import Pager from '@/components/Pager';
import { accountName, adminFormat, adminHealth, fill, isAdmin, isBanned } from '@/lib/admin';
import { pageHref, paginate } from '@/lib/pagination';
import { getDictionary, getLocale } from '../../../dictionaries';

// Every account with its catalog, filterable by ?show=. The list is for
// scanning: each row opens the account's page, which holds every action.
// Deleting an account lands back here with ?notice=<code>.
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
  const { users, stats, userId } = await adminHealth();
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.admin;
  const tu = t.users;
  const { date, dateTime, num } = adminFormat(lang);
  const params = await searchParams;
  const { notice, show } = params;
  const filter = FILTERS[show] ? show : null;

  const { merchants } = stats;
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

      <nav className="admin-filters" aria-label={tu.filters.label}>
        {chips.map(([key, n]) => (
          <Link key={key ?? 'all'} href={key ? `${PAGE}?show=${key}` : PAGE} aria-current={filter === key ? 'page' : undefined}>
            {tu.filters[key ?? 'all']}
            <span className="admin-count">{num(n)}</span>
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
                <th scope="col"><span className="visually-hidden">{tu.open}</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(pager.from, pager.to).map((u) => {
                const m = merchants[u.id];
                const self = u.id === userId;
                return (
                  <tr key={u.id}>
                    <td className="dash__product">
                      <span className="admin-who">
                        <span className="admin-avatar" aria-hidden="true">{accountName(u)[0].toUpperCase()}</span>
                        <span>
                          <Link href={`${PAGE}/${u.id}`}>{accountName(u)}</Link>
                          <small className="muted admin-email">{u.email}</small>
                          <AccountBadges user={u} self={self} t={tu} />
                        </span>
                      </span>
                    </td>
                    <td data-label={tu.joined}>{date(u.created_at)}</td>
                    <td data-label={tu.lastSignIn}>{dateTime(u.last_sign_in_at)}</td>
                    <td className="num" data-label={tu.products}>{num(m?.products)}</td>
                    <td className="num" data-label={tu.atRisk}>{num(m?.['at-risk'])}</td>
                    <td className="admin-chevron" aria-hidden="true">›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="admin-clear">{tu.empty}</p>
        )}
        <Pager {...pager} href={pageHref(PAGE, params, 'page')} t={dict.dashboard} label={tu.title} />
      </section>
    </>
  );
}
