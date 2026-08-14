'use client'

import { useState } from 'react'
import PageShell from '@/components/PageShell'
import { WHATSAPP_DISPLAY, SUPPORT_EMAIL, waLink } from '@/lib/constants'

export default function ContactPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setStatus('loading')
    setError('')
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email'),
        subject: form.get('subject'),
        message: form.get('message'),
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Could not send')
      setStatus('error')
      return
    }
    setStatus('done')
  }

  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Hello</div>
        <h1>Talk to <em>VacayNanny</em></h1>
        <p>WhatsApp {WHATSAPP_DISPLAY} or email {SUPPORT_EMAIL}. We typically reply within a few hours.</p>
      </section>
      <div className="sec-inner" style={{ maxWidth: 640, paddingBottom: 80 }}>
        {status === 'done' ? (
          <div className="form-card">
            <h3>Message received</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>We&apos;ll get back to you shortly.</p>
          </div>
        ) : (
          <form className="form-card" onSubmit={submit}>
            <h3>Send a message</h3>
            <div className="field-row">
              <div className="field"><label>Name</label><input name="name" required /></div>
              <div className="field"><label>Email</label><input name="email" type="email" required /></div>
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Subject</label>
              <input name="subject" placeholder="Booking question, partnership, press…" />
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Message</label>
              <textarea name="message" required style={{ minHeight: 140 }} />
            </div>
            {error && <p className="field-error-msg">{error}</p>}
            <button className="btn-submit" disabled={status === 'loading'}>{status === 'loading' ? 'Sending…' : 'Send'}</button>
          </form>
        )}
        <p style={{ marginTop: 20, color: 'rgba(255,255,255,0.45)' }}>
          Prefer chat? <a href={waLink()} style={{ color: 'var(--coral)' }}>Open WhatsApp</a>
        </p>
      </div>
    </PageShell>
  )
}
