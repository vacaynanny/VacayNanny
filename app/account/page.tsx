import { requireProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import PageShell from '@/components/PageShell'
import Link from 'next/link'
import type { Booking, Review } from '@/lib/types'
import SignOutButton from '@/components/SignOutButton'
import FamilyBookings from '@/components/FamilyBookings'
import AccountProfileForm from '@/components/AccountProfileForm'
import { advanceDueBookings } from '@/lib/booking-ops'

export const metadata = { title: 'Your bookings — VacayNanny' }

function escapeIlikeExact(value: string) {
  return value.replace(/[\\%_]/g, char => `\\${char}`)
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

  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Family account</div>
        <h1>Hello, <em>{profile.full_name || 'there'}</em></h1>
        <p>Update your details, then confirm matches, message your nanny, reschedule, cancel, or review a completed placement.</p>
      </section>
      <div className="sec-inner dash-page">
        <div className="dash-toolbar">
          <Link href="/nannies" className="btn-coral">Book a nanny</Link>
          <SignOutButton />
        </div>
        <AccountProfileForm profile={profile} />
        <h3 style={{ marginBottom: 16 }}>Your bookings</h3>
        <FamilyBookings bookings={bookings} />
      </div>
    </PageShell>
  )
}
