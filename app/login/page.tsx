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
      <div className="site-wrap page-inner">
        <section className="page-hero">
          <div className="eyebrow">Account</div>
          <h1>Sign <em>in</em></h1>
          <p>Parents, nannies and the VacayNanny team use the same login.</p>
        </section>
        <form className="auth-card" onSubmit={submit} autoComplete="on">
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
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>
          <p className="auth-forgot"><Link href="/forgot-password">Forgot password?</Link></p>
          {error && <p className="field-error-msg">{error}</p>}
          <button className="btn-submit" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
          <p className="auth-switch">New here? <Link href="/signup">Create an account</Link></p>
        </form>
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
