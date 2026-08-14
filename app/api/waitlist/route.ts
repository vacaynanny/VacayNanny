import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const region = String(body.region || '').trim()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
    }
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Waitlist is not configured yet.' }, { status: 503 })
    }
    const supabase = createServerClient()
    const { error } = await supabase.from('waitlist').insert([{ email, region: region || null }])
    if (error) {
      if (error.code === '23505') return NextResponse.json({ success: true, already: true })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
