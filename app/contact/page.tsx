'use client'

import { useState } from 'react'
import PageShell from '@/components/PageShell'
import { SUPPORT_EMAIL, WHATSAPP_DISPLAY, waLink } from '@/lib/constants'

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
      <article className="contact-page">
        <header className="contact-head">
          <p className="eyebrow">Hello</p>
          <h1>Talk to <em>VacayNanny</em></h1>
          <p>Questions about a booking, a partnership, or the press. We typically reply within a few hours.</p>
        </header>
        <div className="contact-grid">
          {status === 'done' ? (
            <div className="contact-form contact-done">
              <h2>Message received</h2>
              <p>Thanks for writing. We&apos;ll reply to the email you sent.</p>
            </div>
          ) : (
            <form className="contact-form" onSubmit={submit}>
              <h2>Send a message</h2>
              <div className="contact-row">
                <label>
                  <span>Name</span>
                  <input name="name" type="text" required autoComplete="name" />
                </label>
                <label>
                  <span>Email</span>
                  <input name="email" type="email" required autoComplete="email" />
                </label>
              </div>
              <label>
                <span>Subject</span>
                <input name="subject" type="text" placeholder="Booking, partnership, press…" />
              </label>
              <label>
                <span>Message</span>
                <textarea name="message" required rows={6} />
              </label>
              {error && <p className="field-error-msg">{error}</p>}
              <button className="btn-submit" type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
          <aside className="contact-aside">
            <a className="contact-channel" href={waLink('Hi VacayNanny! I have a question.')} target="_blank" rel="noreferrer">
              <span>WhatsApp</span>
              <strong>{WHATSAPP_DISPLAY}</strong>
              <small>Fastest for booking questions</small>
            </a>
            <a className="contact-channel" href={`mailto:${SUPPORT_EMAIL}`}>
              <span>Email</span>
              <strong>{SUPPORT_EMAIL}</strong>
              <small>Partnerships, press, and everything else</small>
            </a>
            <div className="contact-note">
              <h2>We can help with</h2>
              <ul>
                <li>Matching a nanny to your trip</li>
                <li>Resort and property partnerships</li>
                <li>Press and interviews</li>
              </ul>
            </div>
          </aside>
        </div>
      </article>
    </PageShell>
  )
}
