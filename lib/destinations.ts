import { DESTINATIONS } from '@/lib/constants'
import type { Destination } from '@/lib/types'

export const APPLY_EXTRA_DESTINATIONS = ['Anywhere in Kenya'] as const

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
