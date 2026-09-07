import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { applyBookingMutation, jsonFromBookingError } from '@/lib/booking-ops'
import type { BookingStatus } from '@/lib/types'

const STATUSES: BookingStatus[] = ['pending', 'matched', 'confirmed', 'in_progress', 'completed', 'cancelled']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getCurrentProfile()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const body = await request.json()
    const supabase = createServerClient()

    const action = String(body.action || '')
    if (action === 'replace') {
      const result = await applyBookingMutation(supabase, id, { action: 'replace', reason: body.reason })
      return NextResponse.json({ success: true, booking: result.booking, event: result.event })
    }
    if (action === 'refund_replacement') {
      const result = await applyBookingMutation(supabase, id, { action: 'refund_replacement' })
      return NextResponse.json({ success: true, booking: result.booking, event: result.event })
    }
    if (action === 'assign' || body.nannyId !== undefined) {
      const nannyId = body.nannyId ? String(body.nannyId) : null
      const result = await applyBookingMutation(supabase, id, {
        action: 'assign',
        nannyId,
        force: Boolean(body.force),
      })
      return NextResponse.json({ success: true, booking: result.booking, event: result.event })
    }
    if (action === 'set_status' || body.status) {
      const status = body.status as BookingStatus
      if (!STATUSES.includes(status)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
      }
      const result = await applyBookingMutation(supabase, id, { action: 'set_status', status })
      return NextResponse.json({ success: true, booking: result.booking, event: result.event })
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    return jsonFromBookingError(err)
  }
}
