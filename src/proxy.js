import { NextResponse } from 'next/server';
import { LOCALES, DEFAULT_LOCALE } from '@/lib/config';

function getLocale(request) {
  const header = request.headers.get('accept-language') ?? '';
  // ponytail: first-match on primary tags, ignores q-weights; use negotiator if that matters.
  const tags = header.split(',').map((part) => part.split(';')[0].trim().slice(0, 2).toLowerCase());
  return tags.find((tag) => LOCALES.includes(tag)) ?? DEFAULT_LOCALE;
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) return;

  request.nextUrl.pathname = `/${getLocale(request)}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Skip Next internals and files with an extension (favicon, images, …).
  matcher: ['/((?!_next|.*\\..*).*)'],
};
