'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { hasSupabaseConfig } from '@/lib/supabase'
import Nav from '@/components/Nav'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setReady(true)
      return
    }
    const supabase = createSupabaseBrowser()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasSession(!!user)
      setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setHasSession(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!hasSupabaseConfig()) {
      setError('Auth is not configured. Add Supabase keys to .env.local.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createSupabaseBrowser()
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setLoading(false)
      setError(err.message)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const role = profile?.role
      router.push(role === 'admin' ? '/admin' : role === 'nanny' ? '/nanny' : '/account')
      router.refresh()
      return
    }
    setLoading(false)
    router.push('/login')
  }

  return (
    <>
      <Nav />
      <div className="login-stage">
        <aside className="login-visual">
          <div className="login-visual-copy">
            <p className="login-visual-kicker">Holiday childcare</p>
            <h2>Choose a password you&apos;ll <em>remember</em>.</h2>
            <p>This replaces the password on the account that requested the reset.</p>
            <ul className="login-points">
              <li>At least 8 characters</li>
              <li>Same account</li>
              <li>Then you&apos;re signed in</li>
            </ul>
          </div>
        </aside>
        <div className="login-panel">
          {!ready ? (
            <div className="auth-card">
              <div className="login-heading">
                <div className="eyebrow">Account</div>
                <h1>Checking your <em>link</em></h1>
                <p>One moment while we confirm this reset link.</p>
              </div>
            </div>
          ) : !hasSession ? (
            <div className="auth-card">
              <div className="login-heading">
                <div className="eyebrow">Account</div>
                <h1>Link <em>expired</em></h1>
                <p>This reset link is invalid or has expired. Request a new one and try again.</p>
              </div>
              <Link className="btn-submit" href="/forgot-password">Request a new link</Link>
            </div>
          ) : (
            <form className="auth-card" onSubmit={submit} autoComplete="on">
              <div className="login-heading">
                <div className="eyebrow">Account</div>
                <h1>Choose a <em>new password</em></h1>
                <p>This updates the password for the account that requested the reset.</p>
              </div>
              <div className="field">
                <label htmlFor="reset-password">New password</label>
                <div className="login-password">
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'reset-error' : undefined}
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
              <div className="field">
                <label htmlFor="reset-confirm">Confirm password</label>
                <input
                  id="reset-confirm"
                  type={showPassword ? 'text' : 'password'}
                  name="confirm"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat the new password"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'reset-error' : undefined}
                />
              </div>
              {error && <p id="reset-error" className="field-error-msg" role="alert">{error}</p>}
              <button className="btn-submit" type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
