import { DESTINATIONS } from '@/lib/constants'
import type { Destination } from '@/lib/types'

export const APPLY_EXTRA_DESTINATIONS = ['Anywhere in Kenya'] as const

/** Photos from the original marketing site, plus real Kenya shots where that site had the wrong place. */
function unsplash(id: string) {
  return `https://images.unsplash.com/${id}?w=1600&auto=format&fit=crop&q=80`
}

export const DESTINATION_IMAGES: Record<string, string> = {
  'diani-beach': unsplash('photo-1651860282131-e3257674ccd1'),
  malindi: unsplash('photo-1645689600188-1945e19b8228'),
  watamu: unsplash('photo-1507525428034-b723cf961d3e'),
  nairobi: unsplash('photo-1669127300649-940337f1487e'),
  mombasa: unsplash('photo-1579005318686-5a86bbb3bf03'),
  lamu: unsplash('photo-1711802536772-0ef59886bc1b'),
  'masai-mara': unsplash('photo-1518459384564-ecfd8e80721f'),
  amboseli: unsplash('photo-1510837267498-0148e51cdfc0'),
  zanzibar: unsplash('photo-1504214208698-ea1916a2195a'),
}

/** Stock IDs previously saved on destination rows that show the wrong place. */
const LEGACY_DESTINATION_PHOTOS = [
  'photo-1559827260-dc66d52bef19',
  'photo-1548013146-72479768bada',
  'photo-1605640840605-14ac1855827b',
  'photo-1611348524140-53c9a25263d6',
  'photo-1506905925346-21bda4d32df4',
  'photo-1590523741831-ab7e8b8f9c7f',
  'photo-1516426122078-c23e76319801',
  'photo-1489749798305-4fea3ae63d43',
  'photo-1559827291-72ee739d0d9a',
]

export function destinationImage(row: Pick<Destination, 'slug' | 'image_url'>): string | null {
  const designed = DESTINATION_IMAGES[row.slug]
  const current = row.image_url || ''
  if (!designed) return current || null
  if (!current || LEGACY_DESTINATION_PHOTOS.some(id => current.includes(id))) return designed
  return current
}

export function withDestinationImage<T extends Pick<Destination, 'slug' | 'image_url'>>(row: T): T {
  return { ...row, image_url: destinationImage(row) }
}

export function destinationNames(rows: Pick<Destination, 'name'>[]): string[] {
  return rows.map(row => row.name.trim()).filter(Boolean)
}

export function fallbackDestinationNames(): string[] {
  return [...DESTINATIONS]
}

export function mergeDestinationChoices(catalog: string[], extras: string[] = []): string[] {
  const out: string[] = []
  for (const name of [...catalog, ...extras]) {
    const value = name.trim()
    if (!value || out.includes(value)) continue
    out.push(value)
  }
  return out
}

export function parseDestinationPayload(body: Record<string, unknown>) {
  const name = String(body.name || '').trim()
  const country = String(body.country || '').trim()
  const slugRaw = String(body.slug || '').trim()
  const imageUrl = String(body.image_url || '').trim()
  const description = String(body.description || '').trim()
  const isActive = body.is_active !== false && body.is_active !== 'false'
  const sortParsed = Number(body.sort_order)
  const sort_order = Number.isFinite(sortParsed) ? Math.round(sortParsed) : 0
  return {
    name,
    country,
    slugRaw,
    image_url: imageUrl || null,
    description: description || null,
    is_active: isActive,
    sort_order,
  }
}
