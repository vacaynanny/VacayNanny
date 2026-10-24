import { requireProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import PageShell from '@/components/PageShell'
import SignOutButton from '@/components/SignOutButton'
import AdminClient from './AdminClient'
import { advanceDueBookings } from '@/lib/booking-ops'
import { getAdminCatalog } from '@/lib/catalog-data'
import { loadRegisteredAccounts } from '@/lib/registered-accounts'
import type { SiteCatalog } from '@/lib/catalog'
import type { Booking, ContactMessage, Destination, Nanny, NannyApplication, RegisteredAccount, Review, WaitlistEntry } from '@/lib/types'

export const metadata = { title: 'Admin — VacayNanny' }

export default async function AdminPage() {
  const admin = await requireProfile(['admin'])
  let applications: NannyApplication[] = []
  let bookings: Booking[] = []
  let nannies: Nanny[] = []
  let reviews: Review[] = []
  let contactMessages: ContactMessage[] = []
  let waitlist: WaitlistEntry[] = []
  let destinations: Destination[] = []
  let accounts: RegisteredAccount[] = []
  let adminCatalog: SiteCatalog | null = null
  try {
    const supabase = createServerClient()
    await advanceDueBookings(supabase)
    const [
      { data: apps },
      { data: books },
      { data: nannyRows },
      { data: reviewRows },
      { data: contactRows },
      { data: waitlistRows },
      { data: destRows },
    ] = await Promise.all([
      supabase.from('nanny_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('nannies').select('*').order('display_name'),
      supabase.from('reviews').select('*, nannies(id, display_name, slug)').order('created_at', { ascending: false }),
      supabase.from('contact_messages').select('*').order('created_at', { ascending: false }),
      supabase.from('waitlist').select('*').order('created_at', { ascending: false }),
      supabase.from('destinations').select('*').order('sort_order').order('name'),
    ])
    applications = (apps || []) as NannyApplication[]
    bookings = (books || []) as Booking[]
    nannies = (nannyRows || []) as Nanny[]
    reviews = ((reviewRows || []) as Review[]).sort((a, b) => Number(a.is_published) - Number(b.is_published))
    contactMessages = (contactRows || []) as ContactMessage[]
    waitlist = (waitlistRows || []) as WaitlistEntry[]
    destinations = (destRows || []) as Destination[]
    const [catalog, registered] = await Promise.all([
      getAdminCatalog(supabase),
      loadRegisteredAccounts(supabase),
    ])
    adminCatalog = catalog
    accounts = registered
  } catch {}

  return (
    <PageShell>
      <div className="ops">
        <header className="ops-top">
          <div>
            <p className="account-kicker">Ops</p>
            <h1>Admin <em>desk</em></h1>
            <p>Vet applications, match trips, publish nannies, and edit the catalog.</p>
          </div>
          <SignOutButton />
        </header>
        <AdminClient
          applications={applications}
          bookings={bookings}
          nannies={nannies}
          reviews={reviews}
          contactMessages={contactMessages}
          waitlist={waitlist}
          destinations={destinations}
          accounts={accounts}
          adminId={admin.id}
          adminCatalog={adminCatalog}
        />
      </div>
    </PageShell>
  )
}
