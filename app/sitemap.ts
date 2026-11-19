import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/constants'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    '',
    '/nannies',
    '/about',
    '/contact',
    '/become-a-nanny',
    '/privacy',
    '/terms',
    '/cookies',
  ].map((path) => ({ url: siteUrl(path) }))
}
