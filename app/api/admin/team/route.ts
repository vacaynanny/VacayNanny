import { NextRequest, NextResponse } from 'next/server'
import { requireAdminProfile } from '@/lib/auth'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import type { UserRole } from '@/lib/types'

function parseRole(value: unknown): UserRole | null {
  if (value === 'parent' || value === 'nanny' || value === 'admin') return value
  return null
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Profiles are not configured yet.' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({})) as { id?: unknown; role?: unknown }
  const id = String(body.id || '')
  const role = parseRole(body.role)
  if (!id || !role) return NextResponse.json({ error: 'Choose a person and a role.' }, { status: 400 })

  const supabase = createServerClient()
  const { data: current, error: loadError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', id)
    .maybeSingle()
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!current) {
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(id)
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'That account does not exist.' }, { status: 404 })
    }
    const metadata = authData.user.user_metadata as { full_name?: unknown } | undefined
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        full_name: String(metadata?.full_name || '').slice(0, 80),
        email: authData.user.email ?? null,
        role,
      })
      .select('id, role, full_name, email')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, profile: data })
  }

  if (current.role === 'admin' && role !== 'admin') {
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'Keep at least one admin on the desk.' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id)
    .select('id, role, full_name, email')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, profile: data })
}
