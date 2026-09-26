import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { GUEST_PAGES, safeNext } from '@/lib/auth';

// Refreshes the Supabase session cookie and does the optimistic auth redirects.
// Pages still check the user themselves; RLS is the real guard.
export async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname, search, searchParams } = request.nextUrl;
  const guestPage = GUEST_PAGES.includes(pathname);

  // Signed out on an app page: sign in, then come back. Signed in on a guest page: go on.
  const target = !signedIn && !guestPage
    ? `/login?next=${encodeURIComponent(pathname + search)}`
    : signedIn && guestPage ? safeNext(searchParams.get('next')) : null;
  if (!target) return response;

  // Keep any refreshed session cookies on the redirect.
  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

// Only app routes pay for the session check; marketing pages stay untouched.
// Add every new signed-in route here.
export const config = {
  matcher: ['/dashboard/:path*', '/reset-password', '/login', '/signup', '/forgot-password'],
};
