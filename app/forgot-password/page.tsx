'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { hasSupabaseConfig } from '@/lib/supabase'
import Nav from '@/components/Nav'

function ForgotPasswordForm() {
  const params = useSearchParams()
  const invalidLink = params.get('error') === 'invalid'
  const [email, setEmail] = useState('')
  const [error, setError] = useState(invalidLink ? 'That reset link is invalid or has expired. Request a new one.' : '')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasSupabaseConfig()) {
      setError('Auth is not configured. Add Supabase keys to .env.local.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createSupabaseBrowser()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
  }

  return (
    <>
      <Nav />
      <div className="site-wrap page-inner">
        <section className="page-hero">
          <div className="eyebrow">Account</div>
          <h1>Reset your <em>password</em></h1>
          <p>Enter the email on your VacayNanny account and we&apos;ll send a reset link.</p>
        </section>
        {done ? (
          <div className="auth-card">
            <h2 style={{ fontFamily: 'Playfair Display, serif', marginBottom: 12 }}>Check your email</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)' }}>
              If an account exists for {email}, you&apos;ll get a link to choose a new password. It expires after a short time.
            </p>
            <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
          </div>
        ) : (
          <form className="auth-card" onSubmit={submit} autoComplete="on">
            <div className="field">
              <label htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </div>
            {error && <p className="field-error-msg">{error}</p>}
            <button className="btn-submit" type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
          </form>
        )}
      </div>
    </>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  )
}
