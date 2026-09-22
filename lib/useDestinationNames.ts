'use client'

import { useEffect, useState } from 'react'
import { fallbackDestinationNames } from '@/lib/destinations'

export function useDestinationNames(seed?: string[]) {
  const [names, setNames] = useState<string[]>(() => seed ?? fallbackDestinationNames())

  useEffect(() => {
    if (seed) {
      setNames(seed)
      return
    }
    let cancelled = false
    fetch('/api/destinations')
      .then(res => res.json())
      .then(json => {
        if (cancelled) return
        if (!Array.isArray(json.names)) return
        setNames(json.names.filter((name: unknown) => typeof name === 'string' && name.trim()))
      })
      .catch(() => {
        if (!cancelled) setNames(fallbackDestinationNames())
      })
    return () => {
      cancelled = true
    }
  }, [seed === undefined ? '__fetch__' : seed.join('\0')])

  return names
}
