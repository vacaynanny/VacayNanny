'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { hasSupabaseConfig } from '@/lib/supabase'
import Nav from '@/components/Nav'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'parent' | 'nanny'>('parent')
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
      <div className="site-wrap page-inner">
        <section className="page-hero">
          <div className="eyebrow">Account</div>
          <h1>Create your <em>account</em></h1>
          <p>Book faster as a parent, or continue a nanny application with a saved login.</p>
        </section>
        {done ? (
          <div className="auth-card">
            <h2 style={{ fontFamily: 'Playfair Display, serif', marginBottom: 12 }}>Check your email</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)' }}>We sent a confirmation link to {email}. After confirming, you can sign in.</p>
          </div>
        ) : (
          <form className="auth-card" onSubmit={submit}>
            <div className="field">
              <label>Full name</label>
              <input required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="field">
              <label>I am a</label>
              <select value={role} onChange={e => setRole(e.target.value as 'parent' | 'nanny')}>
                <option value="parent">Parent booking childcare</option>
                <option value="nanny">Nanny applying to join</option>
              </select>
            </div>
            {error && <p className="field-error-msg">{error}</p>}
            <button className="btn-submit" type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
            <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
          </form>
        )}
      </div>
    </>
  )
}
