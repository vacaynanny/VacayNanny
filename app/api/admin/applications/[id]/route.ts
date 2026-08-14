import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createSupabaseServer } from '@/lib/supabase/server'
import { slugify, TIER_RATES } from '@/lib/constants'
import type { ApplicationStatus, NannyTier } from '@/lib/types'

async function requireAdmin() {
  const auth = await createSupabaseServer()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return null
  const { data: profile } = await auth.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return null
  return user
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const status = body.status as ApplicationStatus | undefined
  const adminNotes = body.adminNotes as string | undefined
  const supabase = createServerClient()

  const { data: app, error: fetchErr } = await supabase
    .from('nanny_applications')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr || !app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (adminNotes !== undefined) updates.admin_notes = adminNotes

  const { error: updErr } = await supabase.from('nanny_applications').update(updates).eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  if (status === 'approved') {
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

  return NextResponse.json({ success: true })
}
