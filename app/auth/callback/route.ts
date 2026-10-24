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

  // Handle auth errors with user-friendly messages
  if (authError) {
    const errorParams = new URLSearchParams()
    if (authError === 'access_denied' || authError === 'expired_token' || authError === 'invalid_token') {
      errorParams.set('error', 'expired')
      errorParams.set('message', 'This confirmation link has expired or is invalid. Please request a new one.')
    } else if (authError === 'email_not_confirmed') {
      errorParams.set('error', 'unconfirmed')
      errorParams.set('message', 'Please confirm your email address first.')
    } else {
      errorParams.set('error', 'invalid')
      errorParams.set('message', 'Something went wrong. Please try again.')
    }
    return NextResponse.redirect(`${SITE_URL}/login?${errorParams.toString()}`)
  }

  const supabase = await createSupabaseServer()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const errorParams = new URLSearchParams()
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        errorParams.set('error', 'expired')
        errorParams.set('message', 'This confirmation link has expired. Please request a new one from the sign-up page.')
      } else {
        errorParams.set('error', 'invalid')
        errorParams.set('message', 'We couldn\'t confirm your email. Please try again or request a new link.')
      }
      return NextResponse.redirect(`${SITE_URL}/login?${errorParams.toString()}`)
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) {
      const errorParams = new URLSearchParams()
      errorParams.set('error', 'invalid')
      errorParams.set('message', 'This link is invalid or has expired. Please request a new one.')
      return NextResponse.redirect(`${SITE_URL}/login?${errorParams.toString()}`)
    }
  }

  return NextResponse.redirect(`${SITE_URL}${next}`)
}
