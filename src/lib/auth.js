import { combineChunks, stringFromBase64URL } from '@supabase/ssr';

// Where to send someone after auth. Only same-site paths, so `?next=` can't
// redirect to another origin ("//evil.com" or "/\evil.com" are protocol-relative).
export function safeNext(value, fallback = '/dashboard') {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : fallback;
}

// Pages for signed-out visitors; signed-in visitors skip them.
export const GUEST_PAGES = ['/login', '/signup', '/forgot-password'];

// Supabase session cookie, whole or chunked (.0, .1…); not the PKCE code-verifier.
export const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

// Header hint with no network call: a session cookie that holds a refresh token.
// The access token inside expires hourly and only gets refreshed on proxy routes,
// so checking its expiry showed signed-in visitors "Sign in" on marketing pages.
// Returns { name } (the signup username, else the email's local part) or null.
// ponytail: a revoked session or deleted user still reads as signed in here until
// the first proxy route they open, where the proxy clears the dead cookie.
export async function sessionUser(cookieStore) {
  const first = cookieStore.getAll().find((c) => SESSION_COOKIE.test(c.name) && /(token|\.0)$/.test(c.name));
  if (!first?.value) return null;
  try {
    let raw = await combineChunks(first.name.replace(/\.0$/, ''), (name) => cookieStore.get(name)?.value);
    if (raw?.startsWith('base64-')) raw = stringFromBase64URL(raw.slice('base64-'.length));
    const session = JSON.parse(raw);
    if (!session.refresh_token) return null;
    const user = session.user ?? {};
    return { name: user.user_metadata?.username || user.email?.split('@')[0] || '' };
  } catch {
    return null;
  }
}

export async function hasSession(cookieStore) {
  return Boolean(await sessionUser(cookieStore));
}
