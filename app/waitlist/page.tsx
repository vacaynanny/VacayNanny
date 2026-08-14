'use client'

import { useState } from 'react'
import PageShell from '@/components/PageShell'

export default function WaitlistPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setStatus('loading')
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.get('email'), region: form.get('region') }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Could not join waitlist')
      setStatus('error')
      return
    }
    setStatus('done')
  }

  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Coming soon</div>
        <h1>Expansion <em>waitlist</em></h1>
        <p>We&apos;re growing beyond Kenya into Zanzibar, Rwanda and South Africa. Leave your email and we&apos;ll tell you when we launch in your region.</p>
      </section>
      <div className="sec-inner" style={{ maxWidth: 520, paddingBottom: 80 }}>
        {status === 'done' ? (
          <div className="form-card"><h3>You&apos;re on the list</h3><p style={{ color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>We&apos;ll be in touch when coverage opens.</p></div>
        ) : (
          <form className="form-card" onSubmit={submit}>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Email</label>
              <input name="email" type="email" required />
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Region you need</label>
              <select name="region">
                <option>Zanzibar</option>
                <option>Rwanda</option>
                <option>South Africa</option>
                <option>UAE</option>
                <option>Other</option>
              </select>
            </div>
            {error && <p className="field-error-msg">{error}</p>}
            <button className="btn-submit" disabled={status === 'loading'}>Join waitlist</button>
          </form>
        )}
      </div>
    </PageShell>
  )
}
