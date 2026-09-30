import Link from 'next/link';

// Previous / "Page 2 of 5" / Next under a paginated list. `href(page)` builds
// each link; `t` is dict.dashboard (pagination, prev, next, page). Hidden when
// everything fits on one page.
export default function Pager({ page, pages, href, t, label = t.pagination }) {
  if (pages <= 1) return null;
  return (
    <nav className="dash__pager" aria-label={label}>
      {page > 1 ? <Link href={href(page - 1)} className="dash__chip">{t.prev}</Link> : <span />}
      <span className="muted">{t.page.replace('{page}', page).replace('{pages}', pages)}</span>
      {page < pages ? <Link href={href(page + 1)} className="dash__chip">{t.next}</Link> : <span />}
    </nav>
  );
}
