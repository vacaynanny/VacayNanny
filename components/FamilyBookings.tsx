'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  cancellationRefundPercent,
  careTypeLabel,
  parseCareType,
  refundPolicyLabel,
  statusLabel,
} from '@/lib/booking'
import { formatKes } from '@/lib/constants'
import type { Booking } from '@/lib/types'

export default function FamilyBookings({ bookings }: { bookings: Booking[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [dates, setDates] = useState({ checkIn: '', checkOut: '' })

  async function act(id: string, action: string, extra?: Record<string, string>) {
    setBusy(id)
    setError('')
    try {
      const res = await fetch(`/api/booking/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not update this booking.')
        return
      }
      setRescheduleId(null)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  if (bookings.length === 0) {
    return <p style={{ color: 'rgba(255,255,255,0.5)' }}>No bookings yet. Search nannies and send a request.</p>
  }

  return (
    <div>
      {error && <p className="field-error-msg" style={{ marginBottom: 16 }}>{error}</p>}
      {bookings.map(b => {
        const care = parseCareType(b.care_type)
        const canConfirm = b.status === 'matched' && Boolean(b.nanny_id) && !b.parent_confirmed_at
        const canCancel = b.status === 'pending' || b.status === 'matched' || b.status === 'confirmed'
        const canReschedule = canCancel
        const refund = cancellationRefundPercent(b.check_in)
        const nannyName = b.nannies?.display_name
        return (
          <div className="form-card" key={b.id}>
            <div className="review-row">
              <span className="review-key">
                <strong>{b.destination}</strong>
                <br />
                <small style={{ color: 'rgba(255,255,255,0.4)' }}>{b.check_in} → {b.check_out}</small>
              </span>
              <span className="review-val">{statusLabel(b.status)}</span>
            </div>
            <div className="review-row"><span className="review-key">Nanny</span><span className="review-val">{nannyName || 'Awaiting match'}</span></div>
            <div className="review-row"><span className="review-key">Care</span><span className="review-val">{careTypeLabel(care)}</span></div>
            <div className="review-row"><span className="review-key">Estimate</span><span className="review-val">{b.total_amount_kes != null ? formatKes(b.total_amount_kes) : '—'}</span></div>
            {b.parent_confirmed_at && <div className="review-row"><span className="review-key">You</span><span className="review-val">Confirmed</span></div>}
            {b.nanny_response && <div className="review-row"><span className="review-key">Nanny reply</span><span className="review-val">{b.nanny_response}</span></div>}
            {b.status === 'cancelled' && (
              <div className="review-row">
                <span className="review-key">Refund</span>
                <span className="review-val">{refundPolicyLabel(b.refund_percent ?? 0)}</span>
              </div>
            )}
            <div className="booking-actions">
              {canConfirm && (
                <button className="btn-coral" disabled={busy === b.id} onClick={() => act(b.id, 'confirm')}>
                  Confirm match
                </button>
              )}
              {canReschedule && (
                <button className="btn-ghost" disabled={busy === b.id} onClick={() => {
                  setRescheduleId(rescheduleId === b.id ? null : b.id)
                  setDates({ checkIn: b.check_in, checkOut: b.check_out })
                }}>
                  Reschedule
                </button>
              )}
              {canCancel && (
                <button className="btn-ghost" disabled={busy === b.id} onClick={() => {
                  if (confirm(`Cancel this booking? ${refundPolicyLabel(refund)}.`)) act(b.id, 'cancel')
                }}>
                  Cancel
                </button>
              )}
            </div>
            {rescheduleId === b.id && (
              <form
                className="reschedule-form"
                onSubmit={e => {
                  e.preventDefault()
                  act(b.id, 'reschedule', dates)
                }}
              >
                <div className="mrow">
                  <div className="mfield">
                    <label>Check-in</label>
                    <input type="date" required value={dates.checkIn} onChange={e => setDates(d => ({ ...d, checkIn: e.target.value }))} />
                  </div>
                  <div className="mfield">
                    <label>Check-out</label>
                    <input type="date" required value={dates.checkOut} onChange={e => setDates(d => ({ ...d, checkOut: e.target.value }))} />
                  </div>
                </div>
                <button className="btn-coral" type="submit" disabled={busy === b.id}>Save dates</button>
              </form>
            )}
          </div>
        )
      })}
    </div>
  )
}
