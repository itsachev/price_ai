'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid, requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

// Account actions on /dashboard/admin/users and each account's page. Each one
// checks the admin role again (actions are public endpoints), refuses to act on
// the admin's own account (no self-lockout), then sends back with ?notice=<code>:
// to the account's page when the form says back=account, else to the list.
const PAGE = '/dashboard/admin/users';
// Supabase has no "forever" ban; 100 years is the usual stand-in.
const BAN = '876000h';

async function target(formData) {
  const { admin, userId } = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (id === userId) redirect(`${PAGE}?notice=self`);
  if (!isUuid(id)) redirect(`${PAGE}?notice=missing`);
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data?.user) redirect(`${PAGE}?notice=missing`);
  const back = formData.get('back') === 'account' ? `${PAGE}/${id}` : PAGE;
  return { admin, user: data.user, back };
}

function done(notice, back) {
  // The whole console: the side rail's counts live in the admin layout.
  revalidatePath('/dashboard/admin', 'layout');
  redirect(`${back}?notice=${notice}`);
}

export async function setAdmin(formData) {
  const { admin, user, back } = await target(formData);
  const on = formData.get('on') === '1';
  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { role: on ? 'admin' : null } });
  done(error ? 'failed' : on ? 'promoted' : 'demoted', back);
}

export async function setBanned(formData) {
  const { admin, user, back } = await target(formData);
  const on = formData.get('on') === '1';
  const { error } = await admin.auth.admin.updateUserById(user.id, { ban_duration: on ? BAN : 'none' });
  done(error ? 'failed' : on ? 'banned' : 'unbanned', back);
}

// Removes the account and, through the owner_id cascades, its catalog, rules
// and notifications. Shared competitor data and match verdicts stay.
export async function deleteUser(formData) {
  const { admin, user, back } = await target(formData);
  // Type-to-confirm: the form asks for the email; a mismatch never deletes.
  if (formData.get('guard') !== user.email) done('failed', back);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  done(error ? 'failed' : 'deleted', error ? back : PAGE);
}

export async function resendConfirmation(formData) {
  const { admin, user, back } = await target(formData);
  if (user.email_confirmed_at) done('confirmed', back);
  const origin = (await headers()).get('origin');
  const { error } = await admin.auth.resend({
    type: 'signup',
    email: user.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
  });
  done(error ? (error.code === 'over_email_send_rate_limit' ? 'rateLimited' : 'failed') : 'resent', back);
}

// Signs the admin in as this user to see exactly what they see. A one-time
// magic-link token is generated server-side (no email) and verified straight
// into this browser's session cookie, which replaces the admin's session.
export async function impersonate(formData) {
  const { admin, user, back } = await target(formData);
  if (!user.email_confirmed_at) done('unconfirmed', back);
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email });
  if (error) done('failed', back);
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: data.properties.hashed_token });
  if (verifyError) done('failed', back);
  redirect('/dashboard');
}
