'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { hasSupabaseConfig } from '@/lib/supabase'
import { SITE_URL } from '@/lib/constants'
import Nav from '@/components/Nav'

type SignupRole = 'parent' | 'nanny'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<SignupRole>('parent')
  const [error, setError] = useState('')
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
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: `${SITE_URL}/auth/callback`,
      },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    if (data.session) {
      router.push(role === 'nanny' ? '/become-a-nanny' : '/account')
      router.refresh()
      return
    }
    setDone(true)
  }

  return (
    <>
      <Nav />
      <div className="login-stage">
        <aside className="login-visual">
          <div className="login-visual-copy">
            <p className="login-visual-kicker">Holiday childcare</p>
            <h2>An account for the <em>family</em>, or the nanny.</h2>
            <p>Use the email already on a booking or an application. Confirm it, and those records stay with you.</p>
            <ul className="login-points">
              <li>Family bookings</li>
              <li>Nanny applications</li>
              <li>One confirmed email</li>
            </ul>
          </div>
        </aside>
        <div className="login-panel">
          {done ? (
            <div className="auth-card">
              <div className="login-heading">
                <div className="eyebrow">Account</div>
                <h1>Check your <em>email</em></h1>
                <p>We sent a confirmation link to {email}. Open it, then sign in.</p>
              </div>
              <Link className="btn-submit" href="/login">Go to sign in</Link>
            </div>
          ) : (
            <form className="auth-card" onSubmit={submit} autoComplete="on">
              <div className="login-heading">
                <div className="eyebrow">Account</div>
                <h1>Create your <em>account</em></h1>
                <p>Parents book from here. Nannies use it to continue an application.</p>
              </div>
              <div className="field">
                <label htmlFor="signup-name">Full name</label>
                <input
                  id="signup-name"
                  type="text"
                  name="name"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div className="field">
                <label htmlFor="signup-email">Email</label>
                <input
                  id="signup-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'signup-error' : undefined}
                />
              </div>
              <div className="field">
                <label htmlFor="signup-password">Password</label>
                <div className="login-password">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'signup-error' : undefined}
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
              <fieldset className="signup-roles">
                <legend>I am a</legend>
                <div className="signup-role-row">
                  <label className="signup-role">
                    <input
                      type="radio"
                      name="role"
                      value="parent"
                      checked={role === 'parent'}
                      onChange={() => setRole('parent')}
                    />
                    <span>Parent</span>
                    <small>Booking childcare</small>
                  </label>
                  <label className="signup-role">
                    <input
                      type="radio"
                      name="role"
                      value="nanny"
                      checked={role === 'nanny'}
                      onChange={() => setRole('nanny')}
                    />
                    <span>Nanny</span>
                    <small>Applying to join</small>
                  </label>
                </div>
              </fieldset>
              {error && <p id="signup-error" className="field-error-msg" role="alert">{error}</p>}
              <button className="btn-submit" type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
              <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
