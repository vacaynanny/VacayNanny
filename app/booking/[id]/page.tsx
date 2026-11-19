import { notFound } from 'next/navigation'
import PageShell from '@/components/PageShell'
import FamilyBookings from '@/components/FamilyBookings'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase'
import { loadBooking } from '@/lib/booking-ops'
import { validGuestToken } from '@/lib/guest-access'

export const metadata = {
  title: 'Your booking — VacayNanny',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
}
export default async function GuestBooking({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const [{ id }, { token }] = await Promise.all([params, searchParams])
  if (!token || !/^[0-9a-f]{64}$/.test(token) || !/^[0-9a-f-]{36}$/i.test(id))
    notFound()
  const booking = await loadBooking(createServerClient(), id).catch(() => null)
  if (!booking || !validGuestToken(token, booking.guest_access_token_hash))
    notFound()
  delete booking.guest_access_token_hash
  return (
    <PageShell>
      <article className="account-page">
        <header className="account-hero">
          <div>
            <p className="account-kicker">Your holiday plans</p>
            <h1>Hello, {booking.parent_name.split(' ')[0]}.</h1>
            <p className="account-meta">
              Keep this private link to review your match and track your
              booking.
            </p>
          </div>
        </header>
        <FamilyBookings bookings={[booking]} guestToken={token} />
        <div className="payment-box">
          <strong>All your plans, in one place.</strong>
          <p>
            Create an account with your booking email and verify it to see this
            booking in your dashboard.
          </p>
          <div className="booking-actions">
            <Link className="btn-ghost" href="/signup">
              Create an account
            </Link>
          </div>
        </div>
      </article>
    </PageShell>
  )
}
