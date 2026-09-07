'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  bookingBlocksAvailability,
  careTypeLabel,
  datesOverlap,
  isReplacementOpen,
  isReplacementOverdue,
  parseCareType,
  replacementDeadline,
  statusLabel,
} from '@/lib/booking'
import AdminReviews from '@/components/AdminReviews'
import type { ApplicationStatus, BookingStatus, NannyApplication, Booking, Nanny, Review } from '@/lib/types'

const APP_STATUSES: ApplicationStatus[] = ['pending', 'reviewing', 'interview', 'approved', 'rejected']
const BOOK_STATUSES: BookingStatus[] = ['pending', 'matched', 'confirmed', 'in_progress', 'completed', 'cancelled']

function slaLabel(requestedAt: string) {
  const ms = replacementDeadline(requestedAt).getTime() - Date.now()
  if (ms <= 0) return 'OVERDUE — refund the booking fee'
  const mins = Math.max(1, Math.ceil(ms / 60_000))
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m left on replacement SLA`
  return `${mins}m left on replacement SLA`
}

export default function AdminClient({
  applications,
  bookings,
  nannies,
  reviews,
}: {
  applications: NannyApplication[]
  bookings: Booking[]
  nannies: Nanny[]
  reviews: Review[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'applications' | 'bookings' | 'reviews'>('applications')
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [force, setForce] = useState<Record<string, boolean>>({})

  const clashesByBooking = useMemo(() => {
    const map: Record<string, Record<string, string>> = {}
    for (const booking of bookings) {
      map[booking.id] = {}
      for (const nanny of nannies) {
        const hit = bookings.find(other =>
          other.id !== booking.id
          && other.nanny_id === nanny.id
          && bookingBlocksAvailability(other.status, other.nanny_response)
          && datesOverlap(booking.check_in, booking.check_out, other.check_in, other.check_out),
        )
        if (hit) map[booking.id][nanny.id] = `${hit.parent_name} (${hit.check_in} → ${hit.check_out})`
      }
    }
    return map
  }, [bookings, nannies])

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id)
    setErrors(e => ({ ...e, [id]: '' }))
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const clash = Array.isArray(json.clashes) && json.clashes[0]
          ? ` Overlaps ${json.clashes[0].parent_name} (${json.clashes[0].check_in} → ${json.clashes[0].check_out}).`
          : ''
        setErrors(e => ({ ...e, [id]: `${json.error || 'Update failed.'}${clash}` }))
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function setAppStatus(id: string, status: ApplicationStatus) {
    setBusy(id)
    await fetch(`/api/admin/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setBusy(null)
    router.refresh()
  }

  return (
    <div className="sec-inner dash-page">
      <div className="dash-tabs">
        <button className={tab === 'applications' ? 'active' : ''} onClick={() => setTab('applications')}>Applications ({applications.length})</button>
        <button className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}>Bookings ({bookings.length})</button>
        <button className={tab === 'reviews' ? 'active' : ''} onClick={() => setTab('reviews')}>
          Reviews ({reviews.filter(r => !r.is_published).length} pending)
        </button>
      </div>

      {tab === 'applications' && (
        <div className="admin-table-wrap">
          {applications.map(a => (
            <div className="form-card" key={a.id}>
              <div className="review-row">
                <span className="review-key"><strong>{a.full_name}</strong><br /><small>{a.email} · {a.town}, {a.county}</small></span>
                <span className="review-val">{a.status} · {a.estimated_tier}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', margin: '10px 0' }}>
                {a.experience_years} yrs · {a.languages.join(', ')} · CoGC: {a.cogc_status || '—'}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {APP_STATUSES.map(s => (
                  <button
                    key={s}
                    className="btn-ghost"
                    style={{ padding: '8px 14px', fontSize: '0.78rem', opacity: a.status === s ? 1 : 0.6 }}
                    disabled={busy === a.id}
                    onClick={() => setAppStatus(a.id, s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {applications.length === 0 && <p style={{ color: 'rgba(255,255,255,0.5)' }}>No applications yet.</p>}
        </div>
      )}

      {tab === 'bookings' && (
        <div>
          {bookings.map(b => {
            const openReplacement = isReplacementOpen(b)
            const overdue = isReplacementOverdue(b)
            const nannyClash = clashesByBooking[b.id] || {}
            return (
              <div className="form-card" key={b.id}>
                <div className="review-row">
                  <span className="review-key"><strong>{b.parent_name}</strong><br /><small>{b.email} · {b.phone}</small></span>
                  <span className="review-val">{statusLabel(b.status)}</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', margin: '10px 0' }}>
                  {b.destination} · {b.check_in} → {b.check_out} · {b.children_count} children · {b.tier || 'any tier'} · {careTypeLabel(parseCareType(b.care_type))}
                </p>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>
                  Family: {b.parent_confirmed_at ? 'confirmed' : 'not confirmed'} · Nanny: {b.nanny_response || 'unassigned'}
                  {b.total_amount_kes != null ? ` · KES ${b.total_amount_kes.toLocaleString('en-KE')}` : ''}
                </p>
                {openReplacement && b.replacement_requested_at && (
                  <p className={`replacement-banner${overdue ? ' overdue' : ''}`}>
                    {slaLabel(b.replacement_requested_at)}
                  </p>
                )}
                {errors[b.id] && <p className="field-error-msg" style={{ marginBottom: 10 }}>{errors[b.id]}</p>}
                <div className="field" style={{ marginBottom: 10 }}>
                  <label>Assign nanny</label>
                  <select
                    key={`${b.id}-${b.nanny_id || 'none'}`}
                    defaultValue={b.nanny_id || ''}
                    onChange={e => patch(b.id, { action: 'assign', nannyId: e.target.value, force: Boolean(force[b.id]) })}
                  >
                    <option value="">Unassigned</option>
                    {nannies.map(n => {
                      const clash = nannyClash[n.id]
                      return (
                        <option key={n.id} value={n.id}>
                          {n.display_name} ({n.tier}){clash ? ` — busy: ${clash}` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <label className="force-assign">
                  <input
                    type="checkbox"
                    checked={Boolean(force[b.id])}
                    onChange={e => setForce(f => ({ ...f, [b.id]: e.target.checked }))}
                  />
                  Force assign (skip clash check)
                </label>
                <div className="booking-actions" style={{ marginTop: 12 }}>
                  {b.nanny_id && !openReplacement && b.status !== 'cancelled' && b.status !== 'completed' && (
                    <button className="btn-ghost" disabled={busy === b.id} onClick={() => patch(b.id, { action: 'replace' })}>
                      Replace nanny
                    </button>
                  )}
                  {openReplacement && (
                    <button className="btn-coral" disabled={busy === b.id} onClick={() => patch(b.id, { action: 'refund_replacement' })}>
                      Refund booking fee
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {BOOK_STATUSES.map(s => (
                    <button
                      key={s}
                      className="btn-ghost"
                      style={{ padding: '8px 14px', fontSize: '0.78rem', opacity: b.status === s ? 1 : 0.6 }}
                      disabled={busy === b.id}
                      onClick={() => patch(b.id, { action: 'set_status', status: s })}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {bookings.length === 0 && <p style={{ color: 'rgba(255,255,255,0.5)' }}>No bookings yet.</p>}
        </div>
      )}

      {tab === 'reviews' && <AdminReviews reviews={reviews} />}
    </div>
  )
}
