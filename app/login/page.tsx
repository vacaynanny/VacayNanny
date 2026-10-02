'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { hasSupabaseConfig } from '@/lib/supabase'
import Nav from '@/components/Nav'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/account'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasSupabaseConfig()) {
      setError('Auth is not configured. Add Supabase keys to .env.local.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createSupabaseBrowser()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError(err.message); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const role = profile?.role
      router.push(role === 'admin' ? '/admin' : role === 'nanny' ? '/nanny' : next)
      router.refresh()
    }
  }

  return (
    <>
      <Nav />
      <div className="login-stage">
        <aside className="login-visual">
          <div className="login-visual-copy">
            <p className="login-visual-kicker">Holiday childcare</p>
            <h2>One login for the <em>whole trip.</em></h2>
            <p>Families, nannies, and the VacayNanny team sign in here.</p>
            <ul className="login-points">
              <li>Your bookings</li>
              <li>Messages</li>
              <li>Nanny applications</li>
            </ul>
          </div>
        </aside>
        <div className="login-panel">
          <form className="auth-card" onSubmit={submit} autoComplete="on">
            <div className="login-heading">
              <div className="eyebrow">Account</div>
              <h1>Sign <em>in</em></h1>
              <p>Use the email you booked with, or the one on your application.</p>
            </div>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
            <div className="field">
              <div className="login-label-row">
                <label htmlFor="login-password">Password</label>
                <Link href="/forgot-password">Forgot password?</Link>
              </div>
              <div className="login-password">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your password"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                />
                <button
                  className="login-reveal"
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(value => !value)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {error && <p id="login-error" className="field-error-msg" role="alert">{error}</p>}
            <button className="btn-submit" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
            <p className="auth-switch">New here? <Link href="/signup">Create an account</Link></p>
          </form>
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
