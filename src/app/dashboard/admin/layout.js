import AdminMotion from '@/components/AdminMotion';
import NavLink from '@/components/NavLink';
import { adminFormat, adminHealth } from '@/lib/admin';
import { getDictionary, getLocale } from '../../dictionaries';

// Admin console shell: the role check (404 for everyone else, before any of
// it renders), then the section rail (a sticky side column from 60rem, a
// wrapping grid on phones) with each section's live health, and the page.
// Each section is its own page and still calls requireAdmin() itself, since
// layouts don't rerun on every navigation.
const ICONS = {
  overview: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  pipeline: 'M3 12h4l3-8 4 16 3-8h4',
  matching: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
};

export default async function AdminLayout({ children }) {
  const { users, run, totals, issues, pipelineTone, issueTone } = await adminHealth();
  const lang = await getLocale();
  const t = (await getDictionary(lang)).admin;
  const { num } = adminFormat(lang);
  const sections = [
    { key: 'overview', href: '/dashboard/admin', tone: issueTone, meta: issues.length ? num(issues.length) : null, exact: true },
    { key: 'pipeline', href: '/dashboard/admin/pipeline', tone: pipelineTone, meta: run ? `${run.ok_count}/${run.total_count}` : '—' },
    { key: 'matching', href: '/dashboard/admin/matching', tone: totals.matching ? 'opportunity' : 'competitive', meta: totals.matching ? num(totals.matching) : null },
    { key: 'users', href: '/dashboard/admin/users', meta: num(users.length) },
  ];

  return (
    <section className="dash admin">
      <nav className="admin-rail" aria-label={t.nav.label}>
        <p className="admin-rail__kicker">{t.nav.console}</p>
        <ul>
          {sections.map((s) => (
            <li key={s.key}>
              <NavLink href={s.href} exact={s.exact}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[s.key]} /></svg>
                <span className="admin-rail__label">{t.nav[s.key]}</span>
                {s.meta && <span className="admin-rail__meta" data-status={s.tone}>{s.meta}</span>}
                {!s.meta && s.tone && <span className="admin-rail__dot" data-status={s.tone} />}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <AdminMotion>{children}</AdminMotion>
    </section>
  );
}
