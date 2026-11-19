import { NextRequest, NextResponse } from 'next/server'
import { requireAdminProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { careLinkToken, sealWorkflow } from '@/lib/workflow-secrets'
import { siteUrl } from '@/lib/constants'
import { escapeHtml } from '@/lib/application-email-templates'
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params,
    body = await request.json().catch(() => ({})),
    changes: Record<string, unknown> = {}
  for (const key of [
    'care_status',
    'assigned_to',
    'assessment_notes',
    'provider_details',
    'quote_summary',
    'quote_amount_kes',
    'quote_expires_at',
    'service_start',
    'service_end',
  ])
    if (Object.hasOwn(body, key)) changes[key] = body[key] || null
  if (
    Object.values(changes).some((v) => typeof v === 'string' && v.length > 5000) ||
    !Number.isInteger(body.version)
  )
    return NextResponse.json({ error: 'Provide valid enquiry details.' }, { status: 400 })
  const db = createServerClient()
  let notice = null
  if (changes.care_status === 'quoted') {
    const { data } = await db
      .from('contact_messages')
      .select('name,email')
      .eq('id', id)
      .single()
    if (!data) return NextResponse.json({ error: 'Enquiry not found.' }, { status: 404 })
    const url = siteUrl(`/care-enquiries/${id}?token=${careLinkToken(id)}`)
    notice = sealWorkflow({
      to: data.email,
      subject: 'Your VacayNanny specialist care quote is ready',
      text: `Hi ${data.name},\n\nYour quote is ready. Review the scope, dates, total and expiry before accepting:\n${url}\n\nKeep this link private.`,
      html: `<p>Your specialist care quote is ready.</p><p><a href="${escapeHtml(url)}">Review and accept your quote</a></p>`,
    })
  }
  const { error } = await db.rpc('update_care_enquiry', {
    p_id: id,
    p_actor: admin.id,
    p_version: body.version,
    p_changes: changes,
    p_notice: notice,
  })
  return error
    ? NextResponse.json({ error: error.message }, { status: 409 })
    : NextResponse.json({ success: true })
}
