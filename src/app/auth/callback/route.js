import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// The sign-up confirmation email lands here with a PKCE code.
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/dashboard', url));
  }
  return NextResponse.redirect(new URL('/login?error=link', url));
}
