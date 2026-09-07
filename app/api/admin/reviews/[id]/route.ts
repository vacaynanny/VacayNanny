import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'

type ReviewAction = 'publish' | 'hide'

function parseAction(raw: unknown): ReviewAction | null {
  if (raw === 'publish' || raw === 'hide') return raw
  return null
}

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') return null
  return profile
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Reviews are not configured yet.' }, { status: 503 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const action = parseAction((body as { action?: unknown }).action)
  if (!action) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })

  let is_published: boolean
  switch (action) {
    case 'publish':
      is_published = true
      break
    case 'hide':
      is_published = false
      break
    default: {
      const _never: never = action
      return _never
    }
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('reviews')
    .update({ is_published })
    .eq('id', id)
    .select('id, is_published')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Review not found.' }, { status: 404 })
  return NextResponse.json({ success: true, review: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Reviews are not configured yet.' }, { status: 503 })
  }

  const { id } = await params
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Review not found.' }, { status: 404 })
  return NextResponse.json({ success: true })
}
