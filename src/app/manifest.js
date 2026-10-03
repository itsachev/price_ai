import { getDictionary, getLocale } from './dictionaries';

// Makes PriceAI installable. start_url is the home page: the proxy sends
// signed-in visitors on to their dashboard.
export default async function manifest() {
  const dict = await getDictionary(await getLocale());
  const icons = [192, 512].flatMap((size) =>
    ['any', 'maskable'].map((purpose) => ({ src: `/app-icon/${size}`, sizes: `${size}x${size}`, type: 'image/png', purpose })),
  );
  return {
    id: '/',
    name: 'PriceAI',
    short_name: 'PriceAI',
    description: dict.meta.description,
    lang: await getLocale(),
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0f1a',
    theme_color: '#0a0f1a',
    icons,
  };
}
