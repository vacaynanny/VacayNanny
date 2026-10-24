'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatKes, tierLabel } from '@/lib/constants'
import type { Nanny, RegisteredAccount } from '@/lib/types'

export default function AdminNannies({ nannies, accounts }: { nannies: Nanny[]; accounts: RegisteredAccount[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [visibility, setVisibility] = useState<'all' | 'live' | 'hidden'>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const waiting = useMemo(
    () => accounts.filter(account => account.role === 'nanny' && !nannies.some(nanny => nanny.user_id === account.id)),
    [accounts, nannies],
  )

  async function approve(userId: string) {
    setBusy(userId)
    setError('')
    try {
      const res = await fetch('/api/admin/nannies/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not approve this profile.')
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

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

  return (
    <div className="ops-stack">
      {waiting.length > 0 && (
        <section className="ops-stack">
          <h2 className="dash-title">Waiting for approval</h2>
          <p className="ops-note">These people registered as nannies. Approving publishes a profile families can book.</p>
          {waiting.map(account => (
            <article className="ops-card" key={account.id}>
              <header className="ops-card-head">
                <div>
                  <h3>{account.fullName || 'Unnamed account'}</h3>
                  <p>{account.email || 'No email'}</p>
                </div>
                <span className="ops-pill">Waiting</span>
              </header>
              <div className="ops-card-actions">
                <button className="btn-coral" disabled={busy === account.id} onClick={() => approve(account.id)}>
                  {busy === account.id ? 'Approving…' : 'Approve and publish'}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      {nannies.length === 0 && waiting.length === 0 && (
        <div className="ops-empty">
          <h3>No live nannies yet</h3>
          <p>When someone registers as a nanny, they appear here for approval. Approving publishes the profile families can book.</p>
        </div>
      )}
      {error && <p className="field-error-msg">{error}</p>}
      {nannies.length > 0 && (
      <>
      <div className="ops-filters">
        <input
          type="text"
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
      </>
      )}
    </div>
  )
}
