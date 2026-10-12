import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      '@vercel/turbopack-next/internal/font/google/font': '@vercel/turbopack-next/internal/font/google/font.ts',
    },
  },
};

export default nextConfig;
