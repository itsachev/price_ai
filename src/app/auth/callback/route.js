import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';

// Confirmation and password-reset emails land here with a PKCE code;
// `next` says where to go once the session exists.
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')), url));
  }
  return NextResponse.redirect(new URL('/login?error=link', url));
}
