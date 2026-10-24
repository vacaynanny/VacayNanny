import { NextRequest, NextResponse } from 'next/server'
import { requireAdminProfile } from '@/lib/auth'
import { sendApplicationStatusEmail } from '@/lib/email'
import { approveNannyAccount } from '@/lib/publish-nanny'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Nanny profiles are not configured yet.' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({})) as { userId?: unknown }
  const userId = String(body.userId || '')
  if (!userId) return NextResponse.json({ error: 'Choose an account to approve.' }, { status: 400 })

  const supabase = createServerClient()
  const result = await approveNannyAccount(supabase, userId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  if (result.fresh && result.email) {
    sendApplicationStatusEmail({
      fullName: result.fullName,
      email: result.email,
      status: 'approved',
      slug: result.slug,
      needsSafeguarding: result.tier === 'gold',
    }).catch(err => console.error('sendApplicationStatusEmail failed:', err))
  }

  return NextResponse.json({ success: true, slug: result.slug })
}
