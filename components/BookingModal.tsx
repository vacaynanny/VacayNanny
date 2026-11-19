'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { parseCareType, quoteBooking, quoteSummary } from '@/lib/booking'
import { useSiteCatalog } from '@/components/SiteCatalogProvider'
import { quoteRatesFromCatalog, tierOptionLabel } from '@/lib/catalog'
import { formatKes } from '@/lib/constants'
import { mergeDestinationChoices } from '@/lib/destinations'
import { useDestinationNames } from '@/lib/useDestinationNames'
import type { CareType } from '@/lib/types'

export type BookingDefaults = {
  destination?: string
  checkIn?: string
  checkOut?: string
  children?: string
  tier?: string
  nannyId?: string
  nannyName?: string
  infantCare?: boolean
  dailyRateKes?: number
}

export default function BookingModal({
  open,
  onClose,
  defaults,
  destinations,
}: {
  open: boolean
  onClose: () => void
  defaults?: BookingDefaults
  destinations?: string[]
}) {
  const placeNames = useDestinationNames(destinations)
  const site = useSiteCatalog()
  const rates = quoteRatesFromCatalog(site)
  const careOptions = site.care.length
    ? site.care
    : [
        {
          code: 'standard' as const,
          label: `Standard (${site.policies.standardShiftHours} hours)`,
          hours: site.policies.standardShiftHours,
          multiplier: 1,
          hint: 'Daytime shift included in the daily rate.',
          sortOrder: 0,
          isActive: true,
        },
      ]
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
    careType: 'standard' as CareType,
    infantCare: Boolean(defaults?.infantCare),
    notes: '',
    addonCodes: [] as string[],
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [trackingPath, setTrackingPath] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLElement>('button, input')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key !== 'Tab' || !dialog) return
      const elements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),input,select,textarea',
        ),
      ).filter((el) => el.offsetParent !== null)
      const first = elements[0],
        last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [open, onClose])
  const defaultsKey = open
    ? [
        defaults?.destination || '',
        defaults?.checkIn || '',
        defaults?.checkOut || '',
        defaults?.tier || '',
        defaults?.infantCare ? '1' : '0',
      ].join('\0')
    : ''
  const [appliedDefaults, setAppliedDefaults] = useState(defaultsKey)
  if (appliedDefaults !== defaultsKey) {
    setAppliedDefaults(defaultsKey)
    if (defaultsKey) {
      setStatus('idle')
      setError('')
      setTrackingPath('')
      setForm((f) => ({
        ...f,
        destination: defaults?.destination || f.destination,
        checkIn: defaults?.checkIn || f.checkIn,
        checkOut: defaults?.checkOut || f.checkOut,
        tier: defaults?.tier || f.tier,
        infantCare: Boolean(defaults?.infantCare) || f.infantCare,
        youngestAge: f.youngestAge || (defaults?.infantCare ? 'Under 1 year' : ''),
      }))
    }
  }

  // Prefill name/email/phone from the logged-in user's profile when the modal opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function loadProfile() {
      try {
        const supabase = createSupabaseBrowser()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, phone')
          .eq('id', user.id)
          .maybeSingle()
        if (cancelled) return
        setForm((f) => ({
          ...f,
          name:
            f.name ||
            String(profile?.full_name || user.user_metadata?.full_name || '').trim(),
          email: f.email || String(profile?.email || user.email || '').trim(),
          phone: f.phone || String(profile?.phone || '').trim(),
        }))
      } catch {
        // Silent fail: leave fields empty so the user can type manually.
      }
    }
    loadProfile()
    return () => {
      cancelled = true
    }
  }, [open])

  function change(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target
    setForm((f) => ({
      ...f,
      [name]: name === 'careType' ? parseCareType(value) : value,
    }))
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
          careType: form.careType,
          infantCare: form.infantCare,
          notes: form.notes,
          nannyId: defaults?.nannyId,
          addonCodes: form.addonCodes,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Something went wrong. Please try again.')
        setStatus('error')
        return
      }
      setStatus('done')
      setTrackingPath(json.trackingPath || '')
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    }
  }

  if (!open) return null
  return (
    <div
      className="modal-bg on"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Request a nanny"
        style={{ maxWidth: 560, maxHeight: '90dvh', overflowY: 'auto' }}
      >
        <button className="modal-x" onClick={onClose} aria-label="Close booking form">
          ✕
        </button>
        {status === 'done' ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
            <h2
              style={{
                fontFamily: 'Playfair Display, serif',
                color: 'var(--deep)',
                marginBottom: '0.5rem',
              }}
            >
              Request Received
            </h2>
            <p style={{ color: 'rgba(23,50,77,0.5)', fontSize: '0.9rem' }}>
              We&apos;ll review your request and email {form.email} with the next steps.
              Your booking is confirmed after you and your nanny accept the match. Payment
              follows before care starts.
            </p>
            <div className="booking-actions">
              {trackingPath && (
                <Link href={trackingPath} className="btn-coral">
                  Continue as a guest
                </Link>
              )}
              <Link href="/signup" className="btn-ghost">
                Create an account to track your booking
              </Link>
            </div>
            <button
              className="btn-ghost"
              style={{ marginTop: '1.5rem' }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2>Book Your Nanny</h2>
            <p className="modal-sub">
              {defaults?.nannyName
                ? `Request ${defaults.nannyName}. We’ll review availability and share the next steps by email.`
                : "Fill in your details and we'll match you with the perfect nanny."}
            </p>
            <form className="mform" onSubmit={submit}>
              <div className="mrow">
                <div className="mfield">
                  <label htmlFor="booking-name">Full Name</label>
                  <input
                    id="booking-name"
                    name="name"
                    required
                    value={form.name}
                    onChange={change}
                    placeholder="Jane Smith"
                  />
                </div>
                <div className="mfield">
                  <label htmlFor="booking-email">Email</label>
                  <input
                    id="booking-email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={change}
                    placeholder="jane@email.com"
                  />
                </div>
              </div>
              <div className="mrow">
                <div className="mfield">
                  <label htmlFor="booking-phone">Phone / WhatsApp</label>
                  <input
                    id="booking-phone"
                    name="phone"
                    required
                    value={form.phone}
                    onChange={change}
                    placeholder="+254 796 930 612"
                  />
                </div>
                <div className="mfield">
                  <label htmlFor="booking-destination">Destination</label>
                  <select
                    id="booking-destination"
                    name="destination"
                    required
                    value={form.destination}
                    onChange={change}
                  >
                    <option value="">Select destination</option>
                    {mergeDestinationChoices(placeNames, [
                      form.destination,
                      defaults?.destination || '',
                    ]).map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div className="mrow">
                <div className="mfield">
                  <label htmlFor="booking-checkIn">Check-in Date</label>
                  <input
                    id="booking-checkIn"
                    name="checkIn"
                    type="date"
                    required
                    value={form.checkIn}
                    onChange={change}
                  />
                </div>
                <div className="mfield">
                  <label htmlFor="booking-checkOut">Check-out Date</label>
                  <input
                    id="booking-checkOut"
                    name="checkOut"
                    type="date"
                    required
                    min={form.checkIn || undefined}
                    value={form.checkOut}
                    onChange={change}
                  />
                </div>
              </div>
              <div className="mrow">
                <div className="mfield">
                  <label htmlFor="booking-children">Number of Children</label>
                  <select
                    id="booking-children"
                    name="children"
                    required
                    value={form.children}
                    onChange={change}
                  >
                    <option value="">Select</option>
                    {Array.from({ length: 12 }, (_, index) => (
                      <option key={index + 1}>{index + 1}</option>
                    ))}
                  </select>
                </div>
                <div className="mfield">
                  <label htmlFor="booking-youngestAge">Youngest child&apos;s age</label>
                  <select
                    id="booking-youngestAge"
                    name="youngestAge"
                    value={form.youngestAge}
                    onChange={change}
                  >
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
                  <label htmlFor="booking-nanniesNeeded">Nannies needed</label>
                  <select
                    id="booking-nanniesNeeded"
                    name="nanniesNeeded"
                    value={form.nanniesNeeded}
                    onChange={change}
                  >
                    {Array.from({ length: site.policies.maxNannies }, (_, index) => {
                      const count = String(index + 1)
                      return (
                        <option key={count} value={count}>
                          {count === '1' ? '1 nanny' : `${count} nannies`}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div className="mfield">
                  <label htmlFor="booking-tier">Nanny Tier</label>
                  <select
                    id="booking-tier"
                    name="tier"
                    value={form.tier}
                    onChange={change}
                  >
                    <option value="">Any tier</option>
                    {site.tiers.map((tier) => (
                      <option key={tier.code} value={tier.code}>
                        {tierOptionLabel(tier)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mfield" style={{ marginBottom: '1rem' }}>
                <label htmlFor="booking-careType">Care package</label>
                <select
                  id="booking-careType"
                  name="careType"
                  value={form.careType}
                  onChange={change}
                >
                  {careOptions.map((care) => (
                    <option key={care.code} value={care.code}>
                      {care.label}
                    </option>
                  ))}
                </select>
                <p className="modal-hint">
                  {careOptions.find((care) => care.code === form.careType)?.hint}
                </p>
              </div>
              {site.addons.some((addon) => addon.pricingMode === 'flat') && (
                <div className="mfield" style={{ marginBottom: '1rem' }}>
                  <label>Add-ons</label>
                  {site.addons
                    .filter((addon) => addon.pricingMode === 'flat' && addon.amountKes)
                    .map((addon) => (
                      <label
                        className="force-assign"
                        key={addon.code}
                        style={{ marginBottom: 8 }}
                      >
                        <input
                          type="checkbox"
                          checked={form.addonCodes.includes(addon.code)}
                          onChange={(e) =>
                            setForm((current) => ({
                              ...current,
                              addonCodes: e.target.checked
                                ? [...current.addonCodes, addon.code]
                                : current.addonCodes.filter(
                                    (code) => code !== addon.code,
                                  ),
                            }))
                          }
                        />
                        {addon.name} (+{formatKes(addon.amountKes || 0)})
                      </label>
                    ))}
                </div>
              )}
              <label className="force-assign" style={{ marginBottom: 14 }}>
                <input
                  type="checkbox"
                  checked={form.infantCare}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      infantCare: e.target.checked,
                      youngestAge:
                        e.target.checked && !f.youngestAge
                          ? 'Under 1 year'
                          : f.youngestAge,
                    }))
                  }
                />
                Infant care required (newborn / under 1 year)
              </label>
              <div className="quote-line">
                {form.checkIn && form.checkOut
                  ? quoteSummary(
                      quoteBooking({
                        checkIn: form.checkIn,
                        checkOut: form.checkOut,
                        careType: parseCareType(form.careType),
                        tier: form.tier,
                        nanniesNeeded: form.nanniesNeeded,
                        dailyRateKes: defaults?.dailyRateKes,
                        rates,
                        addonCodes: form.addonCodes,
                        maxNannies: site.policies.maxNannies,
                        strictRates: site.source === 'database',
                      }),
                      parseCareType(form.careType),
                      careOptions.find((care) => care.code === form.careType)?.label,
                    )
                  : 'Pick dates to see the estimate.'}
              </div>
              <div className="mfield" style={{ marginBottom: '1rem' }}>
                <label htmlFor="booking-notes">Special Requests / Notes</label>
                <input
                  id="booking-notes"
                  name="notes"
                  value={form.notes}
                  onChange={change}
                  placeholder="Allergies, sleep schedules, special needs…"
                />
              </div>
              {status === 'error' && (
                <p
                  style={{
                    color: '#ff8a8a',
                    fontSize: '0.82rem',
                    marginBottom: '0.7rem',
                  }}
                >
                  {error}
                </p>
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
