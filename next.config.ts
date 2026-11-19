import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  distDir: process.env.VACAYNANNY_TEST_DIST || '.next',
  devIndicators: process.env.VACAYNANNY_TEST_DIST ? false : undefined,
  typescript: {
    tsconfigPath: process.env.VACAYNANNY_TEST_DIST
      ? 'tsconfig.e2e.json'
      : 'tsconfig.json',
  },
  async headers() {
    return [
      {
        source: '/:section(booking|care-enquiries)/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default nextConfig
