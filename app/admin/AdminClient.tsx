'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  bookingHasThread,
  careTypeLabel,
  isReplacementOpen,
  isReplacementOverdue,
  parseCareType,
  replacementDeadline,
  replacementSlaMs,
  statusLabel,
} from '@/lib/booking'
import { formatKes, nannyAssignmentWaHref } from '@/lib/constants'
import { matchLabel, matchRequestFromBooking, rankNannyMatches } from '@/lib/match'
import AdminReviews from '@/components/AdminReviews'
import AdminInbox from '@/components/AdminInbox'
import AdminDestinations from '@/components/AdminDestinations'
import AdminCatalog from '@/components/AdminCatalog'
import AdminNannies from '@/components/AdminNannies'
import AdminTeam from '@/components/AdminTeam'
import { useSiteCatalog } from '@/components/SiteCatalogProvider'
import type { SiteCatalog } from '@/lib/catalog'
import BookingThread from '@/components/BookingThread'
import type { ApplicationStatus, Booking, BookingStatus, ContactMessage, Destination, Nanny, NannyApplication, RegisteredAccount, Review, WaitlistEntry } from '@/lib/types'

const APP_STATUSES: ApplicationStatus[] = ['pending', 'reviewing', 'interview', 'approved', 'rejected']
const BOOK_STATUSES: BookingStatus[] = ['pending', 'matched', 'confirmed', 'in_progress', 'completed', 'cancelled']

type Desk = 'overview' | 'applications' | 'bookings' | 'nannies' | 'reviews' | 'inbox' | 'destinations' | 'pricing' | 'content' | 'team'

