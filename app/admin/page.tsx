import { requireProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import PageShell from '@/components/PageShell'
import SignOutButton from '@/components/SignOutButton'
import AdminClient from './AdminClient'
import type { Booking, Nanny, NannyApplication } from '@/lib/types'

export const metadata = { title: 'Admin — VacayNanny' }

export default async function AdminPage() {
  await requireProfile(['admin'])
  let applications: NannyApplication[] = []
  let bookings: Booking[] = []
  let nannies: Nanny[] = []
  try {
    const supabase = createServerClient()
    const [{ data: apps }, { data: books }, { data: nannyRows }] = await Promise.all([
      supabase.from('nanny_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('nannies').select('*').order('display_name'),
    ])
    applications = (apps || []) as NannyApplication[]
    bookings = (books || []) as Booking[]
    nannies = (nannyRows || []) as Nanny[]
  } catch {}

  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Ops</div>
        <h1>Vetting &amp; <em>bookings</em></h1>
        <p>Approve applications to publish live nanny profiles. Match pending family requests.</p>
      </section>
      <div className="sec-inner" style={{ paddingBottom: 8 }}>
        <SignOutButton />
      </div>
      <AdminClient applications={applications} bookings={bookings} nannies={nannies} />
    </PageShell>
  )
}
