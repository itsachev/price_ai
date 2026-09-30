import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Admins carry app_metadata.role = 'admin'. Users can't edit app_metadata, and
// only an admin (or `npm run make-admin`) sets it.
export const isAdmin = (user) => user?.app_metadata?.role === 'admin';

// Guard for the admin page and its actions. The role is read fresh from the
// auth server, not from the JWT, so granting or revoking it applies at once
// instead of after the next token refresh. Non-admins get a 404, so the page
// doesn't advertise itself. Returns the service-role client and the admin's id.
export async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login?next=/dashboard/admin');
  const admin = createAdminClient();
  const { data: found } = await admin.auth.admin.getUserById(data.claims.sub);
  if (!isAdmin(found?.user)) notFound();
  return { admin, userId: data.claims.sub };
}
