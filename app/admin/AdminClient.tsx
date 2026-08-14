'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ApplicationStatus, BookingStatus, NannyApplication, Booking, Nanny } from '@/lib/types'

const APP_STATUSES: ApplicationStatus[] = ['pending', 'reviewing', 'interview', 'approved', 'rejected']
const BOOK_STATUSES: BookingStatus[] = ['pending', 'matched', 'confirmed', 'in_progress', 'completed', 'cancelled']

export default function AdminClient({
  applications,
  bookings,
  nannies,
}: {
  applications: NannyApplication[]
  bookings: Booking[]
  nannies: Nanny[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'applications' | 'bookings'>('applications')
  const [busy, setBusy] = useState<string | null>(null)

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

  async function setBooking(id: string, status: BookingStatus, nannyId?: string) {
    setBusy(id)
    await fetch(`/api/admin/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, nannyId }),
    })
    setBusy(null)
    router.refresh()
  }

  return (
    <div className="sec-inner dash-page">
      <div className="dash-tabs">
        <button className={tab === 'applications' ? 'active' : ''} onClick={() => setTab('applications')}>Applications ({applications.length})</button>
        <button className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}>Bookings ({bookings.length})</button>
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
          {bookings.map(b => (
            <div className="form-card" key={b.id}>
              <div className="review-row">
                <span className="review-key"><strong>{b.parent_name}</strong><br /><small>{b.email} · {b.phone}</small></span>
                <span className="review-val">{b.status}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', margin: '10px 0' }}>
                {b.destination} · {b.check_in} → {b.check_out} · {b.children_count} children · {b.tier || 'any tier'}
              </p>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Assign nanny</label>
                <select
                  defaultValue={b.nanny_id || ''}
                  onChange={e => setBooking(b.id, b.status === 'pending' ? 'matched' : b.status, e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {nannies.map(n => <option key={n.id} value={n.id}>{n.display_name} ({n.tier})</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {BOOK_STATUSES.map(s => (
                  <button
                    key={s}
                    className="btn-ghost"
                    style={{ padding: '8px 14px', fontSize: '0.78rem', opacity: b.status === s ? 1 : 0.6 }}
                    disabled={busy === b.id}
                    onClick={() => setBooking(b.id, s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {bookings.length === 0 && <p style={{ color: 'rgba(255,255,255,0.5)' }}>No bookings yet.</p>}
        </div>
      )}
    </div>
  )
}
