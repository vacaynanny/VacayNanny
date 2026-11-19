import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/constants'

export default function robots(): MetadataRoute.Robots {
  const production =
    new URL(SITE_URL).hostname === 'www.vacaynanny.net' &&
    process.env.VERCEL_ENV !== 'preview'
  if (!production) return { rules: { userAgent: '*', disallow: '/' } }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/account',
        '/nanny$',
        '/nanny/',
        '/auth/',
        '/api/',
        '/booking/',
        '/payments/',
        '/login',
        '/signup',
        '/reset-password',
        '/forgot-password',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
