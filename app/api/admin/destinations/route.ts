import { NextRequest, NextResponse } from 'next/server'
import { requireAdminProfile } from '@/lib/auth'
import { parseDestinationPayload } from '@/lib/destinations'
import { slugify } from '@/lib/constants'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'

async function uniqueSlug(base: string, excludeId?: string) {
  const supabase = createServerClient()
  let slug = slugify(base) || 'destination'
  for (let i = 2; i < 40; i++) {
    let query = supabase.from('destinations').select('id').eq('slug', slug)
    if (excludeId) query = query.neq('id', excludeId)
    const { data } = await query.maybeSingle()
    if (!data) return slug
    slug = `${slugify(base) || 'destination'}-${i}`
  }
  return `${slugify(base) || 'destination'}-${Date.now()}`
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Destinations are not configured yet.' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const parsed = parseDestinationPayload(body)
  if (!parsed.name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  if (!parsed.country) return NextResponse.json({ error: 'Country is required.' }, { status: 400 })

  const slug = await uniqueSlug(parsed.slugRaw || parsed.name)
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('destinations')
    .insert([{
      name: parsed.name,
      country: parsed.country,
      slug,
      image_url: parsed.image_url,
      description: parsed.description,
      is_active: parsed.is_active,
      sort_order: parsed.sort_order,
    }])
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, destination: data }, { status: 201 })
}
