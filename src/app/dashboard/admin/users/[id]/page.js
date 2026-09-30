import Link from 'next/link';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { deleteUser, impersonate, resendConfirmation, setAdmin, setBanned } from '@/app/actions/admin';
import AccountBadges from '@/components/AccountBadges';
import AdminAction, { ConfirmAction } from '@/components/AdminAction';
import Pager from '@/components/Pager';
import { accountName, adminFormat, check, fill, isAdmin, isBanned, isUuid, requireAdmin } from '@/lib/admin';
import { formatPercent, formatPrice } from '@/lib/format';
import { PAGE_SIZE, pageHref, paginate } from '@/lib/pagination';
import { getDictionary, getLocale } from '../../../../dictionaries';

// One account, as an admin sees it: profile, catalog numbers, pricing rules
// and its products (paged), with every account action. Sign in as and Delete
// live only here, so they're never one mis-click away in the list.
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

export default async function AdminAccount({ params, searchParams }) {
  const { admin, userId } = await requireAdmin();
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
  const [statsRes, rulesRes, productsRes] = await Promise.all([
    admin.rpc('admin_stats'),
    admin.from('pricing_rules').select('*').eq('owner_id', id).maybeSingle(),
    admin
      .from('products')
      .select('id, name, brand, size, sku, price, cost, price_status, match_key', { count: 'exact' })
      .eq('owner_id', id)
      .order('name')
      .range(productPage.from, productPage.to - 1),
  ]);
  check(statsRes, rulesRes, productsRes);

  const counts = statsRes.data.merchants[id] ?? {};
  const rules = rulesRes.data;
  const products = productsRes.data;
  const productPages = Math.max(1, Math.ceil((productsRes.count ?? 0) / PAGE_SIZE));
  const self = id === userId;
  const banned = isBanned(user);
  const name = accountName(user);
  const pct = (v) => (v == null ? ta.off : formatPercent(Number(v), lang, 'auto'));
  const { notice } = query;

  return (
    <>
      <Link href={LIST} className="pd__back">← {ta.back}</Link>

      <header className="dash__head">
        <div className="admin__profile">
          <span className="admin__avatar" aria-hidden="true">{name[0].toUpperCase()}</span>
          <div className="dash__title">
            <h1>{name}</h1>
            <p className="muted admin__email">{user.email}</p>
            <AccountBadges user={user} self={self} t={tu} />
          </div>
        </div>
        {!self && (
          <div className="admin__actions">
            {user.email_confirmed_at ? (
              <ConfirmAction
                action={impersonate}
                id={id}
                back
                label={tu.impersonate}
                text={fill(tu.impersonateConfirm, { email: user.email })}
                closeLabel={t.close}
                variant="primary"
              />
            ) : (
              <AdminAction action={resendConfirmation} id={id} back>{tu.resend}</AdminAction>
            )}
            <ConfirmAction
              action={setAdmin}
              id={id}
              on={!isAdmin(user)}
              back
              label={isAdmin(user) ? tu.removeAdmin : tu.makeAdmin}
              text={fill(isAdmin(user) ? tu.removeAdminConfirm : tu.makeAdminConfirm, { email: user.email })}
              closeLabel={t.close}
              variant="quiet"
              confirm={isAdmin(user) ? 'danger' : 'primary'}
            />
            <ConfirmAction
              action={setBanned}
              id={id}
              on={!banned}
              back
              label={banned ? tu.unban : tu.ban}
              text={fill(banned ? tu.unbanConfirm : tu.banConfirm, { email: user.email })}
              closeLabel={t.close}
              variant="danger-quiet"
              confirm={banned ? 'primary' : 'danger'}
            />
          </div>
        )}
      </header>

      {t.notices[notice] && (
        <p className="form-message" role="status" data-kind={ERRORS.includes(notice) ? 'error' : 'notice'}>
          {t.notices[notice]}
        </p>
      )}
      {self && <p className="muted">{ta.self}</p>}

      <dl className="stat-grid">
        <div>
          <dt>{tu.products}</dt>
          <dd>{num(counts.products)}</dd>
          <small>{fill(ta.waiting, { n: num(counts.matching) })}</small>
        </div>
        {STATUSES.map((s) => (
          <div key={s} data-status={s}>
            <dt className="admin__stat-label">{dict.status[s]}</dt>
            <dd>{num(counts[s])}</dd>
          </div>
        ))}
      </dl>

      <section className="dash__panel" aria-labelledby="account-details">
        <div className="dash__panel-head">
          <h2 id="account-details">{ta.details}</h2>
        </div>
        <dl className="admin__details">
          <div><dt>{ta.email}</dt><dd>{user.email}</dd></div>
          <div><dt>{ta.confirmed}</dt><dd>{user.email_confirmed_at ? dateTime(user.email_confirmed_at) : ta.notConfirmed}</dd></div>
          <div><dt>{tu.joined}</dt><dd>{date(user.created_at)}</dd></div>
          <div><dt>{tu.lastSignIn}</dt><dd>{dateTime(user.last_sign_in_at)}</dd></div>
          {banned && <div><dt>{ta.bannedUntil}</dt><dd>{date(user.banned_until)}</dd></div>}
          <div><dt>{ta.id}</dt><dd className="admin__mono">{user.id}</dd></div>
        </dl>
      </section>

      <section className="dash__panel" aria-labelledby="account-rules">
        <div className="dash__panel-head">
          <h2 id="account-rules">{ta.rules}</h2>
          {!rules && <p className="muted">{ta.defaults}</p>}
        </div>
        <dl className="admin__details">
          <div><dt>{dict.settings.rules.fields.min_margin}</dt><dd>{pct(rules?.min_margin)}</dd></div>
          <div><dt>{dict.settings.rules.fields.undercut}</dt><dd>{Number(rules?.undercut) ? formatPrice(rules.undercut, lang) : ta.off}</dd></div>
          <div><dt>{dict.settings.rules.fields.max_change}</dt><dd>{pct(rules?.max_change)}</dd></div>
        </dl>
      </section>

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
                <tr key={p.id}>
                  <th scope="row" className="dash__product">
                    {p.name}
                    {(p.brand || p.size) && <small className="muted admin__email">{[p.brand, p.size].filter(Boolean).join(' · ')}</small>}
                  </th>
                  <td data-label={ta.sku}>{p.sku ?? '—'}</td>
                  <td className="num" data-label={ta.price}>{formatPrice(p.price, lang)}</td>
                  <td className="num" data-label={ta.cost}>{p.cost != null ? formatPrice(p.cost, lang) : '—'}</td>
                  <td data-label={ta.status}>
                    {p.match_key ? (
                      <span className="badge" data-status={p.price_status}>{dict.status[p.price_status]}</span>
                    ) : (
                      <span className="badge">{ta.matching}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="admin__clear">{ta.noProducts}</p>
        )}
        <Pager page={productPage.page} pages={productPages} href={pageHref(path, query, 'page')} t={dict.dashboard} label={tu.products} />
      </section>

      {!self && (
        <section className="dash__panel admin__danger" aria-labelledby="account-danger">
          <div className="admin__danger-text">
            <h2 id="account-danger">{ta.danger}</h2>
            <p className="muted">{ta.dangerIntro}</p>
          </div>
          <ConfirmAction
            action={deleteUser}
            id={id}
            back
            label={tu.delete}
            text={fill(tu.deleteConfirm, { email: user.email, n: num(counts.products) })}
            closeLabel={t.close}
            variant="danger"
          />
        </section>
      )}
    </>
  );
}
