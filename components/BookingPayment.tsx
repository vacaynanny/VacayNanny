'use client'
import { useState } from 'react'
import { formatKes } from '@/lib/constants'
import type { Booking } from '@/lib/types'

export default function BookingPayment({
  booking,
  token,
}: {
  booking: Booking
  token?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (booking.payment_status === 'not_required' || !booking.payment_status)
    return null
  if (booking.payment_status === 'paid')
    return (
      <p className="payment-paid">
        ✓ Paid securely to VacayNanny
        {booking.paid_at
          ? ` · ${new Date(booking.paid_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi' })}`
          : ''}
      </p>
    )
  if (booking.payment_status === 'refund_pending')
    return (
      <p className="payment-notice">
        Your payment is recorded. A refund needs review by our team.
      </p>
    )
  if (booking.payment_status === 'refunded')
    return <p className="payment-paid">Refund recorded.</p>
  if (booking.status === 'cancelled' || booking.status === 'completed')
    return null
  const eligible =
    booking.status === 'confirmed' &&
    Boolean(booking.parent_confirmed_at) &&
    booking.nanny_response === 'accepted'
  async function pay() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ bookingId: booking.id }),
      })
      const json = await response.json()
      if (!response.ok)
        throw new Error(json.error || 'Could not open checkout.')
      const url = new URL(json.authorizationUrl)
      if (url.origin !== 'https://checkout.paystack.com')
        throw new Error('Invalid checkout address.')
      try {
        sessionStorage.setItem(
          'vacaynanny:booking-return',
          token ? `/booking/${booking.id}?token=${token}` : '/account',
        )
      } catch {
        /* The confirmation email also contains the guest link. */
      }
      try {
        sessionStorage.setItem(
          'vacaynanny:booking-return',
          token ? `/booking/${booking.id}?token=${token}` : '/account',
        )
      } catch {
        /* The guest confirmation email also contains the secure link. */
      }
      window.location.assign(url.href)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Payment unavailable.')
      setBusy(false)
    }
  }
  return (
    <section className="payment-box" aria-label="Booking payment">
      <div>
        <strong>
          {eligible
            ? 'Your match is accepted. Next, payment.'
            : 'Payment comes after your match.'}
        </strong>
        <p>
          {eligible
            ? 'Please complete payment before care starts.'
            : 'Review and accept your nanny match first. Both you and your nanny need to accept before checkout opens.'}
        </p>
      </div>
      <p className="payment-methods">
        M-Pesa · Visa · Mastercard <span>Secure checkout by Paystack</span>
      </p>
      {eligible && (
        <button className="btn-coral" onClick={pay} disabled={busy}>
          {busy
            ? 'Opening secure checkout…'
            : `Pay ${formatKes(booking.total_amount_kes || 0)}`}
        </button>
      )}
      {error && (
        <p role="alert" className="field-error-msg">
          {error}
        </p>
      )}
    </section>
  )
}
