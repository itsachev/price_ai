import 'server-only';
import { cookies, headers } from 'next/headers';
import { LOCALES, DEFAULT_LOCALE } from '@/lib/config';

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((m) => m.default),
  bg: () => import('./dictionaries/bg.json').then((m) => m.default),
};

export const getDictionary = (locale) => dictionaries[locale]();

// Locale lives in the `lang` cookie (set by the switcher), not the URL,
// so switching re-renders in place instead of navigating.
export async function getLocale() {
  const saved = (await cookies()).get('lang')?.value;
  if (LOCALES.includes(saved)) return saved;

  const header = (await headers()).get('accept-language') ?? '';
  // ponytail: first-match on primary tags, ignores q-weights; use negotiator if that matters.
  const tags = header.split(',').map((part) => part.split(';')[0].trim().slice(0, 2).toLowerCase());
  return tags.find((tag) => LOCALES.includes(tag)) ?? DEFAULT_LOCALE;
}
