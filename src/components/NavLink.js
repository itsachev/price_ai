'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Header link that marks the current section. `exact` for a parent path
// (/dashboard) so it isn't current on its children (/dashboard/products).
export default function NavLink({ href, exact = false, children }) {
  const pathname = usePathname();
  const current = pathname === href || (!exact && pathname.startsWith(`${href}/`));
  return (
    <Link href={href} aria-current={current ? 'page' : undefined}>
      {children}
    </Link>
  );
}
