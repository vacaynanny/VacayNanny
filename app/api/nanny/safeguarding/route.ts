import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { scoreSafeguardingQuiz, SAFEGUARDING_PASS_MARK } from '@/lib/safeguarding'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import type { Nanny } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Training is not configured yet.' }, { status: 503 })
    }
    const profile = await getCurrentProfile()
    if (!profile) return NextResponse.json({ error: 'Sign in to complete training.' }, { status: 401 })
    if (profile.role !== 'nanny' && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const result = scoreSafeguardingQuiz(body.answers)
    if (!result.passed) {
      return NextResponse.json({
        error: `Score ${result.score}/5 — you need ${SAFEGUARDING_PASS_MARK}/5 to pass. Review the modules and try again.`,
        score: result.score,
        passed: false,
      }, { status: 422 })
    }

    const supabase = createServerClient()
    const { data: nanny, error: loadErr } = await supabase
      .from('nannies')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle()
    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
    if (!nanny) return NextResponse.json({ error: 'Your public profile is not live yet.' }, { status: 404 })

    const current = nanny as Nanny
    if (current.safeguarding_completed_at) {
      return NextResponse.json({ success: true, alreadyComplete: true, nanny: current, score: result.score })
    }

    const completedAt = new Date().toISOString()
    const certifications = current.certifications.includes('Safeguarding')
      ? current.certifications
      : [...current.certifications, 'Safeguarding']
    const tags = current.tags.includes('Safeguarding')
      ? current.tags
      : [...current.tags, 'Safeguarding'].slice(0, 8)

    const { data, error } = await supabase
      .from('nannies')
      .update({
        safeguarding_completed_at: completedAt,
        certifications,
        tags,
      })
      .eq('id', current.id)
      .eq('user_id', profile.id)
      .select('*')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, passed: true, score: result.score, nanny: data })
  } catch (err) {
    console.error('Safeguarding complete failed:', err)
    return NextResponse.json({ error: 'Could not save training.' }, { status: 500 })
  }
}
