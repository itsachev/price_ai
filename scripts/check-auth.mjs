// node scripts/check-auth.mjs: self-check for the post-auth redirect guard.
import assert from 'node:assert/strict';
import { createChunks, stringToBase64URL } from '@supabase/ssr';
import { hasSession, safeNext, sessionUser } from '../src/lib/auth.js';
import { cleanText, isBot, newPasswordError, validEmail } from '../src/lib/formGuard.js';

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
assert.deepEqual(await user({ email: 'ana@shop.bg', user_metadata: { username: 'Ana' } }), { name: 'Ana', admin: false });
assert.deepEqual(await user({ email: 'ana@shop.bg' }), { name: 'ana', admin: false }, 'no username: email local part');
assert.deepEqual(await user({ email: 'a@b.bg', app_metadata: { role: 'admin' } }), { name: 'a', admin: true }, 'admin hint');

// Form input guards.
assert.equal(cleanText('  Ana\u202E\u200B  Petrova\n\t'), 'Ana Petrova', 'bidi, zero-width, control chars');
assert.equal(cleanText(null), '');
for (const ok of ['ana@shop.bg', 'a.b+c@mail.co.uk']) assert.ok(validEmail(ok), ok);
for (const bad of ['ana', 'ana@shop', '@shop.bg', 'a b@shop.bg', `${'a'.repeat(250)}@x.bg`]) assert.ok(!validEmail(bad), bad);
assert.equal(newPasswordError('', ''), 'password_missing');
assert.equal(newPasswordError('short', 'short'), 'password_length');
assert.equal(newPasswordError('я'.repeat(40), 'я'.repeat(40)), 'password_length', '72 bytes, not chars');
assert.equal(newPasswordError('longenough', 'different1'), 'password_mismatch');
assert.equal(newPasswordError('longenough', 'longenough'), null);
const form = (entries) => new Map(Object.entries(entries));
assert.equal(isBot(form({ website: 'spam' })), true, 'honeypot filled');
assert.equal(isBot(form({})), false, 'login: honeypot only');
assert.equal(isBot(form({ ts: '1000' }), 1500, 2000), true, 'too fast');
assert.equal(isBot(form({ ts: '1000' }), 1500, 5000), false, 'human pace');
assert.equal(isBot(form({}), 1500), true, 'time missing');
assert.equal(isBot(form({ ts: '9999999999999' }), 1500), true, 'time in the future');
console.log('check-auth: ok');
