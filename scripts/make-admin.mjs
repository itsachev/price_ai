// npm run make-admin -- <email> [--remove]: grant (or revoke) the admin role.
// Needed once for the first admin; after that admins manage roles on /dashboard/admin.
import { createAdminClient } from '../src/lib/supabase/admin.js';

const email = process.argv.slice(2).find((a) => !a.startsWith('--'))?.toLowerCase();
const remove = process.argv.includes('--remove');
if (!email) {
  console.error('Usage: npm run make-admin -- <email> [--remove]');
  process.exit(1);
}

const supabase = createAdminClient();
let user;
for (let page = 1; !user; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (data.users.length < 1000) break;
}
if (!user) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}

const { error } = await supabase.auth.admin.updateUserById(user.id, {
  app_metadata: { role: remove ? null : 'admin' },
});
if (error) throw error;
console.log(`${email} is ${remove ? 'no longer an admin' : 'now an admin'}.`);
