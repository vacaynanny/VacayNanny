'use client'

import { useEffect, useState } from 'react'
import { fallbackDestinationNames } from '@/lib/destinations'

export function useDestinationNames(seed?: string[]) {
  const [fetched, setFetched] = useState<string[] | null>(null)
  const seedKey = seed ? seed.join('\0') : null

  useEffect(() => {
    if (seedKey !== null) return
    let cancelled = false
    fetch('/api/destinations')
      .then(res => res.json())
      .then(json => {
        if (cancelled) return
        if (!Array.isArray(json.names)) return
        setFetched(json.names.filter((name: unknown) => typeof name === 'string' && name.trim()))
      })
      .catch(() => {
        if (!cancelled) setFetched(fallbackDestinationNames())
      })
    return () => {
      cancelled = true
    }
  }, [seedKey])

  if (seed) return seed
  return fetched ?? fallbackDestinationNames()
}
