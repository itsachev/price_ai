import { combineChunks, stringFromBase64URL } from '@supabase/ssr';

// Where to send someone after auth. Only same-site paths, so `?next=` can't
// redirect to another origin ("//evil.com" or "/\evil.com" are protocol-relative).
export function safeNext(value, fallback = '/dashboard') {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : fallback;
}

// Pages for signed-out visitors; signed-in visitors skip them.
export const GUEST_PAGES = ['/login', '/signup', '/forgot-password'];

// Header hint with no network call: a session cookie that holds a refresh token.
// The access token inside expires hourly and only gets refreshed on proxy routes,
// so checking its expiry showed signed-in visitors "Sign in" on marketing pages.
// ponytail: a revoked session or deleted user still reads as signed in here; the
// first app route they open runs the proxy, which sends them to /login and clears it.
export async function hasSession(cookieStore) {
  const first = cookieStore.getAll().find((c) => /^sb-.+-auth-token(\.0)?$/.test(c.name));
  if (!first) return false;
  try {
    let raw = await combineChunks(first.name.replace(/\.0$/, ''), (name) => cookieStore.get(name)?.value);
    if (raw?.startsWith('base64-')) raw = stringFromBase64URL(raw.slice('base64-'.length));
    return Boolean(JSON.parse(raw).refresh_token);
  } catch {
    return false;
  }
}
