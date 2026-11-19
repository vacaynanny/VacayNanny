import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/payment-rules'
import { reconcilePayment } from '@/lib/paystack'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return new NextResponse('Payments unavailable', { status: 503 })
  const raw = Buffer.from(await request.arrayBuffer())
  if (
    !verifyWebhook(
      raw,
      request.headers,
      secret,
      process.env.PAYSTACK_WEBHOOK_SECRET,
    )
  )
    return new NextResponse('Invalid signature', { status: 401 })
  try {
    const event = JSON.parse(raw.toString('utf8'))
    if (event.event === 'charge.success') {
      const reference = event.data?.reference
      if (
        typeof reference !== 'string' ||
        !/^VN-[0-9a-f-]{36}$/i.test(reference)
      )
        return NextResponse.json({ received: true })
      // Verify against Paystack independently; a redirect or webhook alone is never proof of payment.
      await reconcilePayment(createServerClient(), reference)
    }
    return NextResponse.json({ received: true })
  } catch {
    // Non-200 asks Paystack to retry if verification or the database was unavailable.
    console.error('Paystack event reconciliation failed')
    return new NextResponse('Please retry', { status: 500 })
  }
}
