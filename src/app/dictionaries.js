import 'server-only';
import { cookies } from 'next/headers';
import { LOCALES, DEFAULT_LOCALE } from '@/lib/config';

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((m) => m.default),
  bg: () => import('./dictionaries/bg.json').then((m) => m.default),
};

export const getDictionary = (locale) => dictionaries[locale]();

// Locale lives in the `lang` cookie (set by the switcher), not the URL,
// so switching re-renders in place instead of navigating. Everyone starts in
// Bulgarian; the browser's language is ignored.
export async function getLocale() {
  const saved = (await cookies()).get('lang')?.value;
  return LOCALES.includes(saved) ? saved : DEFAULT_LOCALE;
}
