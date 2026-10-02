import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

const WINDOW_SECONDS = 60 * 60

const LIMITS = {
  apply: { ip: 5, email: 3 },
  booking: { ip: 10, email: 6 },
  contact: { ip: 8, email: 4 },
  waitlist: { ip: 8, email: 3 },
} as const

type RouteName = keyof typeof LIMITS

type MemoryHit = { hits: number; windowStart: number }

const memory = new Map<string, MemoryHit>()

function clientAddress(request: NextRequest): string {
  const trusted = request.headers.get('x-nf-client-connection-ip')?.trim()
  if (trusted) return trusted.slice(0, 80)
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  if (first) return first.slice(0, 80)
  return 'unknown'
}

function normalizeEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase() ?? ''
  if (!value || value.length > 200 || !value.includes('@')) return null
  return value
}

function pruneMemory(now: number) {
  if (memory.size < 2000) return
  for (const [key, row] of memory) {
    if (now - row.windowStart > WINDOW_SECONDS * 1000) memory.delete(key)
  }
}

function consumeMemory(bucket: string, limit: number): boolean {
  const now = Date.now()
  pruneMemory(now)
  const row = memory.get(bucket)
  if (!row || now - row.windowStart >= WINDOW_SECONDS * 1000) {
    memory.set(bucket, { hits: 1, windowStart: now })
    return true
  }
  row.hits += 1
  return row.hits <= limit
}

function missingRateLimitFunction(error: { code?: string; message?: string }): boolean {
  if (error.code === 'PGRST202' || error.code === '42883') return true
  const message = error.message || ''
  return /consume_rate_limit/i.test(message) || /does not exist/i.test(message)
}

async function consume(supabase: SupabaseClient, bucket: string, limit: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: WINDOW_SECONDS,
  })
  if (error) {
    if (!missingRateLimitFunction(error)) {
      console.error('rate limit rpc failed:', error.message)
    }
    return consumeMemory(bucket, limit)
  }
  return data === true
}

function tooMany() {
  return NextResponse.json(
    { error: 'Too many requests. Please wait a few minutes and try again.' },
    { status: 429, headers: { 'Retry-After': String(WINDOW_SECONDS) } },
  )
}

export async function limitRoute(
  request: NextRequest,
  supabase: SupabaseClient,
  route: RouteName,
  options?: { email?: string | null; skipIp?: boolean },
): Promise<NextResponse | null> {
  const spec = LIMITS[route]
  if (!options?.skipIp) {
    const allowed = await consume(supabase, `${route}:ip:${clientAddress(request)}`, spec.ip)
    if (!allowed) return tooMany()
  }
  const email = normalizeEmail(options?.email)
  if (email) {
    const allowed = await consume(supabase, `${route}:email:${email}`, spec.email)
    if (!allowed) return tooMany()
  }
  return null
}
