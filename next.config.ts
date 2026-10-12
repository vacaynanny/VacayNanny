import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack for production builds (Google Fonts bug in Next.js 16 canary)
  // This forces webpack which is stable
  experimental: {
    turbo: false,
  },
};

export default nextConfig;
