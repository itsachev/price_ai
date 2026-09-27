// Private app pages: keep them out of search even if a link leaks.
export const metadata = { robots: { index: false, follow: false } };

export default function DashboardLayout({ children }) {
  return children;
}
