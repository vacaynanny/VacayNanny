import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import { notifyBookingEvent, sendBookingEmails } from '@/lib/email'
import { createSupabaseServer } from '@/lib/supabase/server'
import { careTypeLabel, parseCareType, quoteBooking } from '@/lib/booking'
import { findNannyClashes, jsonFromBookingError, nannyContact } from '@/lib/booking-ops'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parentName = String(body.parentName || body.name || '').trim()
    const email = String(body.email || '').trim()
    const destination = String(body.destination || '').trim()
    const checkIn = String(body.checkIn || '')
    const checkOut = String(body.checkOut || '')
    const phone = String(body.phone || '').trim()
    const childrenCount = String(body.childrenCount || body.children || '')
    const youngestAge = String(body.youngestAge || body.childrenAges || '')
    const nanniesNeeded = String(body.nanniesNeeded || '1')
    const tier = String(body.tier || '')
    const notes = String(body.notes || body.message || '')
    const careType = parseCareType(body.careType)
    const nannyId = body.nannyId && !String(body.nannyId).startsWith('fallback-')
      ? String(body.nannyId)
      : null

    if (!parentName || !email || !destination || !checkIn || !checkOut) {
      return NextResponse.json({ error: 'Name, email, destination and dates are required.' }, { status: 400 })
    }
    if (new Date(checkOut) < new Date(checkIn)) {
      return NextResponse.json({ error: 'Check-out must be on or after check-in.' }, { status: 400 })
    }

    let parentId: string | null = null
    try {
      const authClient = await createSupabaseServer()
      const { data: { user } } = await authClient.auth.getUser()
      parentId = user?.id ?? null
    } catch {}

    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Booking storage is not configured yet.' }, { status: 503 })
    }

    const supabase = createServerClient()

    let dailyRateKes: number | null = null
    let nannyName: string | null = null
    let nannyEmail: string | null = null
    let nannyPhone: string | null = null
    if (nannyId) {
      const { data } = await supabase.from('nannies').select('daily_rate_kes').eq('id', nannyId).maybeSingle()
      dailyRateKes = data?.daily_rate_kes ?? null
      const contact = await nannyContact(supabase, nannyId)
      nannyName = contact.name
      nannyEmail = contact.email
      nannyPhone = contact.phone
      const clashes = await findNannyClashes(supabase, nannyId, checkIn, checkOut)
      if (clashes.length) {
        return NextResponse.json({
          error: 'That nanny is already booked for overlapping dates. Pick different dates or another nanny.',
          clashes,
        }, { status: 409 })
      }
    }

    const quote = quoteBooking({
      checkIn,
      checkOut,
      careType,
      tier: tier || undefined,
      nanniesNeeded,
      dailyRateKes,
    })
    const total = quote.total

    const assigned = Boolean(nannyId)
    const { error } = await supabase.from('bookings').insert([{
      parent_id: parentId,
      nanny_id: nannyId,
      parent_name: parentName,
      email,
      phone,
      destination,
      check_in: checkIn,
      check_out: checkOut,
      children_count: childrenCount || null,
      youngest_age: youngestAge || null,
      nannies_needed: nanniesNeeded,
      tier: tier || null,
      notes: notes || null,
      status: assigned ? 'matched' : 'pending',
      nanny_response: assigned ? 'pending' : null,
      care_type: careType,
      total_amount_kes: total,
    }]).select('id').maybeSingle()

    if (error) {
      console.error('Supabase booking error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (assigned) {
      notifyBookingEvent('matched', {
        parentName,
        parentEmail: email,
        nannyName,
        nannyEmail,
        nannyPhone,
        destination,
        checkIn,
        checkOut,
        careType: careTypeLabel(careType),
        status: 'matched',
        totalKes: total,
        note: 'Family requested this nanny',
      }).catch(err => console.error('notifyBookingEvent matched failed:', err))
    } else {
      sendBookingEmails({
        parentName,
        email,
        phone,
        destination,
        checkIn,
        checkOut,
        childrenAges: [childrenCount, youngestAge].filter(Boolean).join(' · '),
        tier: tier || 'Any',
        message: notes,
      }).catch(err => console.error('sendBookingEmails failed:', err))
    }

    return NextResponse.json({ success: true, total, careType }, { status: 200 })
  } catch (err) {
    return jsonFromBookingError(err)
  }
}
