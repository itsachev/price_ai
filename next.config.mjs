/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Catalog CSV imports go through a server action; the 1MB default is ~15k rows.
    // Keep in step with MAX_CSV_BYTES in src/app/actions/products.js.
    serverActions: { bodySizeLimit: '5mb' },
  },
};

export default nextConfig;
