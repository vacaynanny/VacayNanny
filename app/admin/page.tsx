import { requireProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import PageShell from '@/components/PageShell'
import SignOutButton from '@/components/SignOutButton'
import AdminClient from './AdminClient'
import type { Booking, Nanny, NannyApplication, Review } from '@/lib/types'

export const metadata = { title: 'Admin — VacayNanny' }

export default async function AdminPage() {
  await requireProfile(['admin'])
  let applications: NannyApplication[] = []
  let bookings: Booking[] = []
  let nannies: Nanny[] = []
  let reviews: Review[] = []
  try {
    const supabase = createServerClient()
    const [{ data: apps }, { data: books }, { data: nannyRows }, { data: reviewRows }] = await Promise.all([
      supabase.from('nanny_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('nannies').select('*').order('display_name'),
      supabase.from('reviews').select('*, nannies(id, display_name, slug)').order('created_at', { ascending: false }),
    ])
    applications = (apps || []) as NannyApplication[]
    bookings = (books || []) as Booking[]
    nannies = (nannyRows || []) as Nanny[]
    reviews = ((reviewRows || []) as Review[]).sort((a, b) => Number(a.is_published) - Number(b.is_published))
  } catch {}

  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Ops</div>
        <h1>Vetting &amp; <em>bookings</em></h1>
        <p>Approve applications, match families, check clashes, run the 2-hour replacement clock, and publish family reviews.</p>
      </section>
      <div className="sec-inner" style={{ paddingBottom: 8 }}>
        <SignOutButton />
      </div>
      <AdminClient applications={applications} bookings={bookings} nannies={nannies} reviews={reviews} />
    </PageShell>
  )
}
