import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { jsonFromBookingError, loadBooking } from '@/lib/booking-ops'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Reviews are not configured yet.' }, { status: 503 })
    }
    const profile = await getCurrentProfile()
    if (!profile) return NextResponse.json({ error: 'Sign in to leave a review.' }, { status: 401 })

    const body = await request.json()
    const bookingId = String(body.bookingId || '').trim()
    const rating = Number(body.rating)
    const text = String(body.body || '').trim()

    if (!bookingId) return NextResponse.json({ error: 'Booking is required.' }, { status: 400 })
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Choose a rating from 1 to 5 stars.' }, { status: 400 })
    }
    if (text.length < 10) {
      return NextResponse.json({ error: 'Please write at least a short comment (10 characters).' }, { status: 400 })
    }
    if (text.length > 2000) {
      return NextResponse.json({ error: 'Review is too long.' }, { status: 400 })
    }

    const supabase = createServerClient()
    const booking = await loadBooking(supabase, bookingId)

    const isParent =
      booking.parent_id === profile.id ||
      Boolean(profile.email && booking.email.toLowerCase() === profile.email.toLowerCase())
    if (!isParent && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (booking.status !== 'completed') {
      return NextResponse.json({ error: 'You can review after the booking is completed.' }, { status: 400 })
    }
    if (!booking.nanny_id) {
      return NextResponse.json({ error: 'This booking has no nanny to review.' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'You already reviewed this booking.' }, { status: 409 })
    }

    const { data: review, error } = await supabase
      .from('reviews')
      .insert([{
        booking_id: bookingId,
        nanny_id: booking.nanny_id,
        parent_name: (profile.full_name || booking.parent_name || 'A family').trim(),
        trip_label: [booking.destination, booking.check_in].filter(Boolean).join(' · '),
        rating,
        body: text,
        is_published: false,
      }])
      .select('id, booking_id, nanny_id, parent_name, trip_label, rating, body, is_published, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You already reviewed this booking.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, review }, { status: 201 })
  } catch (err) {
    return jsonFromBookingError(err)
  }
}
