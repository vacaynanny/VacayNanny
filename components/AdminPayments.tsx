'use client'
import { useState } from 'react'
import { formatKes } from '@/lib/constants'
import type { Booking } from '@/lib/types'
import type { PaymentAttempt } from '@/lib/paystack'

export default function AdminPayments({
  payments,
  bookings,
}: {
  payments: PaymentAttempt[]
  bookings: Booking[]
}) {
  const [query, setQuery] = useState('')
  const paid = payments
    .filter((p) => p.status === 'success')
    .reduce((sum, p) => sum + p.amount_subunit / 100, 0)
  const refunds = bookings.filter((b) => b.payment_status === 'refund_pending')
  const shown = payments.filter((p) =>
    `${p.reference} ${bookings.find((b) => b.id === p.booking_id)?.parent_name || ''}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <div className="ops-stack">
      <div className="ops-panel">
        <h2>Payments through Paystack</h2>
        <p className="ops-note">
          M-Pesa and card collections. Families pay after accepting a match,
          before care starts.
        </p>
        <p className="payment-total">
          {formatKes(paid)}{' '}
          <small>collected in the latest {payments.length} attempts</small>
        </p>
      </div>
      {refunds.length > 0 && (
        <section className="ops-panel">
          <h3>Refunds to review</h3>
          <p className="ops-note">
            Review these in Paystack. Cancelling a booking does not transfer a
            refund automatically.
          </p>
          {refunds.map((b) => (
            <p key={b.id}>
              {b.parent_name} · {b.destination} ·{' '}
              {formatKes(b.total_amount_kes || 0)}
            </p>
          ))}
        </section>
      )}
      <label className="ops-filters">
        Search payments
        <input
          className="ops-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Family name or payment reference"
        />
      </label>
      {shown.length === 0 && (
        <div className="ops-empty">
          <h3>No payments to show</h3>
          <p>
            Verified transactions will appear here when families use secure
            checkout.
          </p>
        </div>
      )}
      {shown.map((p) => (
        <article className="ops-card" key={p.id}>
          <div className="ops-card-head">
            <div>
              <h3>
                {bookings.find((b) => b.id === p.booking_id)?.parent_name ||
                  'Booking payment'}
              </h3>
              <p>{p.reference}</p>
            </div>
            <span className="ops-pill">{p.status}</span>
          </div>
          <p className="ops-meta">
            {formatKes(p.amount_subunit / 100)} ·{' '}
            {p.channel || 'Awaiting payment'} ·{' '}
            {new Date(p.created_at).toLocaleDateString('en-GB', {
              timeZone: 'Africa/Nairobi',
            })}
          </p>
        </article>
      ))}
    </div>
  )
}
