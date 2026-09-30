const dev = process.env.NODE_ENV === 'development';

// Everything is same-origin: next/font self-hosts the fonts, and Supabase and
// Gemini are only called from the server. Scripts still need 'unsafe-inline'
// for Next's inline bootstrap; the rest (no outside scripts or connections,
// no framing, no <base> or form hijack, no plugins) holds.
// ponytail: a per-request nonce would drop 'unsafe-inline', but it needs the proxy on every route.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  headers: async () => [{ source: '/:path*', headers: securityHeaders }],
  experimental: {
    // Catalog CSV imports go through a server action; the 1MB default is ~15k rows.
    // Keep in step with MAX_CSV_BYTES in src/app/actions/products.js.
    serverActions: { bodySizeLimit: '5mb' },
  },
  // The product list merged into the dashboard; keep old links working (query string carries over).
  redirects: async () => [{ source: '/dashboard/products', destination: '/dashboard', permanent: true }],
};

export default nextConfig;