function slaLabel(requestedAt: string, slaMs: number) {
  const ms = replacementDeadline(requestedAt, slaMs).getTime() - Date.now()
  if (ms <= 0) return 'OVERDUE — refund the booking fee'
  const mins = Math.max(1, Math.ceil(ms / 60_000))
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m left on replacement SLA`
  return `${mins}m left on replacement SLA`
}

function matchesQuery(query: string, parts: Array<string | null | undefined>) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return parts.some(part => (part || '').toLowerCase().includes(q))
}

function isAppStatus(value: string): value is ApplicationStatus | 'all' {
  return value === 'all' || APP_STATUSES.some(status => status === value)
}

function isBookStatus(value: string): value is BookingStatus | 'all' {
  return value === 'all' || BOOK_STATUSES.some(status => status === value)
}

export default function AdminClient({
  applications,
  bookings,
  nannies,
  reviews,
  contactMessages,
  waitlist,
  destinations,
  accounts,
  adminId,
  adminCatalog,
}: {
  applications: NannyApplication[]
  bookings: Booking[]
  nannies: Nanny[]
  reviews: Review[]
  contactMessages: ContactMessage[]
  waitlist: WaitlistEntry[]
  destinations: Destination[]
  accounts: RegisteredAccount[]
  adminId: string
  adminCatalog: SiteCatalog | null
}) {
  const router = useRouter()
  const site = useSiteCatalog()
  const slaMs = replacementSlaMs((adminCatalog?.policies || site.policies).replacementSlaHours)
  const [tab, setTab] = useState<Desk>('overview')
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [force, setForce] = useState<Record<string, boolean>>({})
  const [appQuery, setAppQuery] = useState('')
  const [appStatus, setAppStatus] = useState<ApplicationStatus | 'all'>('all')
  const [bookQuery, setBookQuery] = useState('')
  const [bookStatus, setBookStatus] = useState<BookingStatus | 'all'>('all')

  const rankedByBooking = useMemo(() => {
    const kenyaDestinations = destinations
      .filter(d => (d.country || '').toLowerCase() === 'kenya')
      .map(d => d.name)
    const map: Record<string, ReturnType<typeof rankNannyMatches>> = {}
    for (const booking of bookings) {
      map[booking.id] = rankNannyMatches(
        nannies,
        { ...matchRequestFromBooking(booking), kenyaDestinations },
        bookings,
      )
    }
    return map
  }, [bookings, nannies, destinations])

  const pendingApps = applications.filter(a => a.status === 'pending' || a.status === 'reviewing').length
  const unmatched = bookings.filter(b => !b.nanny_id && b.status !== 'cancelled' && b.status !== 'completed').length
  const overdue = bookings.filter(b => isReplacementOverdue(b, new Date(), slaMs)).length
  const pendingReviews = reviews.filter(r => !r.is_published).length
  const liveNannies = nannies.filter(n => n.is_active).length
  const shownApps = applications.filter(a => (
    (appStatus === 'all' || a.status === appStatus)
    && matchesQuery(appQuery, [a.full_name, a.email, a.town, a.county, a.estimated_tier])
  ))
  const shownBooks = bookings.filter(b => (
    (bookStatus === 'all' || b.status === bookStatus)
    && matchesQuery(bookQuery, [b.parent_name, b.email, b.phone, b.destination, b.tier])
  ))

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

  async function saveAppStatus(id: string, status: ApplicationStatus) {
    setBusy(id)
    setErrors(e => ({ ...e, [id]: '' }))
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrors(e => ({ ...e, [id]: json.error || 'Could not update this application.' }))
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const desks: Array<{ id: Desk; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'applications', label: 'Applications', count: applications.length },
    { id: 'bookings', label: 'Bookings', count: bookings.length },
    { id: 'nannies', label: 'Nannies', count: liveNannies },
    { id: 'reviews', label: 'Reviews', count: pendingReviews },
    { id: 'inbox', label: 'Inbox', count: contactMessages.length + waitlist.length },
    { id: 'destinations', label: 'Destinations', count: destinations.length },
    { id: 'pricing', label: 'Pricing' },
    { id: 'content', label: 'Content' },
    { id: 'team', label: 'Accounts', count: accounts.length },
  ]

  return (
    <div className="ops-body">
      <div className="ops-stats">
        <button type="button" className={pendingApps ? 'is-attention' : ''} onClick={() => setTab('applications')}>
          <span>{pendingApps}</span>
          <small>To vet</small>
        </button>
        <button type="button" className={unmatched ? 'is-attention' : ''} onClick={() => setTab('bookings')}>
          <span>{unmatched}</span>
          <small>Unmatched trips</small>
        </button>
        <button type="button" className={overdue ? 'is-attention' : ''} onClick={() => setTab('bookings')}>
          <span>{overdue}</span>
          <small>Replacement overdue</small>
        </button>
        <button type="button" onClick={() => setTab('nannies')}>
          <span>{liveNannies}</span>
          <small>Live nannies</small>
        </button>
      </div>

      <div className="ops-nav" role="tablist" aria-label="Admin desks">
        {desks.map(desk => (
          <button
            key={desk.id}
            type="button"
            role="tab"
            aria-selected={tab === desk.id}
            className={tab === desk.id ? 'active' : ''}
            onClick={() => setTab(desk.id)}
          >
            {desk.label}{desk.count != null ? ` (${desk.count})` : ''}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="ops-grid">
          <section className="ops-panel">
            <h2>Needs attention</h2>
            <ul className="ops-tasks">
              <li><button type="button" onClick={() => setTab('applications')}>{pendingApps} application{pendingApps === 1 ? '' : 's'} waiting for review</button></li>
              <li><button type="button" onClick={() => setTab('bookings')}>{unmatched} booking{unmatched === 1 ? '' : 's'} still need a nanny</button></li>
              <li><button type="button" onClick={() => setTab('bookings')}>{overdue} replacement clock{overdue === 1 ? '' : 's'} overdue</button></li>
              <li><button type="button" onClick={() => setTab('reviews')}>{pendingReviews} review{pendingReviews === 1 ? '' : 's'} waiting to publish</button></li>
              <li><button type="button" onClick={() => setTab('inbox')}>{contactMessages.length} contact message{contactMessages.length === 1 ? '' : 's'} and {waitlist.length} waitlist signup{waitlist.length === 1 ? '' : 's'}</button></li>
            </ul>
          </section>
          <section className="ops-panel">
            <h2>Setup</h2>
            <ul className="ops-tasks">
              <li>
                <button type="button" onClick={() => setTab('pricing')}>
                  {adminCatalog?.tiers.length ? 'Pricing catalog is published' : 'Pricing catalog is not in the database yet'}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setTab('destinations')}>
                  {destinations.filter(d => d.is_active).length} active destination{destinations.filter(d => d.is_active).length === 1 ? '' : 's'}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setTab('content')}>
                  {adminCatalog ? 'FAQs, steps, and policies can be edited' : 'FAQ and policy tables are not ready yet'}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setTab('team')}>
                  {accounts.filter(account => account.role === 'parent').length} families, {accounts.filter(account => account.role === 'nanny').length} nannies, {accounts.filter(account => account.role === 'admin').length} admins
                </button>
              </li>
            </ul>
          </section>
        </div>
      )}

      {tab === 'applications' && (
        <div className="ops-stack">
          <div className="ops-filters">
            <input className="ops-search" value={appQuery} onChange={e => setAppQuery(e.target.value)} placeholder="Search name, email, or town" aria-label="Search applications" />
            <select aria-label="Application status" value={appStatus} onChange={e => { if (isAppStatus(e.target.value)) setAppStatus(e.target.value) }}>
              <option value="all">All statuses</option>
              {APP_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          {applications.length === 0 && (
            <div className="ops-empty">
              <h3>No applications yet</h3>
              <p>When a nanny applies, the file lands here. Open it to check the ID, certificate of good conduct, and references, then approve it to publish a profile.</p>
            </div>
          )}
          {applications.length > 0 && shownApps.length === 0 && <p className="ops-note">No applications match that search.</p>}
          {shownApps.map(a => (
            <article className="ops-card" key={a.id}>
              <header className="ops-card-head">
                <div>
                  <h3>{a.full_name}</h3>
                  <p>{a.email} · {[a.town, a.county].filter(Boolean).join(', ') || 'Location not set'}</p>
                </div>
                <span className="ops-pill">{a.status}</span>
              </header>
              <p className="ops-meta">
                {a.estimated_tier} tier · {a.experience_years || '—'} yrs · {a.languages.join(', ') || 'No languages'} · CoGC: {a.cogc_status || '—'}
              </p>
              {errors[a.id] && <p className="field-error-msg">{errors[a.id]}</p>}
              <div className="ops-card-actions">
                <Link className="btn-coral" href={`/admin/applications/${a.id}`}>Open file</Link>
                <label className="ops-status-field">
                  <span>Status</span>
                  <select aria-label={`Status for ${a.full_name}`} value={a.status} disabled={busy === a.id} onChange={e => {
                    const next = APP_STATUSES.find(status => status === e.target.value)
                    if (next) saveAppStatus(a.id, next)
                  }}>
                    {APP_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'bookings' && (
        <div className="ops-stack">
          <div className="ops-filters">
            <input className="ops-search" value={bookQuery} onChange={e => setBookQuery(e.target.value)} placeholder="Search family, email, or destination" aria-label="Search bookings" />
            <select aria-label="Booking status" value={bookStatus} onChange={e => { if (isBookStatus(e.target.value)) setBookStatus(e.target.value) }}>
              <option value="all">All statuses</option>
              {BOOK_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </div>
          {bookings.length === 0 && (
            <div className="ops-empty">
              <h3>No bookings yet</h3>
              <p>Family requests show up here. Assign a nanny, message the thread, or start a replacement if the placement falls through.</p>
            </div>
          )}
          {bookings.length > 0 && shownBooks.length === 0 && <p className="ops-note">No bookings match that search.</p>}
          {shownBooks.map(b => {
            const openReplacement = isReplacementOpen(b)
            const replacementOverdue = isReplacementOverdue(b, new Date(), slaMs)
            const ranked = rankedByBooking[b.id] || []
            const best = ranked.find(r => r.eligible)
            const assigned = nannies.find(n => n.id === b.nanny_id)
            const assignedApp = assigned
              ? applications.find(a => a.id === assigned.application_id || (assigned.user_id && a.user_id === assigned.user_id))
              : undefined
            const nannyWa = assigned
              ? nannyAssignmentWaHref(assignedApp?.phone, assignedApp?.country_code, {
                nannyName: assigned.display_name,
                destination: b.destination,
                checkIn: b.check_in,
                checkOut: b.check_out,
              })
              : null
            return (
              <article className="ops-card" key={b.id}>
                <header className="ops-card-head">
                  <div>
                    <h3>{b.parent_name}</h3>
                    <p>{b.email}{b.phone ? ` · ${b.phone}` : ''}</p>
                  </div>
                  <span className="ops-pill">{statusLabel(b.status)}</span>
                </header>
                <p className="ops-meta">
                  {b.destination} · {b.check_in} → {b.check_out} · {b.children_count || '—'} children · {b.tier || 'any tier'} · {careTypeLabel(parseCareType(b.care_type))}
                </p>
                <p className="ops-meta">
                  Family {b.parent_confirmed_at ? 'confirmed' : 'has not confirmed'} · Nanny {b.nanny_response || 'unassigned'}
                  {b.total_amount_kes != null ? ` · ${formatKes(b.total_amount_kes)}` : ''}
                </p>
                {openReplacement && b.replacement_requested_at && (
                  <p className={`replacement-banner${replacementOverdue ? ' overdue' : ''}`}>
                    {slaLabel(b.replacement_requested_at, slaMs)}
                  </p>
                )}
                {errors[b.id] && <p className="field-error-msg">{errors[b.id]}</p>}
                {best && (
                  <p className="match-hint">
                    Suggested: <strong>{best.nanny.display_name}</strong>
                    {best.reasons.length ? ` — ${best.reasons.slice(0, 3).join(' · ')}` : ''}
                  </p>
                )}
                {!best && (b.status === 'pending' || openReplacement || !b.nanny_id) && (
                  <p className="match-hint">No auto-match — nobody is free for these dates, destination, and care needs.</p>
                )}
                <label className="ops-status-field">
                  <span>Assign nanny</span>
                  <select
                    key={`${b.id}-${b.nanny_id || 'none'}`}
                    defaultValue={b.nanny_id || ''}
                    onChange={e => patch(b.id, { action: 'assign', nannyId: e.target.value, force: Boolean(force[b.id]) })}
                  >
                    <option value="">Unassigned</option>
                    {ranked.map(r => (
                      <option key={r.nanny.id} value={r.nanny.id}>{matchLabel(r)}</option>
                    ))}
                  </select>
                </label>
                <label className="force-assign">
                  <input
                    type="checkbox"
                    checked={Boolean(force[b.id])}
                    onChange={e => setForce(f => ({ ...f, [b.id]: e.target.checked }))}
                  />
                  Force assign (skip clash check)
                </label>
                <div className="ops-card-actions">
                  {best && (!b.nanny_id || openReplacement || b.nanny_id !== best.nanny.id) && b.status !== 'cancelled' && b.status !== 'completed' && (
                    <button className="btn-coral" disabled={busy === b.id} onClick={() => patch(b.id, { action: 'auto_match' })}>
                      Auto-match {best.nanny.display_name.split(' ')[0]}
                    </button>
                  )}
                  {nannyWa && b.status !== 'cancelled' && b.status !== 'completed' && (
                    <a className="btn-coral" href={nannyWa} target="_blank" rel="noopener noreferrer">WhatsApp nanny</a>
                  )}
                  {b.nanny_id && !openReplacement && b.status !== 'cancelled' && b.status !== 'completed' && (
                    <button className="btn-ghost" disabled={busy === b.id} onClick={() => patch(b.id, { action: 'replace' })}>Replace nanny</button>
                  )}
                  {openReplacement && (
                    <button className="btn-coral" disabled={busy === b.id} onClick={() => patch(b.id, { action: 'refund_replacement' })}>Refund booking fee</button>
                  )}
                  <label className="ops-status-field">
                    <span>Status</span>
                    <select aria-label={`Status for ${b.parent_name}`} value={b.status} disabled={busy === b.id} onChange={e => {
                      const next = e.target.value
                      if (BOOK_STATUSES.some(status => status === next)) patch(b.id, { action: 'set_status', status: next })
                    }}>
                      {BOOK_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}
                    </select>
                  </label>
                </div>
                {bookingHasThread(b) && (
                  <BookingThread bookingId={b.id} viewerRole="admin" counterpartName={assigned?.display_name || b.parent_name} />
                )}
              </article>
            )
          })}
        </div>
      )}

      {tab === 'nannies' && <AdminNannies nannies={nannies} />}
      {tab === 'reviews' && <AdminReviews reviews={reviews} />}
      {tab === 'inbox' && <AdminInbox contactMessages={contactMessages} waitlist={waitlist} />}
      {tab === 'destinations' && <AdminDestinations destinations={destinations} />}
      {tab === 'pricing' && <AdminCatalog section="pricing" catalog={adminCatalog} />}
      {tab === 'content' && <AdminCatalog section="content" catalog={adminCatalog} />}
      {tab === 'team' && <AdminTeam accounts={accounts} adminId={adminId} />}
    </div>
  )
}
