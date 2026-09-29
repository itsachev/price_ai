'use server';

import { cookies } from 'next/headers';

// Same pattern as setLocale/setTheme: the cookie re-renders the page in place.
export async function dismissCookieNotice() {
  (await cookies()).set('cookie_notice', '1', { maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax' });
}
