import { requireProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import PageShell from '@/components/PageShell'
import SignOutButton from '@/components/SignOutButton'
import Link from 'next/link'
import type { Booking, Nanny } from '@/lib/types'
import NannyPlacements from '@/components/NannyPlacements'
import NannyProfileEditor from '@/components/NannyProfileEditor'
import NannyEarnings from '@/components/NannyEarnings'

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
        <p>Edit your public profile, track placement value, and accept or decline assignments.</p>
      </section>
      <div className="sec-inner dash-page">
        <div className="dash-toolbar">
          {nanny?.is_active && <Link href={`/nannies/${nanny.slug}`} className="btn-coral">View public profile</Link>}
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
            <NannyProfileEditor nanny={nanny} />
            <NannyEarnings bookings={bookings} />
            <NannyPlacements bookings={bookings} />
          </>
        )}
      </div>
    </PageShell>
  )
}
