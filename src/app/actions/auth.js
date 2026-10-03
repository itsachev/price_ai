'use server';

import { createHash } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient as createSupabase } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ACCOUNT_TYPES, SESSION_COOKIE, safeNext } from '@/lib/auth';
import { cleanText, isBot, newPasswordError, validEmail } from '@/lib/formGuard';

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
  'reauthentication_needed',
];

// Codes without a message fall back to `fallback`; they're logged so the next
// one that shows up can get its own message.
function errorCode(error, fallback = 'unknown') {
  if (KNOWN_ERRORS.includes(error.code)) return error.code;
  console.error('auth error without a message', error.code, error.message);
  return fallback;
}
// Display name shown in the header; login stays by email, so it needn't be unique.
const USERNAME = /^.{2,32}$/u;
const username = (formData) => cleanText(formData.get('username'));
const emailOf = (formData) => String(formData.get('email') ?? '').trim();
const callbackUrl = async (next) => `${(await headers()).get('origin')}/auth/callback?next=${encodeURIComponent(next)}`;

// Attempts allowed per visitor IP and per account in each window, by form.
// Supabase limits too, but it sees every request coming from this server's IP.
const LIMITS = {
  signIn: { seconds: 15 * 60, ip: 20, account: 10 },
  signUp: { seconds: 60 * 60, ip: 5 },
  reset: { seconds: 60 * 60, ip: 5, account: 3 },
  password: { seconds: 15 * 60, account: 5 },
};
// Minimum time from serving a guest form to submitting it (see isBot).
const MIN_FILL_MS = 1500;

// The visitor's IP as the host's proxy reports it (Vercel sets x-forwarded-for).
// ponytail: trusts the header; behind no proxy a client can rotate it, and the per-account limit still holds.
async function clientIp() {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}

// True when this attempt goes over a limit. Counted in Postgres (rate_limit, 0018)
// so every server instance shares the count; accounts are hashed, never stored.
// Service role: only it may call rate_limit. Fails open, so a database hiccup
// never locks everyone out.
async function limited(form, account) {
  const { seconds, ip, account: perAccount } = LIMITS[form];
  const keys = [];
  if (ip) keys.push([`${form}:ip:${await clientIp()}`, ip]);
  if (perAccount && account) {
    keys.push([`${form}:acct:${createHash('sha256').update(account.toLowerCase()).digest('base64url')}`, perAccount]);
  }
  try {
    const admin = createAdminClient();
    const results = await Promise.all(
      keys.map(([key, max]) => admin.rpc('rate_limit', { key, max_hits: max, window_seconds: seconds })),
    );
    for (const { error } of results) if (error) console.error('rate limit check failed', error);
    return results.some(({ data, error }) => !error && data === false);
  } catch (error) {
    console.error('rate limit check failed', error);
    return false;
  }
}

// Each action returns { error } or { notice } for useActionState (plus the
// email, so the field survives React's form reset), or redirects on success.

export async function signIn(_prev, formData) {
  const email = emailOf(formData);
  const password = String(formData.get('password') ?? '');
  if (isBot(formData)) return { email, error: 'unknown' };
  if (!email || !password) return { email, error: 'missing' };
  if (!validEmail(email)) return { email, error: 'email_address_invalid' };
  if (await limited('signIn', email)) return { email, error: 'over_request_rate_limit' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { email, error: errorCode(error) };
  redirect(safeNext(formData.get('next')));
}

export async function signUp(_prev, formData) {
  const name = username(formData);
  const email = emailOf(formData);
  const password = String(formData.get('password') ?? '');
  const accountType = String(formData.get('accountType') ?? '');
  const values = { username: name, email, accountType };
  if (isBot(formData, MIN_FILL_MS)) return { ...values, error: 'unknown' };
  if (!ACCOUNT_TYPES.includes(accountType)) return { ...values, error: 'account_type' };
  if (!USERNAME.test(name)) return { ...values, error: 'username' };
  if (!email) return { ...values, error: 'missing' };
  if (!validEmail(email)) return { ...values, error: 'email_address_invalid' };
  const invalid = newPasswordError(password, formData.get('confirm'));
  if (invalid) return { ...values, error: invalid };
  if (await limited('signUp')) return { ...values, error: 'over_request_rate_limit' };

  const next = accountType === 'consumer' ? '/info' : safeNext(formData.get('next'));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username: name, account_type: accountType },
      emailRedirectTo: await callbackUrl(next),
    },
  });
  if (error) return { ...values, error: errorCode(error) };
  // With email confirmation on, there is no session until the link is clicked.
  if (!data.session) return { ...values, notice: 'checkEmail' };
  redirect(next);
}

export async function requestPasswordReset(_prev, formData) {
  const email = emailOf(formData);
  if (isBot(formData, MIN_FILL_MS)) return { email, error: 'unknown' };
  if (!email) return { email, error: 'missing' };
  if (!validEmail(email)) return { email, error: 'email_address_invalid' };
  if (await limited('reset', email)) return { email, error: 'over_request_rate_limit' };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: await callbackUrl('/reset-password') });
  // Same notice whether or not the account exists, so the form can't be used to probe emails.
  if (error && error.code !== 'user_not_found') return { email, error: errorCode(error) };
  return { email, notice: 'resetSent' };
}

// /reset-password, reached signed in from the reset email.
export async function updatePassword(_prev, formData) {
  const password = String(formData.get('password') ?? '');
  const invalid = newPasswordError(password, formData.get('confirm'));
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: errorCode(error) };
  // Supabase signs every other session out here, so a device that had the old password is out.
  redirect('/dashboard?notice=passwordChanged');
}

// Settings: change the password. Asks for the current one first, so a session
// left open on a shared computer can't take over the account; every other
// device is signed out. Back to settings with a toast (?at= makes each one new).
export async function changePassword(_prev, formData) {
  const current = String(formData.get('current') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!current) return { error: 'current_missing' };
  const invalid = newPasswordError(password, formData.get('confirm'));
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login?next=/dashboard/settings');
  if (await limited('password', data.claims.sub)) return { error: 'over_request_rate_limit' };

  // Checked and changed through a cookie-less client: signing in again on this
  // request's client would swap the session cookie mid-action. Supabase ends
  // every other session when the password changes, this browser's too, so the
  // verifying session is the one that survives; it becomes this browser's.
  const verifier = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const check = await verifier.auth.signInWithPassword({ email: data.claims.email, password: current });
  if (check.error) {
    if (check.error.code === 'invalid_credentials') return { error: 'current_password' };
    return { error: errorCode(check.error, 'password_not_changed') };
  }
  const { error } = await verifier.auth.updateUser({ password });
  if (error) return { error: errorCode(error, 'password_not_changed') };

  const { error: sessionError } = await supabase.auth.setSession(check.data.session);
  if (sessionError) {
    console.error('password changed, but the new session was not saved', sessionError);
    redirect('/login?next=/dashboard/settings');
  }
  redirect(`/dashboard/settings?notice=passwordChanged&at=${Date.now()}`);
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
