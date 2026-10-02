'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { hasSupabaseConfig } from '@/lib/supabase'
import { SITE_URL } from '@/lib/constants'
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
      redirectTo: `${SITE_URL}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
  }

  return (
    <>
      <Nav />
      <div className="login-stage">
        <aside className="login-visual">
          <div className="login-visual-copy">
            <p className="login-visual-kicker">Holiday childcare</p>
            <h2>A link to the <em>email</em> on your account.</h2>
            <p>We send the reset there. The link expires after a short time, then you choose a new password.</p>
            <ul className="login-points">
              <li>Email link</li>
              <li>New password</li>
              <li>Back to your bookings</li>
            </ul>
          </div>
        </aside>
        <div className="login-panel">
          {done ? (
            <div className="auth-card">
              <div className="login-heading">
                <div className="eyebrow">Account</div>
                <h1>Check your <em>email</em></h1>
                <p>If an account exists for {email}, you&apos;ll get a link to choose a new password.</p>
              </div>
              <Link className="btn-submit" href="/login">Back to sign in</Link>
            </div>
          ) : (
            <form className="auth-card" onSubmit={submit} autoComplete="on">
              <div className="login-heading">
                <div className="eyebrow">Account</div>
                <h1>Reset your <em>password</em></h1>
                <p>Enter the email on your VacayNanny account and we&apos;ll send a reset link.</p>
              </div>
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
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'forgot-error' : undefined}
                />
              </div>
              {error && <p id="forgot-error" className="field-error-msg" role="alert">{error}</p>}
              <button className="btn-submit" type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
            </form>
          )}
        </div>
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
