import { requireProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import PageShell from '@/components/PageShell'
import SignOutButton from '@/components/SignOutButton'
import Link from 'next/link'
import type { Booking, Nanny } from '@/lib/types'
import NannyPlacements from '@/components/NannyPlacements'

export const metadata = { title: 'Nanny dashboard — VacayNanny' }

export default async function NannyDash() {
  const profile = await requireProfile(['nanny', 'admin'])
  let nanny: Nanny | null = null
  let bookings: Booking[] = []
  try {
    const supabase = createServerClient()
    const { data } = await supabase.from('nannies').select('*').eq('user_id', profile.id).maybeSingle()
    nanny = data as Nanny | null
    if (nanny) {
      const { data: rows } = await supabase
        .from('bookings')
        .select('*')
        .eq('nanny_id', nanny.id)
        .order('check_in', { ascending: true })
      bookings = (rows || []) as Booking[]
    }
  } catch {}

  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Nanny portal</div>
        <h1>Your <em>placements</em></h1>
        <p>Accept or decline assignments. Highlighted calendar days are already booked.</p>
      </section>
      <div className="sec-inner dash-page">
        <div className="dash-toolbar">
          {nanny && <Link href={`/nannies/${nanny.slug}`} className="btn-coral">View public profile</Link>}
          <SignOutButton />
        </div>
        {!nanny && (
          <div className="form-card">
            <h3>Profile not live yet</h3>
            <p style={{ color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>
              Apply to join and wait for vetting. Once approved, your profile appears here.
            </p>
            <Link href="/become-a-nanny" className="btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>Apply now</Link>
          </div>
        )}
        {nanny && (
          <>
            <div className="form-card">
              <h3>Profile</h3>
              <div className="review-row"><span className="review-key">Name</span><span className="review-val">{nanny.display_name}</span></div>
              <div className="review-row"><span className="review-key">Tier</span><span className="review-val">{nanny.tier}</span></div>
              <div className="review-row"><span className="review-key">Daily rate</span><span className="review-val">KES {nanny.daily_rate_kes.toLocaleString('en-KE')}</span></div>
              <div className="review-row"><span className="review-key">Status</span><span className="review-val">{nanny.is_active ? 'Live' : 'Hidden'}</span></div>
            </div>
            <NannyPlacements bookings={bookings} />
          </>
        )}
      </div>
    </PageShell>
  )
}
