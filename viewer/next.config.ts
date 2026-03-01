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
};

export default nextConfig;
