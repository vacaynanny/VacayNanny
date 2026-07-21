import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendBookingEmails } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServerClient()

    const { error } = await supabase.from('booking_requests').insert([
      {
        parent_name: body.parentName,
        email: body.email,
        phone: body.phone,
        destination: body.destination,
        check_in: body.checkIn,
        check_out: body.checkOut,
        children_ages: body.childrenAges,
        tier: body.tier,
        message: body.message,
        status: 'pending',
      },
    ])

    if (error) {
      console.error('Supabase booking error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send confirmation to parent + notification to admin
    // Non-blocking — a failed email doesn't fail the booking
    sendBookingEmails({
      parentName: body.parentName,
      email: body.email,
      phone: body.phone,
      destination: body.destination,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      childrenAges: body.childrenAges,
      tier: body.tier,
      message: body.message,
    }).catch(err => console.error('sendBookingEmails failed:', err))

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Booking route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
