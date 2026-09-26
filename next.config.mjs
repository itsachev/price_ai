/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Catalog CSV imports go through a server action; the 1MB default is ~15k rows.
    // Keep in step with MAX_CSV_BYTES in src/app/actions/products.js.
    serverActions: { bodySizeLimit: '5mb' },
  },
  // The product list merged into the dashboard; keep old links working (query string carries over).
  redirects: async () => [{ source: '/dashboard/products', destination: '/dashboard', permanent: true }],
};

export default nextConfig;
