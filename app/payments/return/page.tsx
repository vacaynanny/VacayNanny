import PageShell from '@/components/PageShell'
import Link from 'next/link'
import PaymentReturnLink from '@/components/PaymentReturnLink'
import { reconcilePayment } from '@/lib/paystack'
import { createServerClient } from '@/lib/supabase'

export const metadata = {
  title: 'Payment update — VacayNanny',
  robots: { index: false, follow: false },
}
export default async function PaymentReturn({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>
}) {
  const { reference } = await searchParams
  let status = 'pending'
  if (reference && /^VN-[0-9a-f-]{36}$/i.test(reference)) {
    try {
      status = (await reconcilePayment(createServerClient(), reference)).status
    } catch {
      status = 'pending'
    }
  }
  return (
    <PageShell>
      <article className="contact-page">
        <p className="account-kicker">Your payment</p>
        <h1>
          {status === 'success'
            ? 'Thank you. Payment received.'
            : 'Let’s check your payment.'}
        </h1>
        <p>
          {status === 'success'
            ? 'Your payment has been securely recorded with VacayNanny.'
            : 'Your payment is not confirmed yet. Return to your booking for the latest status. If money was deducted, please contact us before trying again.'}
        </p>
        <div className="booking-actions">
          <PaymentReturnLink />
          <Link href="/contact" className="btn-ghost">
            Contact support
          </Link>
        </div>
        <p className="modal-hint">
          Booked as a guest? Use the secure booking link in your confirmation
          email.
        </p>
      </article>
    </PageShell>
  )
}
