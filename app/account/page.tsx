import { requireProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import PageShell from '@/components/PageShell'
import Link from 'next/link'
import type { Booking, BookingStatus, Review } from '@/lib/types'
import SignOutButton from '@/components/SignOutButton'
import FamilyBookings from '@/components/FamilyBookings'
import AccountProfileForm from '@/components/AccountProfileForm'
import MediaImage from '@/components/MediaImage'
import { advanceDueBookings } from '@/lib/booking-ops'

export const metadata = { title: 'Your bookings — VacayNanny' }

function escapeIlikeExact(value: string) {
  return value.replace(/[\\%_]/g, char => `\\${char}`)
}

const OPEN_STATUSES: BookingStatus[] = ['pending', 'matched', 'confirmed', 'in_progress']

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'YN'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function memberSince(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function tripWhen(booking: Booking) {
  const [year, month, day] = booking.check_in.split('-').map(Number)
  if (!year || !month || !day) return booking.check_in
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function AccountPage() {
  const profile = await requireProfile(['parent', 'admin', 'nanny'])
  let bookings: Booking[] = []
  try {
    const supabase = createServerClient()
    await advanceDueBookings(supabase)
    const columns = '*, nannies(id, display_name, slug, photo_url, tier, daily_rate_kes)'
    const queries = [
      supabase.from('bookings').select(columns).eq('parent_id', profile.id),
    ]
    if (profile.emailConfirmed && profile.email) {
      queries.push(
        supabase.from('bookings').select(columns).ilike('email', escapeIlikeExact(profile.email)),
      )
    }
    const results = await Promise.all(queries)
    const merged = new Map<string, Booking>()
    for (const result of results) {
      for (const row of (result.data || []) as Booking[]) merged.set(row.id, row)
    }
    bookings = [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))
    const bookingIds = bookings.map(b => b.id)
    if (bookingIds.length) {
      const { data: reviewRows } = await supabase
        .from('reviews')
        .select('id, booking_id, rating, body, trip_label, is_published, created_at')
        .in('booking_id', bookingIds)
      const byBooking = new Map(
        ((reviewRows || []) as Pick<Review, 'id' | 'booking_id' | 'rating' | 'body' | 'trip_label' | 'is_published' | 'created_at'>[])
          .filter(r => r.booking_id)
          .map(r => [r.booking_id as string, r]),
      )
      bookings = bookings.map(b => ({ ...b, review: byBooking.get(b.id) ?? null }))
    }
  } catch {}

  const name = profile.full_name?.trim() || 'there'
  const since = memberSince(profile.created_at)
  const openTrips = bookings.filter(booking => OPEN_STATUSES.includes(booking.status))
  const waitingOnYou = openTrips.filter(booking => booking.status === 'matched' && booking.nanny_id && !booking.parent_confirmed_at)
  const completed = bookings.filter(booking => booking.status === 'completed').length
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nextTrip = [...openTrips].sort((a, b) => a.check_in.localeCompare(b.check_in))
    .find(booking => booking.check_in >= today)
    ?? [...openTrips].sort((a, b) => a.check_in.localeCompare(b.check_in))[0]

  return (
    <PageShell>
      <div className="account-page">
        <header className="account-hero">
          <div className="account-identity">
            <div className="account-avatar">
              {profile.avatar_url
                ? <MediaImage className="account-avatar-img" src={profile.avatar_url} alt="" fill sizes="84px" />
                : <span>{initials(profile.full_name || '')}</span>}
            </div>
            <div>
              <p className="account-kicker">Family account</p>
              <h1>Hello, <em>{name}</em></h1>
              <p className="account-meta">
                {profile.email || 'Signed in'}
                {profile.phone ? ` · ${profile.phone}` : ''}
                {since ? ` · Member since ${since}` : ''}
              </p>
            </div>
          </div>
          <div className="account-hero-actions">
            <Link href="/nannies" className="btn-coral">Book a nanny</Link>
            <SignOutButton />
          </div>
        </header>

        <section className="account-stats" aria-label="Booking summary">
          <article>
            <span>{openTrips.length}</span>
            <small>{openTrips.length === 1 ? 'Open trip' : 'Open trips'}</small>
          </article>
          <article className={waitingOnYou.length ? 'is-attention' : undefined}>
            <span>{waitingOnYou.length}</span>
            <small>{waitingOnYou.length === 1 ? 'Match to confirm' : 'Matches to confirm'}</small>
          </article>
          <article>
            <span>{completed}</span>
            <small>{completed === 1 ? 'Completed trip' : 'Completed trips'}</small>
          </article>
        </section>

        {nextTrip && (
          <p className="account-next">
            Next trip · <strong>{nextTrip.destination}</strong> · {tripWhen(nextTrip)}
            {nextTrip.nannies?.display_name ? ` · ${nextTrip.nannies.display_name}` : ' · Awaiting a nanny'}
          </p>
        )}

        <div className="account-layout">
          <section className="account-trips" aria-labelledby="account-trips-title">
            <div className="account-section-head">
              <h2 id="account-trips-title">Your trips</h2>
              <p>Confirm matches, message your nanny, reschedule, or review a completed stay.</p>
            </div>
            <FamilyBookings bookings={bookings} />
          </section>
          <AccountProfileForm profile={profile} />
        </div>
      </div>
    </PageShell>
  )
}
