'use client'

import { useEffect, useState } from 'react'
import { DESTINATIONS } from '@/lib/constants'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

export type BookingDefaults = {
  destination?: string
  checkIn?: string
  checkOut?: string
  children?: string
  tier?: string
  nannyId?: string
  nannyName?: string
}

export default function BookingModal({
  open,
  onClose,
  defaults,
}: {
  open: boolean
  onClose: () => void
  defaults?: BookingDefaults
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    destination: defaults?.destination || '',
    checkIn: defaults?.checkIn || '',
    checkOut: defaults?.checkOut || '',
    children: defaults?.children || '',
    youngestAge: '',
    nanniesNeeded: '1',
    tier: defaults?.tier || '',
    notes: '',
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  // Prefill name/email/phone from the logged-in user's profile when the modal opens.
  useEffect(() => {
    if (!open) return
    async function loadProfile() {
      try {
        const supabase = createSupabaseBrowser()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, phone')
          .eq('id', user.id)
          .maybeSingle()
        setForm(f => ({
          ...f,
          name: f.name || String(profile?.full_name || user.user_metadata?.full_name || '').trim(),
          email: f.email || String(profile?.email || user.email || '').trim(),
          phone: f.phone || String(profile?.phone || '').trim(),
        }))
      } catch {
        // Silent fail: leave fields empty so the user can type manually.
      }
    }
    loadProfile()
  }, [open])

  function change(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setError('')
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: form.name,
          email: form.email,
          phone: form.phone,
          destination: form.destination,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          childrenCount: form.children,
          youngestAge: form.youngestAge,
          nanniesNeeded: form.nanniesNeeded,
          tier: form.tier,
          notes: form.notes,
          nannyId: defaults?.nannyId,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Something went wrong. Please try again.')
        setStatus('error')
        return
      }
      setStatus('done')
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    }
  }

  if (!open) return null
  return (
    <div className="modal-bg on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <button className="modal-x" onClick={onClose}>✕</button>
        {status === 'done' ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#fff', marginBottom: '0.5rem' }}>Request Received</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
              We&apos;ll confirm your nanny within 2 hours
              {form.email ? ` and email ${form.email}` : ''}.
            </p>
            <button className="btn-coral" style={{ marginTop: '1.5rem' }} onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <h2>Book Your Nanny</h2>
            <p className="modal-sub">
              {defaults?.nannyName
                ? `Request ${defaults.nannyName}. We'll confirm availability and send a match within 2 hours.`
                : "Fill in your details and we'll match you with the perfect nanny."}
            </p>
            <form className="mform" onSubmit={submit}>
              <div className="mrow">
                <div className="mfield">
                  <label>Full Name</label>
                  <input name="name" required value={form.name} onChange={change} placeholder="Jane Smith" />
                </div>
                <div className="mfield">
                  <label>Email</label>
                  <input name="email" type="email" required value={form.email} onChange={change} placeholder="jane@email.com" />
                </div>
              </div>
              <div className="mrow">
                <div className="mfield">
                  <label>Phone / WhatsApp</label>
                  <input name="phone" required value={form.phone} onChange={change} placeholder="+254 796 930 612" />
                </div>
                <div className="mfield">
                  <label>Destination</label>
                  <select name="destination" required value={form.destination} onChange={change}>
                    <option value="">Select destination</option>
                    {DESTINATIONS.map(d => <option key={d}>{d}</option>)}
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div className="mrow">
                <div className="mfield">
                  <label>Check-in Date</label>
                  <input name="checkIn" type="date" required value={form.checkIn} onChange={change} />
                </div>
                <div className="mfield">
                  <label>Check-out Date</label>
                  <input name="checkOut" type="date" required value={form.checkOut} onChange={change} />
                </div>
              </div>
              <div className="mrow">
                <div className="mfield">
                  <label>Number of Children</label>
                  <select name="children" value={form.children} onChange={change}>
                    <option value="">Select</option>
                    <option>1</option><option>2</option><option>3</option><option>4+</option>
                  </select>
                </div>
                <div className="mfield">
                  <label>Youngest child&apos;s age</label>
                  <select name="youngestAge" value={form.youngestAge} onChange={change}>
                    <option value="">Select</option>
                    <option>Under 1 year</option>
                    <option>1–2 years</option>
                    <option>3–5 years</option>
                    <option>6–10 years</option>
                    <option>11+ years</option>
                  </select>
                </div>
              </div>
              <div className="mrow">
                <div className="mfield">
                  <label>Nannies needed</label>
                  <select name="nanniesNeeded" value={form.nanniesNeeded} onChange={change}>
                    <option value="1">1 nanny</option>
                    <option value="2">2 nannies</option>
                    <option value="3+">3+ (we&apos;ll call you)</option>
                  </select>
                </div>
                <div className="mfield">
                  <label>Nanny Tier</label>
                  <select name="tier" value={form.tier} onChange={change}>
                    <option value="">Any tier</option>
                    <option value="bronze">Bronze (Basic)</option>
                    <option value="silver">Silver (Professional)</option>
                    <option value="gold">Gold (Elite)</option>
                  </select>
                </div>
              </div>
              <div className="mfield" style={{ marginBottom: '1rem' }}>
                <label>Special Requests / Notes</label>
                <input name="notes" value={form.notes} onChange={change} placeholder="Allergies, sleep schedules, special needs…" />
              </div>
              {status === 'error' && (
                <p style={{ color: '#ff8a8a', fontSize: '0.82rem', marginBottom: '0.7rem' }}>{error}</p>
              )}
              <button className="msubmit" type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending…' : 'Request My Nanny →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
