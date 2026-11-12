import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    return [{ source: '/api/backend/:path*', destination: `${apiUrl.replace(/\/$/, '')}/:path*` }];
  },
};

export default nextConfig;
