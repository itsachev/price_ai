import NavLink from '@/components/NavLink';
import { requireAdmin } from '@/lib/admin';
import { getDictionary, getLocale } from '../../dictionaries';

// Admin console shell: the role check (404 for everyone else, before any of
// it renders) and the section tabs. Each section is its own page and still
// calls requireAdmin() itself, since layouts don't rerun on every navigation.
export default async function AdminLayout({ children }) {
  await requireAdmin();
  const t = (await getDictionary(await getLocale())).admin;
  const tabs = [
    ['/dashboard/admin', t.nav.overview],
    ['/dashboard/admin/pipeline', t.nav.pipeline],
    ['/dashboard/admin/matching', t.nav.matching],
    ['/dashboard/admin/users', t.nav.users],
  ];

  return (
    <section className="dash admin">
      <nav className="admin__tabs" aria-label={t.nav.label}>
        {tabs.map(([href, label], i) => (
          <NavLink key={href} href={href} exact={i === 0}>
            {label}
          </NavLink>
        ))}
      </nav>
      {children}
    </section>
  );
}
