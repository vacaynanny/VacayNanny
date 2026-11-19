import type { OpsTask, FailedJob } from '@/components/AdminWorkflowTasks'
import { requireProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import AdminClient from './AdminClient'
import { advanceDueBookings } from '@/lib/booking-ops'
import { getAdminCatalog } from '@/lib/catalog-data'
import { loadRegisteredAccounts } from '@/lib/registered-accounts'
import type { PaymentAttempt } from '@/lib/paystack'
import type { SiteCatalog } from '@/lib/catalog'
import type {
  Booking,
  ContactMessage,
  Destination,
  Nanny,
  NannyApplication,
  RegisteredAccount,
  Review,
  WaitlistEntry,
} from '@/lib/types'

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
  let payments: PaymentAttempt[] = []
  let tasks: OpsTask[] = []
  let failedJobs: FailedJob[] = []
  let dataError: string | null = null
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
      supabase
        .from('nanny_applications')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('bookings')
        .select(
          '*,booking_assignments(slot,nanny_id,response,nannies(id,display_name,slug,photo_url,tier))',
        )
        .order('created_at', { ascending: false }),
      supabase.from('nannies').select('*').order('display_name'),
      supabase
        .from('reviews')
        .select('*, nannies(id, display_name, slug)')
        .order('created_at', { ascending: false }),
      supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('waitlist').select('*').order('created_at', { ascending: false }),
      supabase.from('destinations').select('*').order('sort_order').order('name'),
    ])
    applications = (apps || []) as NannyApplication[]
    bookings = (books || []) as Booking[]
    nannies = (nannyRows || []) as Nanny[]
    reviews = ((reviewRows || []) as Review[]).sort(
      (a, b) => Number(a.is_published) - Number(b.is_published),
    )
    contactMessages = (contactRows || []) as ContactMessage[]
    waitlist = (waitlistRows || []) as WaitlistEntry[]
    destinations = (destRows || []) as Destination[]
    const [catalog, registered] = await Promise.all([
      getAdminCatalog(supabase),
      loadRegisteredAccounts(supabase),
    ])
    const [taskRows, jobRows] = await Promise.all([
      supabase
        .from('ops_tasks')
        .select('*')
        .neq('status', 'resolved')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('workflow_jobs')
        .select('id,kind,status,attempts,last_error,created_at')
        .eq('status', 'failed')
        .limit(100),
    ])
    if (taskRows.error || jobRows.error)
      dataError =
        'Workflow follow-ups could not be loaded. Refresh before relying on the queue status.'
    tasks = (taskRows.data || []) as OpsTask[]
    failedJobs = (jobRows.data || []) as FailedJob[]
    adminCatalog = catalog
    accounts = registered
    const paymentRows = await supabase
      .from('payment_attempts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    payments = (paymentRows.data || []) as PaymentAttempt[]
    if (paymentRows.error)
      dataError =
        'Payment records could not be loaded. Check that the payment migration has been applied before collecting payments.'
  } catch {
    dataError =
      'Some records could not be loaded. Refresh the workspace before making changes.'
  }

  return (
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
      payments={payments}
      dataError={dataError}
      tasks={tasks}
      failedJobs={failedJobs}
    />
  )
}
