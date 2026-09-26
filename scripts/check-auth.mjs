// node scripts/check-auth.mjs: self-check for the post-auth redirect guard.
import assert from 'node:assert/strict';
import { createChunks, stringToBase64URL } from '@supabase/ssr';
import { hasSession, safeNext } from '../src/lib/auth.js';

assert.equal(safeNext('/dashboard/products?x=1'), '/dashboard/products?x=1');
assert.equal(safeNext('/reset-password'), '/reset-password');
for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'dashboard', '', null, undefined]) {
  assert.equal(safeNext(bad), '/dashboard', String(bad));
}

// hasSession: a live session cookie counts; expired, missing or garbage doesn't.
const store = (cookies) => ({ getAll: () => cookies, get: (n) => cookies.find((c) => c.name === n) });
const sessionCookies = (expiresAt, pad = '') => {
  const value = 'base64-' + stringToBase64URL(JSON.stringify({ expires_at: expiresAt, pad }));
  return createChunks('sb-ref-auth-token', value);
};
const now = Math.floor(Date.now() / 1000);
assert.equal(await hasSession(store(sessionCookies(now + 3600))), true);
assert.equal(await hasSession(store(sessionCookies(now + 3600, 'x'.repeat(8000)))), true, 'chunked');
assert.equal(await hasSession(store(sessionCookies(now - 60))), false, 'expired');
assert.equal(await hasSession(store([])), false, 'no cookie');
assert.equal(await hasSession(store([{ name: 'sb-ref-auth-token', value: 'junk' }])), false, 'garbage');
assert.equal(await hasSession(store([{ name: 'sb-ref-auth-token-code-verifier', value: 'x' }])), false, 'verifier only');
console.log('check-auth: ok');
