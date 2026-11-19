import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile, profileOwnsBooking } from '@/lib/auth'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import {
  applyBookingMutation,
  jsonFromBookingError,
  loadBooking,
} from '@/lib/booking-ops'
import { hashGuestToken, validGuestToken } from '@/lib/guest-access'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Booking storage is not configured yet.' },
        { status: 503 },
      )
    }
    const profile = await getCurrentProfile()

    const { id } = await params
    const body = await request.json()
    const supabase = createServerClient()
    const booking = await loadBooking(supabase, id)

    const guestToken = request.headers.get('authorization')?.replace(/^Bearer /, '')
    const guest = validGuestToken(guestToken, booking.guest_access_token_hash)
    if (!profile && !guest)
      return NextResponse.json(
        { error: 'Use your secure booking link or sign in.' },
        { status: 401 },
      )
    const isParent = guest || Boolean(profile && profileOwnsBooking(profile, booking))
    const { data: nannyRow } = profile
      ? await supabase
          .from('nannies')
          .select('id')
          .eq('user_id', profile.id)
          .maybeSingle()
      : { data: null }
    const isAssignedNanny = Boolean(
      nannyRow &&
        (booking.nanny_id === nannyRow.id ||
          booking.booking_assignments?.some((a) => a.nanny_id === nannyRow.id)),
    )
    const isAdmin = profile?.role === 'admin'

    const action = String(body.action || '')
    if (action === 'confirm' || action === 'cancel' || action === 'reschedule') {
      if (!isParent && !isAdmin)
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    } else if (action === 'accept' || action === 'decline') {
      if (!isAssignedNanny && !isAdmin)
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    } else {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }

    const actor = {
      id: profile?.id || null,
      verifiedEmail: profile?.emailConfirmed ? profile.email : null,
      guestHash: guest && guestToken ? hashGuestToken(guestToken) : null,
    }
    if (action === 'confirm') {
      const result = await applyBookingMutation(
        supabase,
        id,
        { action: 'confirm' },
        actor,
      )
      return NextResponse.json({
        success: true,
        booking: result.booking,
        event: result.event,
      })
    }
    if (action === 'cancel') {
      const result = await applyBookingMutation(
        supabase,
        id,
        { action: 'cancel', reason: body.reason },
        actor,
      )
      return NextResponse.json({
        success: true,
        booking: result.booking,
        event: result.event,
      })
    }
    if (action === 'reschedule') {
      const result = await applyBookingMutation(
        supabase,
        id,
        {
          action: 'reschedule',
          checkIn: String(body.checkIn || ''),
          checkOut: String(body.checkOut || ''),
        },
        actor,
      )
      return NextResponse.json({
        success: true,
        booking: result.booking,
        event: result.event,
      })
    }
    if (action === 'accept') {
      const result = await applyBookingMutation(supabase, id, { action: 'accept' }, actor)
      return NextResponse.json({
        success: true,
        booking: result.booking,
        event: result.event,
      })
    }
    const result = await applyBookingMutation(
      supabase,
      id,
      { action: 'decline', reason: body.reason },
      actor,
    )
    return NextResponse.json({
      success: true,
      booking: result.booking,
      event: result.event,
    })
  } catch (err) {
    return jsonFromBookingError(err)
  }
}
