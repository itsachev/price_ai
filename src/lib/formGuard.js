// Input checks shared by the server actions. Plain functions (no Next or
// Supabase) so scripts/check-auth.mjs can test them.

// Free text from a form or CSV: drops invisible format characters (zero-width,
// bidi overrides that can flip how a name reads) and folds control characters
// and runs of whitespace into single spaces.
export const cleanText = (value) =>
  String(value ?? '')
    .replace(/\p{Cf}/gu, '')
    .replace(/[\p{Cc}\s]+/gu, ' ')
    .trim();

// Shape only; Supabase has the final word (email_address_invalid).
export const validEmail = (email) => email.length <= 254 && /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/.test(email);

// Supabase hashes passwords with bcrypt, which ignores everything past 72 bytes.
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72;

// A new password and its confirmation → an error key from dict.auth.errors, or null.
export function newPasswordError(password, confirm) {
  if (!password) return 'password_missing';
  if (password.length < PASSWORD_MIN || new TextEncoder().encode(password).length > PASSWORD_MAX) return 'password_length';
  if (password !== confirm) return 'password_mismatch';
  return null;
}

// Bot traps for the guest forms (AuthForm's `guard`): a hidden "website" field
// people never see or fill, and the time the form was served, since a person
// takes longer than `minMs` to fill it in. The time isn't signed; a bot that
// reads the form can fake it, and the rate limits catch what gets through.
export const HONEYPOT = 'website';
export function isBot(formData, minMs = 0, now = Date.now()) {
  if (String(formData.get(HONEYPOT) ?? '') !== '') return true;
  if (!minMs) return false;
  const served = Number(formData.get('ts'));
  return !(served > 0) || now - served < minMs;
}
