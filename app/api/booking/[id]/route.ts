import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import { applyBookingMutation, jsonFromBookingError, loadBooking } from '@/lib/booking-ops'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Booking storage is not configured yet.' }, { status: 503 })
    }
    const profile = await getCurrentProfile()
    if (!profile) return NextResponse.json({ error: 'Sign in to manage this booking.' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const supabase = createServerClient()
    const booking = await loadBooking(supabase, id)

    const isParent =
      booking.parent_id === profile.id ||
      (profile.email && booking.email.toLowerCase() === profile.email.toLowerCase())
    const { data: nannyRow } = await supabase
      .from('nannies')
      .select('id')
      .eq('user_id', profile.id)
      .maybeSingle()
    const isAssignedNanny = Boolean(nannyRow && booking.nanny_id === nannyRow.id)
    const isAdmin = profile.role === 'admin'

    const action = String(body.action || '')
    if (action === 'confirm' || action === 'cancel' || action === 'reschedule') {
      if (!isParent && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    } else if (action === 'accept' || action === 'decline') {
      if (!isAssignedNanny && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    } else {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }

    if (action === 'confirm') {
      const result = await applyBookingMutation(supabase, id, { action: 'confirm' })
      return NextResponse.json({ success: true, booking: result.booking, event: result.event })
    }
    if (action === 'cancel') {
      const result = await applyBookingMutation(supabase, id, { action: 'cancel', reason: body.reason })
      return NextResponse.json({ success: true, booking: result.booking, event: result.event })
    }
    if (action === 'reschedule') {
      const result = await applyBookingMutation(supabase, id, {
        action: 'reschedule',
        checkIn: String(body.checkIn || ''),
        checkOut: String(body.checkOut || ''),
      })
      return NextResponse.json({ success: true, booking: result.booking, event: result.event })
    }
    if (action === 'accept') {
      const result = await applyBookingMutation(supabase, id, { action: 'accept' })
      return NextResponse.json({ success: true, booking: result.booking, event: result.event })
    }
    const result = await applyBookingMutation(supabase, id, { action: 'decline', reason: body.reason })
    return NextResponse.json({ success: true, booking: result.booking, event: result.event })
  } catch (err) {
    return jsonFromBookingError(err)
  }
}
