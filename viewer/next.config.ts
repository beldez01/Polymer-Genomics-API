import type { NextConfig } from "next";

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.POLYMER_API_KEY ? "https://api.polymerbio.org" : "http://localhost:8000");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // Legacy `/claims` → canonical `/portal/latent3d` (Phase 0 portal).
        // 308 permanent redirect preserves link equity without changing the method.
        source: '/claims',
        destination: '/portal/latent3d',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        // Prevent Vercel CDN from caching API proxy responses — the upstream
        // sets immutable cache headers, but data can change after ingestion.
        // Browsers still respect upstream Cache-Control via the rewrite.
        source: '/api/:path*',
        headers: [
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
