import ClaimApplication from '@/components/ClaimApplication'
import { requireProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import PageShell from '@/components/PageShell'
import SignOutButton from '@/components/SignOutButton'
import Link from 'next/link'
import { getDestinations } from '@/lib/data'
import { destinationNames } from '@/lib/destinations'
import type { Booking, Nanny } from '@/lib/types'
import NannyPlacements from '@/components/NannyPlacements'
import NannyProfileEditor from '@/components/NannyProfileEditor'
import NannyEarnings from '@/components/NannyEarnings'
import { advanceDueBookings } from '@/lib/booking-ops'
import { needsSafeguardingModule } from '@/lib/safeguarding'

export const metadata = { title: 'Nanny dashboard — VacayNanny' }

export default async function NannyDash() {
  const profile = await requireProfile(['parent', 'nanny', 'admin'])
  let nanny: Nanny | null = null
  let bookings: Booking[] = []
  const destinationCatalog = destinationNames(await getDestinations())
  try {
    const supabase = createServerClient()
    await advanceDueBookings(supabase)
    const { data } = await supabase
      .from('nannies')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle()
    nanny = data as Nanny | null
    if (nanny) {
      const { data: assigned } = await supabase
        .from('booking_assignments')
        .select('booking_id,response')
        .eq('nanny_id', nanny.id)
      if (assigned?.length) {
        const { data: rows } = await supabase
          .from('bookings')
          .select(
            '*,booking_assignments(slot,nanny_id,response,nannies(id,display_name,slug,photo_url,tier))',
          )
          .in(
            'id',
            assigned.map((a) => a.booking_id),
          )
          .order('check_in')
        bookings = ((rows || []) as Booking[]).map((b) => ({
          ...b,
          my_response: assigned.find((a) => a.booking_id === b.id)?.response,
        }))
      }
    }
  } catch {}

  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Nanny portal</div>
        <h1>
          Your <em>placements</em>
        </h1>
        <p>
          Edit your public profile, complete safeguarding if you are Elite, and message
          families on assigned placements.
        </p>
      </section>
      <div className="sec-inner dash-page">
        <div className="dash-toolbar">
          {nanny?.is_active && (
            <Link href={`/nannies/${nanny.slug}`} className="btn-coral">
              View public profile
            </Link>
          )}
          {nanny && (
            <Link href="/nanny/safeguarding" className="btn-ghost">
              Safeguarding module
            </Link>
          )}
          <SignOutButton />
        </div>
        {!nanny && <ClaimApplication />}
        {!nanny && (
          <div className="form-card">
            <h3>Profile not live yet</h3>
            <p style={{ color: 'rgba(23,50,77,0.55)', marginTop: 8 }}>
              Your application is reviewed first. After approval, read, sign and return
              the agreement sent by email. Your profile will be activated after our team
              reviews the signed copy.
            </p>
            <Link
              href="/become-a-nanny"
              className="btn-primary"
              style={{ marginTop: 16, display: 'inline-block' }}
            >
              Apply now
            </Link>
          </div>
        )}
        {nanny && (
          <>
            {needsSafeguardingModule(nanny) && (
              <div className="form-card">
                <h3>Elite safeguarding required</h3>
                <p style={{ color: 'rgba(23,50,77,0.6)', marginTop: 8, lineHeight: 1.6 }}>
                  Your profile is approved at Gold, but families see you as Pro until you
                  pass the safeguarding module.
                </p>
                <Link
                  href="/nanny/safeguarding"
                  className="btn-coral"
                  style={{ marginTop: 16, display: 'inline-block' }}
                >
                  Complete the module →
                </Link>
              </div>
            )}
            {nanny.is_suspended ? (
              <div className="form-card">
                <h3>Profile suspended</h3>
                <p>Contact VacayNanny for a review before accepting new placements.</p>
              </div>
            ) : (
              <NannyProfileEditor nanny={nanny} destinationCatalog={destinationCatalog} />
            )}
            <NannyEarnings bookings={bookings} />
            <NannyPlacements bookings={bookings} />
          </>
        )}
      </div>
    </PageShell>
  )
}
