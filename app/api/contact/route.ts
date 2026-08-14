import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import { Resend } from 'resend'
import { ADMIN_EMAIL } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim()
    const subject = String(body.subject || 'Website enquiry').trim()
    const message = String(body.message || '').trim()
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email and message are required.' }, { status: 400 })
    }
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Contact inbox is not configured yet.' }, { status: 503 })
    }
    const supabase = createServerClient()
    const { error } = await supabase.from('contact_messages').insert([{ name, email, subject, message }])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'VacayNanny <noreply@vacaynanny.net>',
        to: ADMIN_EMAIL,
        replyTo: email,
        subject: `[Contact] ${subject} — ${name}`,
        html: `<p><strong>${name}</strong> (${email})</p><p>${message.replace(/\n/g, '<br>')}</p>`,
      }).catch(err => console.error('Contact email failed:', err))
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
