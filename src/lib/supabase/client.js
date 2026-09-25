import { createBrowserClient } from '@supabase/ssr';

// Browser client for Client Components (auth flows). Never use it for AI work.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
