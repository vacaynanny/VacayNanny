'use client'

import Link from 'next/link'
import { SPECIALIST_SERVICES } from '@/lib/care-enquiries'
import { useState } from 'react'
import PageShell from '@/components/PageShell'
import { SUPPORT_EMAIL, WHATSAPP_DISPLAY, waLink } from '@/lib/constants'

export default function ContactPage({
  service = '',
  destination = '',
}: {
  service?: string
  destination?: string
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [trackingPath, setTrackingPath] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setStatus('loading')
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          subject: form.get('subject'),
          message: form.get('message'),
          careService: form.get('careService'),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Could not send')
        setStatus('error')
        return
      }
      const data = await res.json()
      setTrackingPath(data.trackingPath || null)
      setStatus('done')
    } catch {
      setError('We could not send your message. Please try again.')
      setStatus('error')
    }
  }

  return (
    <PageShell>
      <article className="contact-page">
        <header className="contact-head">
          <p className="eyebrow">Hello</p>
          <h1>
            {service || destination ? (
              'Let’s talk about care.'
            ) : (
              <>
                Talk to <em>VacayNanny</em>
              </>
            )}
          </h1>
          <p>
            Tell us what you have in mind. Our team will help you find the right next
            step.
          </p>
        </header>
        <div className="contact-grid">
          {status === 'done' ? (
            <div className="contact-form contact-done">
              <h2>Message received</h2>
              <p>Thanks for writing. We&apos;ll reply to the email you sent.</p>
              {trackingPath && (
                <Link className="btn-coral" href={trackingPath}>
                  Track my specialist care enquiry
                </Link>
              )}
            </div>
          ) : (
            <form className="contact-form" onSubmit={submit}>
              <h2>
                {service
                  ? 'Request a specialist care quote'
                  : destination
                    ? `Ask about care in ${destination}`
                    : 'Send a message'}
              </h2>
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
                <span>Care service</span>
                <select name="careService" defaultValue={service}>
                  <option value="">General enquiry</option>
                  {SPECIALIST_SERVICES.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Subject</span>
                <input
                  name="subject"
                  type="text"
                  defaultValue={
                    service
                      ? `Specialist care quote: ${service}`
                      : destination
                        ? `Childcare enquiry: ${destination}`
                        : ''
                  }
                  placeholder="Booking, partnership, press…"
                />
              </label>
              <label>
                <span id="contact-message-label">Message</span>
                <textarea
                  name="message"
                  aria-labelledby="contact-message-label"
                  aria-describedby={service ? 'contact-message-hint' : undefined}
                  required
                  rows={6}
                  placeholder={
                    service
                      ? 'Share your location, preferred dates and the kind of support you are looking for.'
                      : undefined
                  }
                />
                {service && (
                  <small id="contact-message-hint">
                    Please do not include medical records or sensitive health details.
                    We’ll discuss these privately if needed.
                  </small>
                )}
              </label>
              {error && <p className="field-error-msg">{error}</p>}
              <button
                className="btn-submit"
                type="submit"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
          <aside className="contact-aside">
            <a
              className="contact-channel"
              href={waLink('Hi VacayNanny! I have a question.')}
              target="_blank"
              rel="noreferrer"
            >
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
