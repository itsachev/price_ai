// node scripts/check-auth.mjs: self-check for the post-auth redirect guard.
import assert from 'node:assert/strict';
import { createChunks, stringToBase64URL } from '@supabase/ssr';
import { hasSession, safeNext, sessionUser } from '../src/lib/auth.js';

assert.equal(safeNext('/dashboard/products?x=1'), '/dashboard/products?x=1');
assert.equal(safeNext('/reset-password'), '/reset-password');
for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'dashboard', '', null, undefined]) {
  assert.equal(safeNext(bad), '/dashboard', String(bad));
}

// hasSession: a session cookie with a refresh token counts (even once the hourly
// access token has expired); missing, emptied or garbage doesn't.
const store = (cookies) => ({ getAll: () => cookies, get: (n) => cookies.find((c) => c.name === n) });
const sessionCookies = (session) =>
  createChunks('sb-ref-auth-token', 'base64-' + stringToBase64URL(JSON.stringify(session)));
const now = Math.floor(Date.now() / 1000);
assert.equal(await hasSession(store(sessionCookies({ refresh_token: 'r', expires_at: now + 3600 }))), true);
assert.equal(await hasSession(store(sessionCookies({ refresh_token: 'r', pad: 'x'.repeat(8000) }))), true, 'chunked');
assert.equal(await hasSession(store(sessionCookies({ refresh_token: 'r', expires_at: now - 60 }))), true, 'expired access token');
assert.equal(await hasSession(store(sessionCookies({ expires_at: now + 3600 }))), false, 'no refresh token');
assert.equal(await hasSession(store([{ name: 'sb-ref-auth-token', value: '' }])), false, 'deleted cookie');
assert.equal(await hasSession(store([])), false, 'no cookie');
assert.equal(await hasSession(store([{ name: 'sb-ref-auth-token', value: 'junk' }])), false, 'garbage');
assert.equal(await hasSession(store([{ name: 'sb-ref-auth-token-code-verifier', value: 'x' }])), false, 'verifier only');
const user = (u) => sessionUser(store(sessionCookies({ refresh_token: 'r', user: u })));
assert.deepEqual(await user({ email: 'ana@shop.bg', user_metadata: { username: 'Ana' } }), { name: 'Ana' });
assert.deepEqual(await user({ email: 'ana@shop.bg' }), { name: 'ana' }, 'no username: email local part');
console.log('check-auth: ok');
