import { NextRequest, NextResponse } from 'next/server'
import { requireAdminProfile } from '@/lib/auth'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Nanny profiles are not configured yet.' }, { status: 503 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({})) as { isActive?: unknown }
  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'Say whether this profile should be live.' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('nannies')
    .update({ is_active: body.isActive })
    .eq('id', id)
    .select('id, display_name, is_active')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Nanny profile not found.' }, { status: 404 })
  return NextResponse.json({ success: true, nanny: data })
}
