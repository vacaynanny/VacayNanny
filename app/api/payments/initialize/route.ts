import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile, profileOwnsBooking } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { loadBooking } from '@/lib/booking-ops'
import { validGuestToken } from '@/lib/guest-access'
import { initializePayment } from '@/lib/paystack'
import { limitRoute } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  if (!process.env.PAYSTACK_SECRET_KEY)
    return NextResponse.json(
      { error: 'Online payments are being set up. Please contact VacayNanny.' },
      { status: 503 },
    )
  try {
    const body = await request.json()
    if (
      typeof body.bookingId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(body.bookingId)
    )
      return NextResponse.json(
        { error: 'Choose a valid booking.' },
        { status: 400 },
      )
    const supabase = createServerClient()
    const blocked = await limitRoute(request, supabase, 'payment')
    if (blocked) return blocked
    const booking = await loadBooking(supabase, body.bookingId)
    const profile = await getCurrentProfile()
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
    if (
      !(profile && profileOwnsBooking(profile, booking)) &&
      !validGuestToken(token, booking.guest_access_token_hash)
    )
      return NextResponse.json(
        { error: 'Sign in or use your secure booking link.' },
        { status: 403 },
      )
    const attempt = await initializePayment(supabase, booking.id, booking.email)
    return NextResponse.json({
      authorizationUrl: attempt.authorization_url,
      reference: attempt.reference,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not start payment.'
    console.error('Payment checkout unavailable')
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
