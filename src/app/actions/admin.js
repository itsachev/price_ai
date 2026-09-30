'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

// Account actions on /dashboard/admin. Each one checks the admin role again
// (actions are public endpoints), refuses to act on the admin's own account
// (no self-lockout), then sends back to the page with ?notice=<code>.
const PAGE = '/dashboard/admin';
// Supabase has no "forever" ban; 100 years is the usual stand-in.
const BAN = '876000h';

async function target(formData) {
  const { admin, userId } = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id || id === userId) redirect(`${PAGE}?notice=self`);
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data?.user) redirect(`${PAGE}?notice=missing`);
  return { admin, user: data.user };
}

function done(notice) {
  revalidatePath(PAGE);
  redirect(`${PAGE}?notice=${notice}#users`);
}

export async function setAdmin(formData) {
  const { admin, user } = await target(formData);
  const on = formData.get('on') === '1';
  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { role: on ? 'admin' : null } });
  done(error ? 'failed' : on ? 'promoted' : 'demoted');
}

export async function setBanned(formData) {
  const { admin, user } = await target(formData);
  const on = formData.get('on') === '1';
  const { error } = await admin.auth.admin.updateUserById(user.id, { ban_duration: on ? BAN : 'none' });
  done(error ? 'failed' : on ? 'banned' : 'unbanned');
}

// Removes the account and, through the owner_id cascades, its catalog, rules
// and notifications. Shared competitor data and match verdicts stay.
export async function deleteUser(formData) {
  const { admin, user } = await target(formData);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  done(error ? 'failed' : 'deleted');
}

export async function resendConfirmation(formData) {
  const { admin, user } = await target(formData);
  if (user.email_confirmed_at) done('confirmed');
  const origin = (await headers()).get('origin');
  const { error } = await admin.auth.resend({
    type: 'signup',
    email: user.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
  });
  done(error ? (error.code === 'over_email_send_rate_limit' ? 'rateLimited' : 'failed') : 'resent');
}

// Signs the admin in as this user to see exactly what they see. A one-time
// magic-link token is generated server-side (no email) and verified straight
// into this browser's session cookie, which replaces the admin's session.
export async function impersonate(formData) {
  const { admin, user } = await target(formData);
  if (!user.email_confirmed_at) done('unconfirmed');
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email });
  if (error) done('failed');
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: data.properties.hashed_token });
  if (verifyError) done('failed');
  redirect('/dashboard');
}
