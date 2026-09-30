import Link from 'next/link';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { deleteUser, impersonate, resendConfirmation, setAdmin, setBanned } from '@/app/actions/admin';
import AccountBadges from '@/components/AccountBadges';
import AdminAction, { ConfirmAction } from '@/components/AdminAction';
import Pager from '@/components/Pager';
import { accountName, adminFormat, adminHealth, check, fill, isAdmin, isBanned, isUuid, requireAdmin } from '@/lib/admin';
import { formatPercent, formatPrice } from '@/lib/format';
import { PAGE_SIZE, pageHref, paginate } from '@/lib/pagination';
import { getDictionary, getLocale } from '../../../../dictionaries';

// One account, as an admin sees it: who it is and the one primary action
// (Sign in as), its catalog numbers, an Access panel where each row states
// what's true now and offers the one change (admin role, sign-in, email),
// details and pricing rules, its products (paged), and a Delete zone that
// asks for the email to be typed first.
const LIST = '/dashboard/admin/users';
const ERRORS = ['failed', 'self', 'missing', 'rateLimited', 'unconfirmed'];
const STATUSES = ['at-risk', 'opportunity', 'competitive'];

// Cached per request: the metadata and the page both need it.
const loadUser = cache(async (admin, id) => {
  if (!isUuid(id)) notFound();
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data?.user) notFound();
  return data.user;
});

export async function generateMetadata({ params }) {
  const { admin } = await requireAdmin();
  const t = (await getDictionary(await getLocale())).admin;
  const user = await loadUser(admin, (await params).id);
  return { title: `${accountName(user)} · ${t.title}` };
}

function Access({ tone, title, state, children }) {
  return (
    <li data-status={tone}>
      <span className="admin-access__text">
        <strong>{title}</strong>
        <span>{state}</span>
      </span>
      {children}
    </li>
  );
}

