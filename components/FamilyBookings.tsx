'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BookingReviewForm from '@/components/BookingReviewForm'
import BookingThread from '@/components/BookingThread'
import {
  bookingHasThread,
  canLeaveReview,
  cancellationRefundPercent,
  careTypeLabel,
  parseCareType,
  refundPolicyLabel,
  statusLabel,
} from '@/lib/booking'
import { useSiteCatalog } from '@/components/SiteCatalogProvider'
import { formatKes } from '@/lib/constants'
import type { Booking, NannyResponse } from '@/lib/types'

function nannyReply(response: NannyResponse) {
  switch (response) {
    case 'pending':
      return 'Waiting on the nanny'
    case 'accepted':
      return 'Nanny accepted'
    case 'declined':
      return 'Nanny declined'
    default: {
      const _never: never = response
      return _never
    }
  }
}

function parseDay(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function formatTripRange(checkIn: string, checkOut: string) {
  const start = parseDay(checkIn)
  const end = parseDay(checkOut)
  if (!start || !end) return `${checkIn} → ${checkOut}`
  const sameYear = start.getFullYear() === end.getFullYear()
  const startLabel = start.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  })
  const endLabel = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

function tripNights(checkIn: string, checkOut: string) {
  const start = parseDay(checkIn)
  const end = parseDay(checkOut)
  if (!start || !end) return null
  const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  return nights > 0 ? nights : null
}

export default function FamilyBookings({ bookings }: { bookings: Booking[] }) {
  const router = useRouter()
  const policies = useSiteCatalog().policies
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
    return (
      <div className="trip-empty">
        <h3>No trips yet</h3>
        <p>Search nannies and send a request. Matches, messages, and reviews will show up here.</p>
        <Link href="/nannies" className="btn-coral">Find a nanny</Link>
      </div>
    )
  }

  return (
    <div className="trip-list">
      {error && <p className="field-error-msg trip-error">{error}</p>}
      {bookings.map(b => {
        const care = parseCareType(b.care_type)
        const canConfirm = b.status === 'matched' && Boolean(b.nanny_id) && !b.parent_confirmed_at
        const canCancel = b.status === 'pending' || b.status === 'matched' || b.status === 'confirmed'
        const canReschedule = canCancel
        const refund = cancellationRefundPercent(b.check_in, new Date(), policies)
        const nannyName = b.nannies?.display_name
        const nights = tripNights(b.check_in, b.check_out)
        const family = [b.children_count ? `${b.children_count} ${b.children_count === '1' ? 'child' : 'children'}` : '', b.youngest_age].filter(Boolean).join(' · ')
        return (
          <article className={`trip-card${canConfirm ? ' needs-you' : ''}`} key={b.id}>
            <div className="trip-card-head">
              <div>
                <p className="trip-when">
                  {formatTripRange(b.check_in, b.check_out)}
                  {nights ? ` · ${nights} ${nights === 1 ? 'night' : 'nights'}` : ''}
                </p>
                <h3>{b.destination}</h3>
              </div>
              <span className={`trip-pill trip-pill-${b.status}`}>{statusLabel(b.status)}</span>
            </div>
            <dl className="trip-facts">
              <div>
                <dt>Nanny</dt>
                <dd>{nannyName || 'Awaiting match'}</dd>
              </div>
              <div>
                <dt>Care</dt>
                <dd>{careTypeLabel(care)}</dd>
              </div>
              {family && (
                <div>
                  <dt>Family</dt>
                  <dd>{family}</dd>
                </div>
              )}
              <div>
                <dt>Estimate</dt>
                <dd className="trip-price">{b.total_amount_kes != null ? formatKes(b.total_amount_kes) : '—'}</dd>
              </div>
            </dl>
            {(b.parent_confirmed_at || b.nanny_response || b.status === 'cancelled') && (
              <ul className="trip-notes">
                {b.parent_confirmed_at && <li>You confirmed this match.</li>}
                {b.nanny_response && <li>{nannyReply(b.nanny_response)}</li>}
                {b.status === 'cancelled' && <li>{refundPolicyLabel(b.refund_percent ?? 0, policies)}</li>}
              </ul>
            )}
            {canConfirm && nannyName && <p className="trip-prompt">Confirm this match to lock in {nannyName}.</p>}
            {(canConfirm || canReschedule || canCancel) && (
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
                  if (confirm(`Cancel this booking? ${refundPolicyLabel(refund, policies)}.`)) act(b.id, 'cancel')
                }}>
                  Cancel
                </button>
              )}
            </div>
            )}
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
            {b.status === 'completed' && b.nanny_id && b.review && (
              <div className="posted-review">
                <p className="review-form-title">Your review</p>
                <div className="posted-review-stars">{'★'.repeat(b.review.rating)}{'☆'.repeat(5 - b.review.rating)}</div>
                <p>{b.review.body}</p>
                <p className={`review-mod-status${b.review.is_published ? ' live' : ''}`}>
                  {b.review.is_published
                    ? 'Live on the nanny profile'
                    : 'Submitted — waiting for VacayNanny to publish'}
                </p>
              </div>
            )}
            {canLeaveReview(b) && (
              <BookingReviewForm bookingId={b.id} nannyName={nannyName} />
            )}
            {bookingHasThread(b) && (
              <BookingThread bookingId={b.id} viewerRole="parent" counterpartName={nannyName || undefined} />
            )}
          </article>
        )
      })}
    </div>
  )
}
