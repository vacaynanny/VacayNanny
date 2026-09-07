'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ContactMessage, WaitlistEntry } from '@/lib/types'

function when(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })
}

function mailto(email: string, subject?: string | null) {
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : ''
  return `mailto:${email}${q}`
}

export default function AdminInbox({
  contactMessages,
  waitlist,
}: {
  contactMessages: ContactMessage[]
  waitlist: WaitlistEntry[]
}) {
  const router = useRouter()
  const [pane, setPane] = useState<'contact' | 'waitlist'>('contact')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const byRegion = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of waitlist) {
      const key = row.region?.trim() || 'Unspecified'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [waitlist])

  async function remove(kind: 'contact' | 'waitlist', id: string) {
    setBusy(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/inbox/${kind}/${id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not remove this entry.')
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="dash-tabs" style={{ marginBottom: 16 }}>
        <button className={pane === 'contact' ? 'active' : ''} onClick={() => setPane('contact')}>
          Contact ({contactMessages.length})
        </button>
        <button className={pane === 'waitlist' ? 'active' : ''} onClick={() => setPane('waitlist')}>
          Waitlist ({waitlist.length})
        </button>
      </div>
      {error && <p className="field-error-msg" style={{ marginBottom: 16 }}>{error}</p>}

      {pane === 'contact' && (
        <div>
          {contactMessages.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>No contact messages yet.</p>
          )}
          {contactMessages.map(m => (
            <div className="form-card" key={m.id}>
              <div className="review-row">
                <span className="review-key">
                  <strong>{m.name}</strong>
                  <br />
                  <small>{m.email} · {when(m.created_at)}</small>
                </span>
                <span className="review-val">{m.subject || 'No subject'}</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, fontSize: '0.9rem', margin: '10px 0 12px', whiteSpace: 'pre-wrap' }}>
                {m.message}
              </p>
              <div className="booking-actions" style={{ marginTop: 0 }}>
                <a className="btn-coral" href={mailto(m.email, m.subject ? `Re: ${m.subject}` : 'VacayNanny')}>
                  Reply by email
                </a>
                <button
                  className="btn-ghost"
                  disabled={busy === m.id}
                  onClick={() => {
                    if (confirm('Remove this message from the inbox?')) remove('contact', m.id)
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pane === 'waitlist' && (
        <div>
          {waitlist.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>No waitlist signups yet.</p>
          )}
          {byRegion.length > 0 && (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginBottom: 16 }}>
              {byRegion.map(([region, count]) => `${region} ${count}`).join(' · ')}
            </p>
          )}
          {waitlist.map(row => (
            <div className="form-card" key={row.id}>
              <div className="review-row">
                <span className="review-key">
                  <strong>{row.email}</strong>
                  <br />
                  <small>{when(row.created_at)}</small>
                </span>
                <span className="review-val">{row.region || 'Unspecified'}</span>
              </div>
              <div className="booking-actions">
                <a className="btn-coral" href={mailto(row.email, `VacayNanny — ${row.region || 'expansion'} waitlist`)}>
                  Email
                </a>
                <button
                  className="btn-ghost"
                  disabled={busy === row.id}
                  onClick={() => {
                    if (confirm('Remove this waitlist signup?')) remove('waitlist', row.id)
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
