'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatKes, tierLabel } from '@/lib/constants'
import type { Nanny } from '@/lib/types'

export default function AdminNannies({ nannies }: { nannies: Nanny[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [visibility, setVisibility] = useState<'all' | 'live' | 'hidden'>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return nannies.filter(nanny => {
      if (visibility === 'live' && !nanny.is_active) return false
      if (visibility === 'hidden' && nanny.is_active) return false
      if (!q) return true
      return [nanny.display_name, nanny.town, nanny.county, nanny.tier, ...nanny.destinations]
        .some(part => (part || '').toLowerCase().includes(q))
    })
  }, [nannies, query, visibility])

  async function toggle(nanny: Nanny) {
    setBusy(nanny.id)
    setError('')
    try {
      const res = await fetch(`/api/admin/nannies/${nanny.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !nanny.is_active }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not update this profile.')
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  if (nannies.length === 0) {
    return (
      <div className="ops-empty">
        <h3>No live nannies yet</h3>
        <p>Approving an application publishes a profile here. Families only see profiles marked live.</p>
      </div>
    )
  }

  return (
    <div className="ops-stack">
      <div className="ops-filters">
        <input
          className="ops-search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search name, town, or destination"
          aria-label="Search nannies"
        />
        <select aria-label="Visibility" value={visibility} onChange={e => {
          const next = e.target.value
          if (next === 'all' || next === 'live' || next === 'hidden') setVisibility(next)
        }}>
          <option value="all">All profiles</option>
          <option value="live">Live</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
      {error && <p className="field-error-msg">{error}</p>}
      {shown.length === 0 && <p className="ops-note">No profiles match that search.</p>}
      {shown.map(nanny => (
        <article className="ops-card" key={nanny.id}>
          <header className="ops-card-head">
            <div>
              <h3>{nanny.display_name}</h3>
              <p>{[nanny.town, nanny.county].filter(Boolean).join(', ') || 'Location not set'}</p>
            </div>
            <span className={`ops-pill${nanny.is_active ? ' is-live' : ''}`}>{nanny.is_active ? 'Live' : 'Hidden'}</span>
          </header>
          <p className="ops-meta">
            {tierLabel(nanny.tier)} · {formatKes(nanny.daily_rate_kes)} / day
            {nanny.review_count ? ` · ${nanny.rating_avg.toFixed(1)} from ${nanny.review_count}` : ''}
          </p>
          <p className="ops-meta">{nanny.destinations.join(', ') || 'No destinations listed'}</p>
          <div className="ops-card-actions">
            <Link className="btn-coral" href={`/nannies/${nanny.slug}`}>Public profile</Link>
            <button className="btn-ghost" disabled={busy === nanny.id} onClick={() => toggle(nanny)}>
              {nanny.is_active ? 'Hide from families' : 'Publish profile'}
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
