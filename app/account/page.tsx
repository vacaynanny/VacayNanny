import { requireProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import PageShell from '@/components/PageShell'
import Link from 'next/link'
import type { Booking } from '@/lib/types'
import SignOutButton from '@/components/SignOutButton'
import FamilyBookings from '@/components/FamilyBookings'

export const metadata = { title: 'Your bookings — VacayNanny' }

export default async function AccountPage() {
  const profile = await requireProfile(['parent', 'admin', 'nanny'])
  let bookings: Booking[] = []
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('bookings')
      .select('*, nannies(id, display_name, slug, photo_url, tier, daily_rate_kes)')
      .or(`parent_id.eq.${profile.id},email.eq.${profile.email}`)
      .order('created_at', { ascending: false })
    bookings = (data || []) as Booking[]
  } catch {}

  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Family account</div>
        <h1>Hello, <em>{profile.full_name || 'there'}</em></h1>
        <p>Confirm matches, reschedule, or cancel. Status changes email you and the nanny.</p>
      </section>
      <div className="sec-inner dash-page">
        <div className="dash-toolbar">
          <Link href="/nannies" className="btn-coral">Book a nanny</Link>
          <SignOutButton />
        </div>
        <h3 style={{ marginBottom: 16 }}>Your bookings</h3>
        <FamilyBookings bookings={bookings} />
      </div>
    </PageShell>
  )
}
