import { notFound } from 'next/navigation'
import PageShell from '@/components/PageShell'
import CareEnquiryView from '@/components/CareEnquiryView'
import { getCurrentProfile, profileOwnsBooking } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { validGuestToken } from '@/lib/guest-access'
import { familyCareEnquiry, type CareEnquiry } from '@/lib/care-enquiries'
export const metadata = {
  title: 'Your specialist care enquiry — VacayNanny',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const [{ id }, { token }, profile] = await Promise.all([
    params,
    searchParams,
    getCurrentProfile(),
  ])
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { data } = await createServerClient()
    .from('contact_messages')
    .select('*')
    .eq('id', id)
    .not('care_service', 'is', null)
    .maybeSingle()
  if (!data) notFound()
  const enquiry = data as CareEnquiry
  const owns =
    profile &&
    profileOwnsBooking(profile, {
      parent_id: enquiry.family_id || null,
      email: enquiry.email,
    })
  if (!owns && !validGuestToken(token, enquiry.guest_access_token_hash)) notFound()
  return (
    <PageShell>
      <div className="sec-inner care-enquiry-page">
        <p className="account-kicker">Specialist care</p>
        <h1>Your care, thoughtfully arranged.</h1>
        <p className="care-enquiry-intro">
          Review your care plan and quote here. Our team will coordinate the details with
          you.
        </p>
        <CareEnquiryView enquiry={familyCareEnquiry(enquiry)} token={token} />
      </div>
    </PageShell>
  )
}
