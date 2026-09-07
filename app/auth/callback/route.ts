import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/constants'

function safeNext(path: string | null, fallback = '/account') {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return fallback
  }
  return path
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNext(searchParams.get('next'))
  const authError = searchParams.get('error')

  if (authError) {
    return NextResponse.redirect(`${SITE_URL}/forgot-password?error=invalid`)
  }

  const supabase = await createSupabaseServer()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${SITE_URL}/forgot-password?error=invalid`)
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) {
      return NextResponse.redirect(`${SITE_URL}/forgot-password?error=invalid`)
    }
  }

  return NextResponse.redirect(`${SITE_URL}${next}`)
}
