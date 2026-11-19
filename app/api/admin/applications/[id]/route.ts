import { NextRequest, NextResponse } from 'next/server'
import { requireAdminProfile } from '@/lib/auth'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import { loadNannyAgreement } from '@/lib/nanny-agreement'
import { publishApprovedApplication } from '@/lib/publish-nanny'
import { fromNairobiDatetimeLocal, sortDocuments } from '@/lib/application-docs'
import type {
  ApplicationStatus,
  NannyApplication,
  NannyDocument,
  NannyReference,
} from '@/lib/types'

const APP_STATUSES: ApplicationStatus[] = [
  'pending',
  'reviewing',
  'interview',
  'approved',
  'rejected',
]

function parseStatus(raw: unknown): ApplicationStatus | undefined {
  if (typeof raw !== 'string') return undefined
  return APP_STATUSES.find((s) => s === raw)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Applications are not configured yet.' },
      { status: 503 },
    )
  }

  const { id } = await params
  const supabase = createServerClient()
  const { data: app, error } = await supabase
    .from('nanny_applications')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  const [{ data: refs }, { data: docs }] = await Promise.all([
    supabase
      .from('nanny_references')
      .select('*')
      .eq('application_id', id)
      .order('sort_order'),
    supabase.from('nanny_documents').select('*').eq('application_id', id),
  ])

  return NextResponse.json({
    application: app as NannyApplication,
    references: (refs || []) as NannyReference[],
    documents: sortDocuments((docs || []) as NannyDocument[]),
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Applications are not configured yet.' },
      { status: 503 },
    )
  }

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as {
    status?: unknown
    publish?: unknown
    adminNotes?: unknown
    interviewAt?: unknown
    notifyInterview?: unknown
    vettingChecks?: unknown
    estimatedTier?: unknown
  }
  const status = parseStatus(body.status)
  const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes : undefined
  const interviewProvided = Object.prototype.hasOwnProperty.call(body, 'interviewAt')
  const interviewAt = interviewProvided
    ? typeof body.interviewAt === 'string'
      ? fromNairobiDatetimeLocal(body.interviewAt)
      : null
    : undefined
  const notifyInterview = body.notifyInterview === true

  const supabase = createServerClient()

  const { data: app, error: fetchErr } = await supabase
    .from('nanny_applications')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr || !app)
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  if (body.publish === true) {
    const result = await publishApprovedApplication(supabase, app as NannyApplication)
    if (!result.ok)
      return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, slug: result.slug })
  }
  if (
    status === 'approved' &&
    (!app.approval_email_sent_at || app.status !== 'approved')
  ) {
    try {
      await loadNannyAgreement()
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Agreement unavailable.' },
        { status: 503 },
      )
    }
  }

  const previousStatus = app.status as ApplicationStatus
  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (adminNotes !== undefined) updates.admin_notes = adminNotes
  if (interviewProvided) {
    updates.interview_at = interviewAt
    if (
      interviewAt &&
      !status &&
      previousStatus !== 'approved' &&
      previousStatus !== 'rejected'
    ) {
      updates.status = 'interview'
    }
  }

  if (Object.keys(updates).length === 0 && !body.vettingChecks && !body.estimatedTier) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  if (
    body.vettingChecks &&
    typeof body.vettingChecks === 'object' &&
    !Array.isArray(body.vettingChecks)
  )
    updates.vetting_checks = body.vettingChecks
  if (['bronze', 'silver', 'gold'].includes(String(body.estimatedTier)))
    updates.estimated_tier = body.estimatedTier
  const { error: updErr } = await supabase.rpc('review_nanny_application', {
    p_id: id,
    p_actor: admin.id,
    p_changes: updates,
    p_notify_interview: notifyInterview,
  })
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 409 })

  return NextResponse.json({ success: true })
}
