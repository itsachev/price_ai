'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid, requireAdmin } from '@/lib/admin';
import { toProduct } from '@/lib/catalog';
import { cleanText, newPasswordError, validEmail } from '@/lib/formGuard';
import { createClient } from '@/lib/supabase/server';
import { matchInBackground, parseRules, refreshStatuses } from '@/lib/suggestions';

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

// Same limit as signup and settings (auth.js): a display name, not unique.
const USERNAME = /^.{2,32}$/u;
// Supabase codes that dict.auth.errors has a message for; email_exists reads as user_already_exists.
const AUTH_ERRORS = { email_exists: 'user_already_exists', weak_password: 'weak_password', email_address_invalid: 'email_address_invalid' };

// The account's details from its page (AuthForm): username, email and, when
// typed, a new password. An email the admin sets counts as confirmed, since no
// confirmation mail goes out for it. Returns { error } with the typed values.
export async function updateAccount(_prev, formData) {
  const { admin, user, back } = await target(formData);
  const username = cleanText(formData.get('username'));
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const values = { username, email };
  if (!USERNAME.test(username)) return { ...values, error: 'username' };
  if (!validEmail(email)) return { ...values, error: 'email_address_invalid' };
  const passwordError = password ? newPasswordError(password, String(formData.get('confirm') ?? '')) : null;
  if (passwordError) return { ...values, error: passwordError };

  const changes = { user_metadata: { ...user.user_metadata, username } };
  if (email !== user.email) Object.assign(changes, { email, email_confirm: true });
  if (password) changes.password = password;
  const { error } = await admin.auth.admin.updateUserById(user.id, changes);
  if (error) return { ...values, error: AUTH_ERRORS[error.code] ?? 'unknown' };
  done('accountSaved', back);
}

// Marks the email confirmed without the link, e.g. when the mail never arrived.
export async function confirmEmail(formData) {
  const { admin, user, back } = await target(formData);
  if (user.email_confirmed_at) done('confirmed', back);
  const { error } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
  done(error ? 'failed' : 'emailConfirmed', back);
}

// The account's pricing rules, parsed exactly like the merchant's own settings form.
export async function saveAccountRules(_prev, formData) {
  const { admin, user, back } = await target(formData);
  const { values, error: invalid, row } = parseRules(formData);
  if (invalid) return { ...values, error: invalid };
  const { error } = await admin.from('pricing_rules').upsert({ owner_id: user.id, ...row });
  if (error) return { ...values, error: 'unknown' };
  await refreshStatuses(admin, null, user.id);
  revalidatePath('/dashboard', 'layout');
  done('rulesSaved', back);
}

// A product id from the form, or back to the list. Unlike the account actions
// these work on the admin's own products too: nothing here can lock them out.
async function productTarget(formData) {
  const { admin } = await requireAdmin();
  const id = Number(formData.get('id'));
  if (!Number.isSafeInteger(id)) redirect(`${PAGE}?notice=missing`);
  return { admin, id };
}

// Edit one of an account's products (ProductForm), as the merchant would: the
// status is refreshed and a renamed product is matched again in the background.
export async function saveAccountProduct(_prev, formData) {
  const values = Object.fromEntries(['name', 'brand', 'size', 'sku', 'price', 'cost'].map((f) => [f, formData.get(f)]));
  const { product, error: invalid } = toProduct(values);
  if (invalid) return { error: invalid, values };
  const { admin, id } = await productTarget(formData);
  const { data, error } = await admin.from('products').update(product).eq('id', id).select('owner_id').maybeSingle();
  if (error) return { error: error.code === '23505' ? 'sku_taken' : 'unknown', values };
  if (!data) redirect(`${PAGE}?notice=missing`);
  await refreshStatuses(admin, id, data.owner_id);
  matchInBackground(id);
  revalidatePath('/dashboard', 'layout');
  redirect(`${PAGE}/${data.owner_id}?notice=productSaved`);
}

export async function deleteAccountProduct(formData) {
  const { admin, id } = await productTarget(formData);
  const { data, error } = await admin.from('products').delete().eq('id', id).select('owner_id').maybeSingle();
  if (error || !data) redirect(`${PAGE}?notice=${error ? 'failed' : 'missing'}`);
  revalidatePath('/dashboard', 'layout');
  redirect(`${PAGE}/${data.owner_id}?notice=productDeleted`);
}
