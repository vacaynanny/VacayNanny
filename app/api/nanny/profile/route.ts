import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { DAYS_OF_WEEK } from '@/lib/constants'
import { destinationNames, fallbackDestinationNames } from '@/lib/destinations'
import { uploadPublicPhoto, validateProfileImage } from '@/lib/profile-media'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import type { Nanny } from '@/lib/types'

const DAY_SET = new Set<string>(DAYS_OF_WEEK)

function parseStringList(raw: unknown, allowed: Set<string>, extraAllowed: string[] = []) {
  const extras = new Set(extraAllowed)
  let values: unknown[] = []
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) values = parsed
    } catch {
      values = raw.split(',')
    }
  } else if (Array.isArray(raw)) {
    values = raw
  }
  const unique: string[] = []
  for (const item of values) {
    const value = String(item || '').trim()
    if (!value || unique.includes(value)) continue
    if (allowed.has(value) || extras.has(value)) unique.push(value)
  }
  return unique
}

export async function PATCH(request: NextRequest) {
  try {
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Profile storage is not configured yet.' }, { status: 503 })
    }
    const profile = await getCurrentProfile()
    if (!profile) return NextResponse.json({ error: 'Sign in to edit your profile.' }, { status: 401 })
    if (profile.role !== 'nanny' && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const form = await request.formData()
    const bio = String(form.get('bio') || '').trim()
    const isActive = String(form.get('isActive') || 'true') !== 'false'
    const removePhoto = String(form.get('removePhoto') || '') === 'true'
    const photo = form.get('photo')
    const file = photo instanceof File && photo.size > 0 ? photo : null

    if (bio.length > 2000) {
      return NextResponse.json({ error: 'Bio is too long (2000 characters max).' }, { status: 400 })
    }
    const imageError = validateProfileImage(file)
    if (imageError) return NextResponse.json({ error: imageError }, { status: 400 })

    const supabase = createServerClient()
    const { data: nanny, error: loadErr } = await supabase
      .from('nannies')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle()
    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
    if (!nanny) return NextResponse.json({ error: 'Your public profile is not live yet.' }, { status: 404 })

    const current = nanny as Nanny
    const { data: destRows } = await supabase.from('destinations').select('name').eq('is_active', true)
    const catalog = destinationNames((destRows || []) as { name: string }[])
    const destSet = new Set(catalog.length ? catalog : fallbackDestinationNames())
    const availableDays = parseStringList(form.get('availableDays'), DAY_SET)
    const destinations = parseStringList(form.get('destinations'), destSet, current.destinations || [])
    if (destinations.length === 0) {
      return NextResponse.json({ error: 'Select at least one destination.' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {
      bio: bio || null,
      is_active: isActive,
      available_days: availableDays,
      destinations,
    }
    if (file) {
      updates.photo_url = await uploadPublicPhoto(supabase, `live/${current.id}`, file)
    } else if (removePhoto) {
      updates.photo_url = null
    }

    const { data, error } = await supabase
      .from('nannies')
      .update(updates)
      .eq('id', current.id)
      .eq('user_id', profile.id)
      .select('*')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Could not update this profile.' }, { status: 404 })

    return NextResponse.json({ success: true, nanny: data })
  } catch (err) {
    console.error('Nanny profile update failed:', err)
    return NextResponse.json({ error: 'Could not save your profile.' }, { status: 500 })
  }
}
