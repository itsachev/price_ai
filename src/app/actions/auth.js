'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Supabase error codes the login form has a translated message for.
const KNOWN_ERRORS = [
  'invalid_credentials',
  'email_not_confirmed',
  'user_already_exists',
  'weak_password',
  'email_address_invalid',
  'over_email_send_rate_limit',
  'over_request_rate_limit',
];

// One form, two submit buttons: intent is "signin" or "signup".
// Returns { error } or { notice } for useActionState, or redirects on success.
export async function authenticate(_prev, formData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { email, error: 'missing' };

  const supabase = await createClient();

  if (formData.get('intent') === 'signup') {
    const origin = (await headers()).get('origin');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) return { email, error: KNOWN_ERRORS.includes(error.code) ? error.code : 'unknown' };
    // With email confirmation on, there is no session until the link is clicked.
    if (!data.session) return { email, notice: 'checkEmail' };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { email, error: KNOWN_ERRORS.includes(error.code) ? error.code : 'unknown' };
  }

  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
