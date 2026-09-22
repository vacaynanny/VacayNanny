import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import { uploadPublicPhoto, validateProfileImage } from '@/lib/profile-media'

function cleanName(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function cleanPhone(value: unknown) {
  return String(value || '').trim().slice(0, 32)
}

export async function PATCH(request: NextRequest) {
  try {
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Profile storage is not configured yet.' }, { status: 503 })
    }
    const profile = await getCurrentProfile()
    if (!profile) return NextResponse.json({ error: 'Sign in to edit your profile.' }, { status: 401 })

    const form = await request.formData()
    const fullName = cleanName(form.get('fullName'))
    const phone = cleanPhone(form.get('phone'))
    const removeAvatar = String(form.get('removeAvatar') || '') === 'true'
    const avatar = form.get('avatar')
    const file = avatar instanceof File && avatar.size > 0 ? avatar : null

    if (fullName.length < 2) {
      return NextResponse.json({ error: 'Enter your full name.' }, { status: 400 })
    }
    if (fullName.length > 80) {
      return NextResponse.json({ error: 'Name is too long.' }, { status: 400 })
    }
    const imageError = validateProfileImage(file)
    if (imageError) return NextResponse.json({ error: imageError }, { status: 400 })

    const supabase = createServerClient()
    const updates: Record<string, unknown> = {
      full_name: fullName,
      phone: phone || null,
    }
    if (file) {
      updates.avatar_url = await uploadPublicPhoto(supabase, `profiles/${profile.id}`, file)
    } else if (removeAvatar) {
      updates.avatar_url = null
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)
      .select('id, role, full_name, email, phone, avatar_url, created_at')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })

    return NextResponse.json({ success: true, profile: data })
  } catch (err) {
    console.error('Account profile update failed:', err)
    return NextResponse.json({ error: 'Could not save your profile.' }, { status: 500 })
  }
}
