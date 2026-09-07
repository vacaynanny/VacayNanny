'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Review } from '@/lib/types'

export default function AdminReviews({ reviews }: { reviews: Review[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const pending = useMemo(() => reviews.filter(r => !r.is_published).length, [reviews])

  async function act(id: string, action: 'publish' | 'hide' | 'delete') {
    setBusy(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: action === 'delete' ? undefined : { 'Content-Type': 'application/json' },
        body: action === 'delete' ? undefined : JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not update this review.')
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  if (reviews.length === 0) {
    return <p style={{ color: 'rgba(255,255,255,0.5)' }}>No family reviews yet.</p>
  }

  return (
    <div>
      {pending > 0 && (
        <p className="replacement-banner" style={{ marginBottom: 16 }}>
          {pending} review{pending === 1 ? '' : 's'} waiting to be published.
        </p>
      )}
      {error && <p className="field-error-msg" style={{ marginBottom: 16 }}>{error}</p>}
      {reviews.map(r => {
        const nannyName = r.nannies?.display_name
        return (
          <div className="form-card" key={r.id}>
            <div className="review-row">
              <span className="review-key">
                <strong>{r.parent_name}</strong>
                <br />
                <small>{nannyName || 'Unknown nanny'}{r.trip_label ? ` · ${r.trip_label}` : ''}</small>
              </span>
              <span className="review-val">{r.is_published ? 'Live' : 'Pending'}</span>
            </div>
            <div className="posted-review-stars" style={{ marginTop: 8 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, fontSize: '0.9rem', margin: '8px 0 12px' }}>{r.body}</p>
            <div className="booking-actions" style={{ marginTop: 0 }}>
              {r.is_published ? (
                <button className="btn-ghost" disabled={busy === r.id} onClick={() => act(r.id, 'hide')}>
                  Hide from profile
                </button>
              ) : (
                <button className="btn-coral" disabled={busy === r.id} onClick={() => act(r.id, 'publish')}>
                  Publish
                </button>
              )}
              <button
                className="btn-ghost"
                disabled={busy === r.id}
                onClick={() => {
                  if (confirm('Delete this review permanently?')) act(r.id, 'delete')
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
