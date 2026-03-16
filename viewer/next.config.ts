import type { NextConfig } from "next";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const apiKey = process.env.POLYMER_API_KEY || "";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: apiKey
          ? `${apiBase}/:path*?api_key=${apiKey}`
          : `${apiBase}/:path*`,
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
