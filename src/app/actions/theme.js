'use server';

import { cookies } from 'next/headers';

// Same pattern as setLocale: the cookie re-renders <html data-theme> in place.
export async function setTheme(formData) {
  const theme = formData.get('theme');
  if (theme !== 'light' && theme !== 'dark') return;
  (await cookies()).set('theme', theme, { maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax' });
}