export default async function AdminAccount({ params, searchParams }) {
  const { admin, userId, stats } = await adminHealth();
  const { id } = await params;
  const query = await searchParams;
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.admin;
  const tu = t.users;
  const ta = t.account;
  const { date, dateTime, num } = adminFormat(lang);
  const path = `${LIST}/${id}`;
  const productPage = paginate(query.page, Infinity);

  const user = await loadUser(admin, id);
  const [rulesRes, productsRes] = await Promise.all([
    admin.from('pricing_rules').select('*').eq('owner_id', id).maybeSingle(),
    admin
      .from('products')
      .select('id, name, brand, size, sku, price, cost, price_status, match_key', { count: 'exact' })
      .eq('owner_id', id)
      .order('name')
      .range(productPage.from, productPage.to - 1),
  ]);
  check(rulesRes, productsRes);

  const counts = stats.merchants[id] ?? {};
  const rules = rulesRes.data;
  const products = productsRes.data;
  const productPages = Math.max(1, Math.ceil((productsRes.count ?? 0) / PAGE_SIZE));
  const self = id === userId;
  const admined = isAdmin(user);
  const banned = isBanned(user);
  const confirmed = Boolean(user.email_confirmed_at);
  const name = accountName(user);
  const pct = (v) => (v == null ? ta.off : formatPercent(Number(v), lang, 'auto'));
  const { notice } = query;

  return (
    <>
      <Link href={LIST} className="pd__back">← {ta.back}</Link>

      <header className="admin-profile">
        <span className="admin-avatar admin-avatar--lg" aria-hidden="true">{name[0].toUpperCase()}</span>
        <div className="admin-profile__who">
          <h1>{name}</h1>
          <p className="muted admin-email">{user.email}</p>
          <p className="admin-profile__meta">
            {fill(ta.since, { date: date(user.created_at) })} · {fill(ta.seen, { date: dateTime(user.last_sign_in_at) })}
          </p>
          <p className="admin-profile__meta admin-mono" title={ta.id}>{user.id}</p>
          <AccountBadges user={user} self={self} t={tu} />
        </div>
        {!self && confirmed && (
          <div className="admin-profile__cta">
            <ConfirmAction
              action={impersonate}
              id={id}
              back
              label={tu.impersonate}
              text={fill(tu.impersonateConfirm, { email: user.email })}
              closeLabel={t.close}
              variant="primary"
            />
          </div>
        )}
      </header>

      {t.notices[notice] && (
        <p className="form-message" role="status" data-kind={ERRORS.includes(notice) ? 'error' : 'notice'}>
          {t.notices[notice]}
        </p>
      )}
      {self && <p className="form-message">{ta.self}</p>}

      <dl className="stat-grid">
        <div>
          <dt>{tu.products}</dt>
          <dd data-count={counts.products ?? 0}>{num(counts.products)}</dd>
          <small>{fill(ta.waiting, { n: num(counts.matching) })}</small>
        </div>
        {STATUSES.map((s) => (
          <div key={s} data-status={s}>
            <dt className="admin-stat-label">{dict.status[s]}</dt>
            <dd data-count={counts[s] ?? 0}>{num(counts[s])}</dd>
          </div>
        ))}
      </dl>

      <div className="admin-panels">
        <section className="dash__panel" aria-labelledby="account-access">
          <div className="dash__panel-head">
            <h2 id="account-access">{ta.access}</h2>
          </div>
          <ul className="admin-access">
            <Access tone={admined ? 'admin' : undefined} title={ta.role} state={admined ? ta.roleAdmin : ta.roleMember}>
              {!self && (
                <ConfirmAction
                  action={setAdmin}
                  id={id}
                  on={!admined}
                  back
                  label={admined ? tu.removeAdmin : tu.makeAdmin}
                  text={fill(admined ? tu.removeAdminConfirm : tu.makeAdminConfirm, { email: user.email })}
                  closeLabel={t.close}
                  variant="quiet"
                  confirm={admined ? 'danger' : 'primary'}
                />
              )}
            </Access>
            <Access
              tone={banned ? 'at-risk' : 'competitive'}
              title={ta.signIn}
              state={banned ? fill(ta.signInBanned, { date: date(user.banned_until) }) : ta.signInAllowed}
            >
              {!self && (
                <ConfirmAction
                  action={setBanned}
                  id={id}
                  on={!banned}
                  back
                  label={banned ? tu.unban : tu.ban}
                  text={fill(banned ? tu.unbanConfirm : tu.banConfirm, { email: user.email })}
                  closeLabel={t.close}
                  variant={banned ? 'quiet' : 'danger-quiet'}
                  confirm={banned ? 'primary' : 'danger'}
                />
              )}
            </Access>
            <Access
              tone={confirmed ? 'competitive' : 'opportunity'}
              title={ta.email}
              state={confirmed ? fill(ta.confirmedOn, { date: date(user.email_confirmed_at) }) : ta.notConfirmed}
            >
              {!self && !confirmed && (
                <AdminAction action={resendConfirmation} id={id} back variant="quiet">{tu.resend}</AdminAction>
              )}
            </Access>
          </ul>
        </section>

        <section className="dash__panel" aria-labelledby="account-rules">
          <div className="dash__panel-head">
            <h2 id="account-rules">{ta.rules}</h2>
            {!rules && <p className="muted">{ta.defaults}</p>}
          </div>
          <dl className="admin-details">
            <div><dt>{dict.settings.rules.fields.min_margin}</dt><dd>{pct(rules?.min_margin)}</dd></div>
            <div><dt>{dict.settings.rules.fields.undercut}</dt><dd>{Number(rules?.undercut) ? formatPrice(rules.undercut, lang) : ta.off}</dd></div>
            <div><dt>{dict.settings.rules.fields.max_change}</dt><dd>{pct(rules?.max_change)}</dd></div>
          </dl>
        </section>
      </div>

      <section className="dash__panel" aria-labelledby="account-products">
        <div className="dash__panel-head">
          <h2 id="account-products">{tu.products}</h2>
          <p className="muted">{fill(ta.count, { n: num(productsRes.count) })}</p>
        </div>
        {products.length ? (
          <table className="dash__table">
            <thead>
              <tr>
                <th scope="col">{ta.product}</th>
                <th scope="col">{ta.sku}</th>
                <th scope="col" className="num">{ta.price}</th>
                <th scope="col" className="num">{ta.cost}</th>
                <th scope="col">{ta.status}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} data-status={p.match_key ? p.price_status : undefined}>
                  <th scope="row" className="dash__product">
                    {p.name}
                    {(p.brand || p.size) && <small className="muted admin-email">{[p.brand, p.size].filter(Boolean).join(' · ')}</small>}
                  </th>
                  <td data-label={ta.sku}>{p.sku ?? '—'}</td>
                  <td className="num" data-label={ta.price}>{formatPrice(p.price, lang)}</td>
                  <td className="num" data-label={ta.cost}>{p.cost != null ? formatPrice(p.cost, lang) : '—'}</td>
                  <td data-label={ta.status}>
                    {p.match_key ? (
                      <span className="badge" data-status={p.price_status}>{dict.status[p.price_status]}</span>
                    ) : (
                      <span className="badge" data-status="matching">{ta.matching}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="admin-clear">{ta.noProducts}</p>
        )}
        <Pager page={productPage.page} pages={productPages} href={pageHref(path, query, 'page')} t={dict.dashboard} label={tu.products} />
      </section>

      {!self && (
        <section className="admin-danger" aria-labelledby="account-danger">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2zM12 10v5M12 18h.01" /></svg>
          <div className="admin-danger__text">
            <h2 id="account-danger">{ta.danger}</h2>
            <p>{ta.dangerIntro}</p>
          </div>
          <ConfirmAction
            action={deleteUser}
            id={id}
            back
            label={tu.delete}
            text={fill(tu.deleteConfirm, { email: user.email, n: num(counts.products) })}
            guard={user.email}
            guardLabel={fill(ta.typeEmail, { email: user.email })}
            closeLabel={t.close}
            variant="danger"
          />
        </section>
      )}
    </>
  );
}
