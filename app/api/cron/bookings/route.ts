import { NextRequest, NextResponse } from 'next/server'
import { advanceDueBookings } from '@/lib/booking-ops'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  const token = request.nextUrl.searchParams.get('secret')
  return header === `Bearer ${secret}` || token === secret
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  const updated = await advanceDueBookings(createServerClient())
  return NextResponse.json({ ok: true, updated })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
