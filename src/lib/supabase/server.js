import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Per-request client acting as the signed-in merchant, so RLS applies.
// Use in Server Components, Server Actions and Route Handlers.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components can't set cookies; src/proxy.js refreshes the
            // session before the page renders.
          }
        },
      },
    },
  );
}
