import 'server-only';

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((m) => m.default),
  bg: () => import('./dictionaries/bg.json').then((m) => m.default),
};

export const hasLocale = (locale) => locale in dictionaries;

export const getDictionary = (locale) => dictionaries[locale]();
