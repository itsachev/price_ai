import { createClient } from '@supabase/supabase-js';

// Service-role client: bypasses RLS. Only for scripts/*.mjs, the daily job and
// the post-save background match. Never import it from code that reaches the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
