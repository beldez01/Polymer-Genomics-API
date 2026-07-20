import type { NextConfig } from "next";

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.POLYMER_API_KEY ? "https://api.polymerbio.org" : "http://localhost:8000");

// The Claims Universe viewer is a separate Vercel deployment (Next.js multi-zone).
// Served at /claims via the rewrite below; an empty env emits NO claims rewrite,
// so a missing value can never proxy /claims to a broken destination.
const claimsZone = process.env.NEXT_PUBLIC_CLAIMS_ZONE || "";

const nextConfig: NextConfig = {
  async redirects() {
    // Legacy `/claims` → `/portal/latent3d` redirect removed: `/claims` is now the
    // live Claims Universe, served via the multi-zone rewrite below.
    return [];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/:path*`,
      },
      // Multi-zone: proxy /claims to the standalone Claims Universe deployment.
      // Guarded — a missing NEXT_PUBLIC_CLAIMS_ZONE emits no rewrite (no broken proxy).
      ...(claimsZone
        ? [
            { source: '/claims', destination: `${claimsZone}/claims` },
            { source: '/claims/:path*', destination: `${claimsZone}/claims/:path*` },
          ]
        : []),
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
