import { NextRequest, NextResponse } from 'next/server'
import { requireAdminProfile } from '@/lib/auth'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import { slugify, TIER_RATES } from '@/lib/constants'
import { sendApplicationStatusEmail, sendInterviewInviteEmail } from '@/lib/email'
import {
  formatNairobiInterview,
  fromNairobiDatetimeLocal,
  sortDocuments,
} from '@/lib/application-docs'
import type { ApplicationStatus, NannyApplication, NannyDocument, NannyReference, NannyTier } from '@/lib/types'

const APP_STATUSES: ApplicationStatus[] = ['pending', 'reviewing', 'interview', 'approved', 'rejected']

function parseStatus(raw: unknown): ApplicationStatus | undefined {
  if (typeof raw !== 'string') return undefined
  return APP_STATUSES.find(s => s === raw)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Applications are not configured yet.' }, { status: 503 })
  }

  const { id } = await params
  const supabase = createServerClient()
  const { data: app, error } = await supabase.from('nanny_applications').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  const [{ data: refs }, { data: docs }] = await Promise.all([
    supabase.from('nanny_references').select('*').eq('application_id', id).order('sort_order'),
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
    return NextResponse.json({ error: 'Applications are not configured yet.' }, { status: 503 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({})) as {
    status?: unknown
    adminNotes?: unknown
    interviewAt?: unknown
    notifyInterview?: unknown
  }
  const status = parseStatus(body.status)
  const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes : undefined
  const interviewProvided = Object.prototype.hasOwnProperty.call(body, 'interviewAt')
  const interviewAt = interviewProvided
    ? (typeof body.interviewAt === 'string' ? fromNairobiDatetimeLocal(body.interviewAt) : null)
    : undefined
  const notifyInterview = body.notifyInterview === true

  const supabase = createServerClient()

  const { data: app, error: fetchErr } = await supabase
    .from('nanny_applications')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr || !app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  const previousStatus = app.status as ApplicationStatus
  const previousInterview = (app as { interview_at?: string | null }).interview_at ?? null
  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (adminNotes !== undefined) updates.admin_notes = adminNotes
  if (interviewProvided) {
    updates.interview_at = interviewAt
    if (interviewAt && !status && previousStatus !== 'approved' && previousStatus !== 'rejected') {
      updates.status = 'interview'
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const { error: updErr } = await supabase.from('nanny_applications').update(updates).eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  const nextStatus = (updates.status as ApplicationStatus | undefined) || previousStatus

  if (nextStatus === 'approved') {
    const { data: existing } = await supabase.from('nannies').select('id').eq('application_id', id).maybeSingle()
    if (!existing) {
      const base = slugify(app.full_name) || 'nanny'
      let slug = base
      for (let i = 2; i < 20; i++) {
        const { data: clash } = await supabase.from('nannies').select('id').eq('slug', slug).maybeSingle()
        if (!clash) break
        slug = `${base}-${i}`
      }
      const { data: photoDoc } = await supabase
        .from('nanny_documents')
        .select('storage_path')
        .eq('application_id', id)
        .eq('kind', 'photo')
        .maybeSingle()
      let photoUrl: string | null = null
      if (photoDoc?.storage_path?.startsWith('nanny-photos/')) {
        const path = photoDoc.storage_path.replace('nanny-photos/', '')
        const { data } = supabase.storage.from('nanny-photos').getPublicUrl(path)
        photoUrl = data.publicUrl
      }
      const tier = (app.estimated_tier || 'bronze') as NannyTier
      const { error: nannyErr } = await supabase.from('nannies').insert([{
        user_id: app.user_id,
        application_id: id,
        slug,
        display_name: app.full_name,
        photo_url: photoUrl,
        bio: app.bio,
        tier,
        daily_rate_kes: TIER_RATES[tier],
        county: app.county,
        town: app.town,
        destinations: app.preferred_locations?.length ? app.preferred_locations : [app.town].filter(Boolean),
        languages: app.languages || [],
        age_groups: app.age_groups || [],
        services: app.services || [],
        certifications: app.certifications || [],
        tags: [...(app.certifications || []), ...(app.languages || [])].slice(0, 6),
        available_days: app.available_days || [],
        willing_to_travel: app.willing_to_travel,
        is_active: true,
      }])
      if (nannyErr) return NextResponse.json({ error: nannyErr.message }, { status: 500 })

      if (app.user_id) {
        await supabase.from('profiles').update({ role: 'nanny' }).eq('id', app.user_id)
      }
    }
  }

  const notesForMail = adminNotes !== undefined ? adminNotes : app.admin_notes
  if (nextStatus !== previousStatus && (nextStatus === 'approved' || nextStatus === 'rejected')) {
    let slug: string | null = null
    if (nextStatus === 'approved') {
      const { data: live } = await supabase.from('nannies').select('slug').eq('application_id', id).maybeSingle()
      slug = live?.slug ?? null
    }
    sendApplicationStatusEmail({
      fullName: app.full_name,
      email: app.email,
      status: nextStatus,
      slug,
      notes: typeof notesForMail === 'string' ? notesForMail : null,
    }).catch(err => console.error('sendApplicationStatusEmail failed:', err))
  }

  const nextInterview = interviewProvided ? interviewAt : previousInterview
  if (notifyInterview && nextInterview) {
    sendInterviewInviteEmail({
      fullName: app.full_name,
      email: app.email,
      whenLabel: formatNairobiInterview(nextInterview),
      notes: typeof notesForMail === 'string' ? notesForMail : null,
    }).catch(err => console.error('sendInterviewInviteEmail failed:', err))
  }

  return NextResponse.json({ success: true })
}
