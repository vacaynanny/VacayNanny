import 'server-only'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { paymentMatches, kesToSubunits } from '@/lib/payment-rules'
import { siteUrl } from '@/lib/constants'

export type PaymentAttempt = {
  id: string
  booking_id: string
  reference: string
  amount_subunit: number
  currency: string
  status: 'pending' | 'success' | 'failed'
  authorization_url: string | null
  channel: string | null
  paid_at: string | null
  created_at: string
}

async function paystack<T>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key)
    throw new Error(
      'Payments are not configured yet. Please contact VacayNanny.',
    )
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const json = await response.json()
  if (!response.ok || json.status !== true)
    throw new Error(
      'Paystack could not process this request. Please try again shortly.',
    )
  return json.data as T
}

export async function initializePayment(
  supabase: SupabaseClient,
  bookingId: string,
  email: string,
): Promise<PaymentAttempt> {
  // The database locks the booking, snapshots its amount, and reuses a pending attempt.
  const { data, error } = await supabase.rpc('create_booking_payment', {
    p_booking_id: bookingId,
    p_reference: `VN-${randomUUID()}`,
  })
  if (error) throw new Error(error.message)
  const attempt = data as PaymentAttempt & { initialize?: boolean }
  if (!attempt.initialize) {
    const result = await reconcilePayment(supabase, attempt.reference)
    if (result.status === 'success')
      throw new Error(
        'Payment has already been received. Refresh your booking to see the update.',
      )
    if (['failed', 'abandoned', 'reversed'].includes(result.status))
      return initializePayment(supabase, bookingId, email)
    if (attempt.authorization_url) return attempt
    throw new Error(
      'Your checkout is still being prepared. Refresh your booking shortly. If this persists, contact support before paying again.',
    )
  }
  try {
    const initialized = await paystack<{
      authorization_url: string
      reference: string
    }>('/transaction/initialize', {
      email,
      amount: kesToSubunits(attempt.amount_subunit / 100),
      currency: 'KES',
      reference: attempt.reference,
      channels: ['card', 'mobile_money'],
      callback_url: siteUrl(`/payments/return`),
      metadata: JSON.stringify({ booking_id: bookingId }),
    })
    if (
      new URL(initialized.authorization_url).origin !==
      'https://checkout.paystack.com'
    )
      throw new Error('Invalid checkout address.')
    const { error: saveError } = await supabase
      .from('payment_attempts')
      .update({ authorization_url: initialized.authorization_url })
      .eq('id', attempt.id)
    if (saveError)
      throw new Error(
        'Could not save checkout. Please contact support before retrying.',
      )
    return { ...attempt, authorization_url: initialized.authorization_url }
  } catch (error) {
    // Keep ambiguous network outcomes pending. A fresh attempt could otherwise double charge.
    console.error('Payment initialization incomplete', {
      reference: attempt.reference,
    })
    throw error
  }
}

export async function reconcilePayment(
  supabase: SupabaseClient,
  reference: string,
) {
  const { data: row, error } = await supabase
    .from('payment_attempts')
    .select('*')
    .eq('reference', reference)
    .maybeSingle()
  if (error || !row) throw new Error('Payment reference not found.')
  const attempt = row as PaymentAttempt
  if (attempt.status === 'success')
    return { status: 'success' as const, bookingId: attempt.booking_id }
  const transaction = await paystack<{
    reference: string
    amount: number
    currency: string
    status: string
    channel: string
    paid_at: string | null
  }>(`/transaction/verify/${encodeURIComponent(reference)}`)
  if (transaction.status !== 'success') {
    if (['failed', 'abandoned', 'reversed'].includes(transaction.status)) {
      const { error: updateError } = await supabase
        .from('payment_attempts')
        .update({ status: 'failed' })
        .eq('id', attempt.id)
        .eq('status', 'pending')
      if (updateError) throw new Error('Could not update payment status.')
    }
    return { status: transaction.status, bookingId: attempt.booking_id }
  }
  if (!paymentMatches(attempt, transaction))
    throw new Error(
      'Payment verification failed: reference, amount or currency mismatch.',
    )
  const { error: settleError } = await supabase.rpc('settle_booking_payment', {
    p_reference: reference,
    p_amount: transaction.amount,
    p_currency: transaction.currency,
    p_channel: transaction.channel,
    p_paid_at: transaction.paid_at || new Date().toISOString(),
  })
  if (settleError)
    throw new Error(
      'Could not record payment. Your payment will be reconciled; please do not pay again.',
    )
  return { status: 'success' as const, bookingId: attempt.booking_id }
}
