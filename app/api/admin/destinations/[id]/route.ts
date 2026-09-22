import { NextRequest, NextResponse } from 'next/server'
import { requireAdminProfile } from '@/lib/auth'
import { parseDestinationPayload } from '@/lib/destinations'
import { slugify } from '@/lib/constants'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'

async function uniqueSlug(base: string, excludeId: string) {
  const supabase = createServerClient()
  let slug = slugify(base) || 'destination'
  for (let i = 2; i < 40; i++) {
    const { data } = await supabase
      .from('destinations')
      .select('id')
      .eq('slug', slug)
      .neq('id', excludeId)
      .maybeSingle()
    if (!data) return slug
    slug = `${slugify(base) || 'destination'}-${i}`
  }
  return `${slugify(base) || 'destination'}-${Date.now()}`
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Destinations are not configured yet.' }, { status: 503 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const parsed = parseDestinationPayload(body)
  if (!parsed.name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  if (!parsed.country) return NextResponse.json({ error: 'Country is required.' }, { status: 400 })

  const supabase = createServerClient()
  const slug = await uniqueSlug(parsed.slugRaw || parsed.name, id)
  const { data, error } = await supabase
    .from('destinations')
    .update({
      name: parsed.name,
      country: parsed.country,
      slug,
      image_url: parsed.image_url,
      description: parsed.description,
      is_active: parsed.is_active,
      sort_order: parsed.sort_order,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Destination not found.' }, { status: 404 })
  return NextResponse.json({ success: true, destination: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Destinations are not configured yet.' }, { status: 503 })
  }

  const { id } = await params
  const supabase = createServerClient()
  // Hide rather than delete so existing bookings keep a stable place name.
  const { data, error } = await supabase
    .from('destinations')
    .update({ is_active: false })
    .eq('id', id)
    .select('id, is_active')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Destination not found.' }, { status: 404 })
  return NextResponse.json({ success: true, destination: data })
}
