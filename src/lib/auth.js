import { combineChunks, stringFromBase64URL } from '@supabase/ssr';

// Where to send someone after auth. Only same-site paths, so `?next=` can't
// redirect to another origin ("//evil.com" or "/\evil.com" are protocol-relative).
export function safeNext(value, fallback = '/dashboard') {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : fallback;
}

// Pages for signed-out visitors; signed-in visitors skip them.
export const GUEST_PAGES = ['/login', '/signup', '/forgot-password'];

// Header hint with no network call: a session cookie whose access token hasn't
// expired. A stale cookie (expired, or left over from a deleted user) reads as
// signed out; visiting /login lets the proxy clear it.
// ponytail: a user deleted in Supabase still reads as signed in until the token
// expires (JWT expiry, 1h by default); the proxy and pages do the real check.
export async function hasSession(cookieStore) {
  const first = cookieStore.getAll().find((c) => /^sb-.+-auth-token(\.0)?$/.test(c.name));
  if (!first) return false;
  try {
    let raw = await combineChunks(first.name.replace(/\.0$/, ''), (name) => cookieStore.get(name)?.value);
    if (raw?.startsWith('base64-')) raw = stringFromBase64URL(raw.slice('base64-'.length));
    return JSON.parse(raw).expires_at * 1000 > Date.now();
  } catch {
    return false;
  }
}
