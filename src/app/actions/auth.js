'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SESSION_COOKIE, safeNext } from '@/lib/auth';

// Supabase error codes the auth forms have a translated message for.
const KNOWN_ERRORS = [
  'invalid_credentials',
  'email_not_confirmed',
  'user_already_exists',
  'weak_password',
  'same_password',
  'email_address_invalid',
  'over_email_send_rate_limit',
  'over_request_rate_limit',
];

const errorCode = (error) => (KNOWN_ERRORS.includes(error.code) ? error.code : 'unknown');
// Display name shown in the header; login stays by email, so it needn't be unique.
const USERNAME = /^.{2,32}$/u;
const username = (formData) => String(formData.get('username') ?? '').trim().replace(/\s+/g, ' ');
const callbackUrl = async (next) => `${(await headers()).get('origin')}/auth/callback?next=${encodeURIComponent(next)}`;

// Each action returns { error } or { notice } for useActionState (plus the
// email, so the field survives React's form reset), or redirects on success.

export async function signIn(_prev, formData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { email, error: 'missing' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { email, error: errorCode(error) };
  redirect(safeNext(formData.get('next')));
}

export async function signUp(_prev, formData) {
  const name = username(formData);
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const values = { username: name, email };
  if (!USERNAME.test(name)) return { ...values, error: 'username' };
  if (!email || !password) return { ...values, error: 'missing' };
  if (password !== formData.get('confirm')) return { ...values, error: 'password_mismatch' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username: name },
      emailRedirectTo: await callbackUrl(safeNext(formData.get('next'))),
    },
  });
  if (error) return { ...values, error: errorCode(error) };
  // With email confirmation on, there is no session until the link is clicked.
  if (!data.session) return { ...values, notice: 'checkEmail' };
  redirect(safeNext(formData.get('next')));
}

export async function requestPasswordReset(_prev, formData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { email, error: 'missing' };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: await callbackUrl('/reset-password') });
  // Same notice whether or not the account exists, so the form can't be used to probe emails.
  if (error && error.code !== 'user_not_found') return { email, error: errorCode(error) };
  return { email, notice: 'resetSent' };
}

export async function updatePassword(_prev, formData) {
  const password = String(formData.get('password') ?? '');
  if (!password) return { error: 'missing' };
  if (password !== formData.get('confirm')) return { error: 'password_mismatch' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: errorCode(error) };
  redirect('/dashboard');
}

// Settings: change the display name. The refreshed session cookie carries it,
// so the header shows it on the next render without a network call.
export async function updateProfile(_prev, formData) {
  const name = username(formData);
  if (!USERNAME.test(name)) return { username: name, error: 'username' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { username: name } });
  if (error) return { username: name, error: errorCode(error) };
  revalidatePath('/', 'layout');
  return { username: name, notice: 'profileSaved' };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // signOut keeps the cookie when the logout call fails (network error), so the
  // header would still say "Sign out"; the user asked to leave, so drop it anyway.
  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) if (SESSION_COOKIE.test(name)) cookieStore.delete(name);
  redirect('/');
}
