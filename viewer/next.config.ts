import type { NextConfig } from "next";

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.POLYMER_API_KEY ? "https://api.polymerbio.org" : "http://localhost:8000");

// The Claims Universe viewer is a separate Vercel deployment (Next.js multi-zone).
// Served at /claims via the rewrite below; an empty env emits NO claims rewrite,
// so a missing value can never proxy /claims to a broken destination.
const claimsZone = process.env.NEXT_PUBLIC_CLAIMS_ZONE || "";

// Genomics tooling moved from the site root to /genomics/* when the root became
// the company front door. These paths are indexed and linked externally, so each
// keeps a permanent redirect rather than being dropped.
const GENOMICS_ROUTES = [
  'atlas',
  'clocks',
  'data-sources',
  'developers',
  'dmp',
  'docs',
  'evaluate',
  'gene',
  'hla',
  'te-methylation',
  'transposome',
  'view',
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // `/biologics` was the company page before the company moved to the root.
      { source: '/biologics', destination: '/', permanent: true },
      { source: '/biologics/:path*', destination: '/', permanent: true },

      // Each moved tool keeps both its bare path and its sub-paths.
      ...GENOMICS_ROUTES.flatMap((route) => [
        { source: `/${route}`, destination: `/genomics/${route}`, permanent: true },
        { source: `/${route}/:path*`, destination: `/genomics/${route}/:path*`, permanent: true },
      ]),
    ];
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
