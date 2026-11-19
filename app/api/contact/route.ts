import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import { getCurrentProfile } from '@/lib/auth'
import { hashGuestToken } from '@/lib/guest-access'
import { careLinkToken, sealWorkflow } from '@/lib/workflow-secrets'
import { SPECIALIST_SERVICES } from '@/lib/care-enquiries'
import { siteUrl } from '@/lib/constants'
import { limitRoute } from '@/lib/rate-limit'
export async function POST(request: NextRequest) {
  try {
    const body = await request.json(),
      name = String(body.name || '').trim(),
      email = String(body.email || '')
        .trim()
        .toLowerCase(),
      subject = String(body.subject || 'Website enquiry').trim(),
      message = String(body.message || '').trim(),
      careService = String(body.careService || '')
    if (
      !name ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !message ||
      name.length > 120 ||
      subject.length > 200 ||
      message.length > 5000
    )
      return NextResponse.json(
        { error: 'Provide a name, valid email and message of up to 5,000 characters.' },
        { status: 400 },
      )
    if (
      careService &&
      !SPECIALIST_SERVICES.includes(careService as (typeof SPECIALIST_SERVICES)[number])
    )
      return NextResponse.json(
        { error: 'Choose a listed specialist care service.' },
        { status: 400 },
      )
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      return NextResponse.json(
        { error: 'Our inbox is temporarily unavailable.' },
        { status: 503 },
      )
    const db = createServerClient(),
      blocked = await limitRoute(request, db, 'contact', { email })
    if (blocked) return blocked
    const id = randomUUID(),
      token = careService ? careLinkToken(id) : null,
      trackingPath = token ? `/care-enquiries/${id}?token=${token}` : null
    const profile = await getCurrentProfile()
    const { error } = await db.rpc('save_contact_enquiry', {
      p_row: {
        id,
        name,
        email,
        subject,
        message,
        care_service: careService || null,
        family_id: profile?.email?.toLowerCase() === email ? profile.id : null,
        guest_access_token_hash: token ? hashGuestToken(token) : null,
      },
      p_notice: trackingPath
        ? sealWorkflow({
            to: email,
            subject: 'Your VacayNanny specialist care enquiry',
            text: `Hi ${name},\n\nWe received your request for ${careService}. Our team will assess the support needed and share a quote.\n\nTrack your enquiry: ${siteUrl(trackingPath)}\n\nKeep this link private.`,
            html: `<p>We received your specialist care enquiry. Our team will assess your needs and share a quote.</p><p><a href="${siteUrl(trackingPath)}">Track your private enquiry</a></p>`,
          })
        : null,
    })
    if (error)
      return NextResponse.json(
        { error: 'Your enquiry could not be saved. Please retry.' },
        { status: 503 },
      )
    return NextResponse.json({ success: true, trackingPath })
  } catch {
    return NextResponse.json(
      { error: 'Could not submit your enquiry. Please retry.' },
      { status: 500 },
    )
  }
}
