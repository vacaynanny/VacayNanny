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
      <div className="site-wrap page-inner">
        <section className="page-hero">
          <div className="eyebrow">Account</div>
          <h1>Choose a <em>new password</em></h1>
          <p>This updates the password for the account that requested the reset.</p>
        </section>
        {!ready ? (
          <div className="auth-card">
            <p style={{ color: 'rgba(255,255,255,0.6)' }}>Checking your reset link…</p>
          </div>
        ) : !hasSession ? (
          <div className="auth-card">
            <h2 style={{ fontFamily: 'Playfair Display, serif', marginBottom: 12 }}>Link expired</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)' }}>
              This reset link is invalid or has expired. Request a new one and try again.
            </p>
            <p className="auth-switch"><Link href="/forgot-password">Request a new link</Link></p>
          </div>
        ) : (
          <form className="auth-card" onSubmit={submit} autoComplete="on">
            <div className="field">
              <label htmlFor="reset-password">New password</label>
              <input
                id="reset-password"
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="field">
              <label htmlFor="reset-confirm">Confirm password</label>
              <input
                id="reset-confirm"
                type="password"
                name="confirm"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat the new password"
              />
            </div>
            {error && <p className="field-error-msg">{error}</p>}
            <button className="btn-submit" type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
