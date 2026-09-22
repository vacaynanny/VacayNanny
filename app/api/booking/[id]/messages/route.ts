import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import {
  assertBookingThread,
  jsonFromBookingError,
  loadBooking,
  nannyContact,
  resolveBookingAccess,
} from '@/lib/booking-ops'
import { sendBookingMessageEmail } from '@/lib/email'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import type { BookingMessage, BookingMessageRole } from '@/lib/types'

function senderLabel(role: BookingMessageRole): string {
  switch (role) {
    case 'parent':
      return 'The family'
    case 'nanny':
      return 'Your nanny'
    case 'admin':
      return 'VacayNanny ops'
    default: {
      const _never: never = role
      return _never
    }
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Messaging is not configured yet.' }, { status: 503 })
    }
    const profile = await getCurrentProfile()
    if (!profile) return NextResponse.json({ error: 'Sign in to view this thread.' }, { status: 401 })

    const { id } = await params
    const supabase = createServerClient()
    const booking = await loadBooking(supabase, id)
    const access = await resolveBookingAccess(supabase, profile, booking)
    if (!access.senderRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    assertBookingThread(booking)

    const { data, error } = await supabase
      .from('booking_messages')
      .select('id, booking_id, sender_id, sender_role, body, created_at')
      .eq('booking_id', id)
      .order('created_at', { ascending: true })
      .limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ messages: (data || []) as BookingMessage[] })
  } catch (err) {
    return jsonFromBookingError(err)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Messaging is not configured yet.' }, { status: 503 })
    }
    const profile = await getCurrentProfile()
    if (!profile) return NextResponse.json({ error: 'Sign in to send a message.' }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const text = String(body.body || '').trim()
    if (text.length < 1) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 })
    if (text.length > 2000) return NextResponse.json({ error: 'Message is too long.' }, { status: 400 })

    const supabase = createServerClient()
    const booking = await loadBooking(supabase, id)
    const access = await resolveBookingAccess(supabase, profile, booking)
    const role = access.senderRole
    if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    assertBookingThread(booking)

    const { data, error } = await supabase
      .from('booking_messages')
      .insert([{
        booking_id: id,
        sender_id: profile.id,
        sender_role: role,
        body: text,
      }])
      .select('id, booking_id, sender_id, sender_role, body, created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const preview = text.length > 220 ? `${text.slice(0, 217)}…` : text
    const nanny = await nannyContact(supabase, booking.nanny_id)
    const recipients: Array<{ to: string; name: string; path: '/account' | '/nanny' | '/admin' }> = []
    if (role !== 'parent' && booking.email) {
      recipients.push({ to: booking.email, name: booking.parent_name, path: '/account' })
    }
    if (role !== 'nanny' && nanny.email) {
      recipients.push({ to: nanny.email, name: nanny.name || 'there', path: '/nanny' })
    }

    Promise.all(recipients.map(recipient => sendBookingMessageEmail({
      to: recipient.to,
      recipientName: recipient.name,
      senderLabel: senderLabel(role),
      destination: booking.destination,
      preview,
      inboxPath: recipient.path,
    }))).catch(err => console.error('Booking message notify failed:', err))

    return NextResponse.json({ success: true, message: data as BookingMessage }, { status: 201 })
  } catch (err) {
    return jsonFromBookingError(err)
  }
}
