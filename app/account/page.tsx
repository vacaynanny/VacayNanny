import { requireProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import PageShell from '@/components/PageShell'
import Link from 'next/link'
import type { Booking } from '@/lib/types'
import SignOutButton from '@/components/SignOutButton'

export const metadata = { title: 'Your bookings — VacayNanny' }

export default async function AccountPage() {
  const profile = await requireProfile(['parent', 'admin', 'nanny'])
  let bookings: Booking[] = []
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .or(`parent_id.eq.${profile.id},email.eq.${profile.email}`)
      .order('created_at', { ascending: false })
    bookings = (data || []) as Booking[]
  } catch {}

  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Family account</div>
        <h1>Hello, <em>{profile.full_name || 'there'}</em></h1>
        <p>Track booking requests and upcoming holiday care.</p>
      </section>
      <div className="sec-inner dash-page">
        <div className="dash-toolbar">
          <Link href="/nannies" className="btn-coral">Book a nanny</Link>
          <SignOutButton />
        </div>
        <div className="form-card">
          <h3>Your bookings</h3>
          {bookings.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>No bookings yet. Search nannies and send a request.</p>
          )}
          {bookings.map(b => (
            <div className="review-row" key={b.id}>
              <span className="review-key">
                {b.destination} · {b.check_in} → {b.check_out}
                <br />
                <small style={{ color: 'rgba(255,255,255,0.4)' }}>{b.status}</small>
              </span>
              <span className="review-val">{b.tier || 'Any tier'}</span>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  )
}
