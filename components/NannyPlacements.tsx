'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BookingCalendar from '@/components/BookingCalendar'
import { careTypeLabel, parseCareType, statusLabel } from '@/lib/booking'
import type { Booking } from '@/lib/types'

export default function NannyPlacements({ bookings }: { bookings: Booking[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function act(id: string, action: 'accept' | 'decline') {
    setBusy(id)
    setError('')
    try {
      const res = await fetch(`/api/booking/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not update this placement.')
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="form-card">
        <h3>Availability calendar</h3>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 16, fontSize: '0.88rem' }}>
          Highlighted days are placements that block new assignments.
        </p>
        <BookingCalendar bookings={bookings} />
      </div>
      <div className="form-card">
        <h3>Assigned bookings</h3>
        {error && <p className="field-error-msg" style={{ marginBottom: 12 }}>{error}</p>}
        {bookings.length === 0 && <p style={{ color: 'rgba(255,255,255,0.5)' }}>No assignments yet.</p>}
        {bookings.map(b => {
          const awaiting = Boolean(b.nanny_id) && b.nanny_response !== 'accepted' && b.nanny_response !== 'declined'
            && (b.status === 'pending' || b.status === 'matched' || b.status === 'confirmed' || b.status === 'in_progress')
          return (
            <div key={b.id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="review-row">
                <span className="review-key">
                  {b.destination} · {b.check_in} → {b.check_out}
                  <br />
                  <small>{b.parent_name} · {statusLabel(b.status)} · {careTypeLabel(parseCareType(b.care_type))}</small>
                </span>
                <span className="review-val">{b.children_count || ''} children</span>
              </div>
              {awaiting && (
                <div className="booking-actions">
                  <button className="btn-coral" disabled={busy === b.id} onClick={() => act(b.id, 'accept')}>Accept</button>
                  <button className="btn-ghost" disabled={busy === b.id} onClick={() => act(b.id, 'decline')}>Decline</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
