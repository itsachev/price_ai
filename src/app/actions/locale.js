'use server';

import { cookies } from 'next/headers';
import { LOCALES } from '@/lib/config';

// Setting a cookie in a Server Action re-renders the current page in place — no reload.
export async function setLocale(formData) {
  const lang = formData.get('lang');
  if (!LOCALES.includes(lang)) return;
  (await cookies()).set('lang', lang, { maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax' });
}
