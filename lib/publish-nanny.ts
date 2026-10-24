import type { SupabaseClient } from '@supabase/supabase-js'
import { tierDailyRate } from '@/lib/catalog-data'
import { slugify } from '@/lib/constants'
import type { NannyApplication, NannyTier } from '@/lib/types'

type PublishResult =
  | { ok: true; slug: string; fullName: string; email: string | null; tier: NannyTier; fresh: boolean }
  | { ok: false; status: number; error: string }

async function uniqueSlug(supabase: SupabaseClient, name: string) {
  const base = slugify(name) || 'nanny'
  let slug = base
  for (let i = 2; i < 40; i += 1) {
    const { data } = await supabase.from('nannies').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
    slug = `${base}-${i}`
  }
  return `${base}-${Date.now()}`
}

function asTier(value: unknown): NannyTier {
  if (value === 'bronze' || value === 'silver' || value === 'gold') return value
  return 'bronze'
}

async function insertFromApplication(supabase: SupabaseClient, app: NannyApplication) {
  const slug = await uniqueSlug(supabase, app.full_name)
  const { data: photoDoc } = await supabase
    .from('nanny_documents')
    .select('storage_path')
    .eq('application_id', app.id)
    .eq('kind', 'photo')
    .maybeSingle()
  let photoUrl: string | null = null
  if (photoDoc?.storage_path?.startsWith('nanny-photos/')) {
    const path = String(photoDoc.storage_path).replace('nanny-photos/', '')
    photoUrl = supabase.storage.from('nanny-photos').getPublicUrl(path).data.publicUrl
  }
  const tier = asTier(app.estimated_tier)
  const { error } = await supabase.from('nannies').insert([{
    user_id: app.user_id,
    application_id: app.id,
    slug,
    display_name: app.full_name,
    photo_url: photoUrl,
    bio: app.bio,
    tier,
    daily_rate_kes: await tierDailyRate(supabase, tier),
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
  if (error) return { ok: false as const, status: 500, error: error.message }
  return { ok: true as const, slug, tier }
}

export async function approveNannyAccount(supabase: SupabaseClient, userId: string): Promise<PublishResult> {
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId)
  if (authError || !authData.user) return { ok: false, status: 404, error: 'That account does not exist.' }

  const metadata = authData.user.user_metadata as { full_name?: unknown } | undefined
  const email = authData.user.email ?? null
  const fallbackName = String(metadata?.full_name || '').trim() || (email ? email.split('@')[0] : 'Nanny')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', userId)
    .maybeSingle()
  const fullName = String(profile?.full_name || '').trim() || fallbackName
  if (!profile) {
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      full_name: fullName.slice(0, 80),
      email,
      role: 'nanny',
    })
    if (error) return { ok: false, status: 500, error: error.message }
  } else {
    const { error } = await supabase.from('profiles').update({ role: 'nanny' }).eq('id', userId)
    if (error) return { ok: false, status: 500, error: error.message }
  }

  const { data: existing } = await supabase
    .from('nannies')
    .select('id, slug, is_active')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing?.slug) {
    if (!existing.is_active) {
      const { error } = await supabase.from('nannies').update({ is_active: true }).eq('id', existing.id)
      if (error) return { ok: false, status: 500, error: error.message }
    }
    return { ok: true, slug: existing.slug, fullName, email, tier: 'bronze', fresh: !existing.is_active }
  }

  const { data: applications, error: appError } = await supabase
    .from('nanny_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (appError) return { ok: false, status: 500, error: appError.message }
  const application = (applications?.[0] || null) as NannyApplication | null

  if (application) {
    if (application.status !== 'approved') {
      const { error } = await supabase.from('nanny_applications').update({ status: 'approved' }).eq('id', application.id)
      if (error) return { ok: false, status: 500, error: error.message }
    }
    const { data: linked } = await supabase.from('nannies').select('id, slug').eq('application_id', application.id).maybeSingle()
    if (linked?.slug) return { ok: true, slug: linked.slug, fullName: application.full_name, email: application.email, tier: asTier(application.estimated_tier), fresh: false }
    const inserted = await insertFromApplication(supabase, { ...application, user_id: userId, status: 'approved' })
    if (!inserted.ok) return inserted
    return { ok: true, slug: inserted.slug, fullName: application.full_name, email: application.email, tier: inserted.tier, fresh: true }
  }

  const slug = await uniqueSlug(supabase, fullName)
  const tier: NannyTier = 'bronze'
  const { error } = await supabase.from('nannies').insert([{
    user_id: userId,
    slug,
    display_name: fullName,
    tier,
    daily_rate_kes: await tierDailyRate(supabase, tier),
    is_active: true,
  }])
  if (error) return { ok: false, status: 500, error: error.message }
  return { ok: true, slug, fullName, email, tier, fresh: true }
}
