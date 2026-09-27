import { SITE_URL } from '@/lib/config';

// Signed-in and token pages have nothing to index.
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/auth', '/reset-password', '/forgot-password'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
