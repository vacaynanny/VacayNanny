import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import { sendBookingEmails } from '@/lib/email'
import { createSupabaseServer } from '@/lib/supabase/server'
import { TIER_RATES, normalizeTier } from '@/lib/constants'

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

    const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000) || 1)
    const rate = TIER_RATES[normalizeTier(tier) || 'bronze']
    const total = rate * nights

    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Booking storage is not configured yet.' }, { status: 503 })
    }

    const supabase = createServerClient()
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
      status: 'pending',
      total_amount_kes: total,
    }])

    if (error) {
      console.error('Supabase booking error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

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

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Booking route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
