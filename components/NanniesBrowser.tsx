'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PageShell from '@/components/PageShell'
import NannyCard from '@/components/NannyCard'
import BookingModal, { type BookingDefaults } from '@/components/BookingModal'
import { CERTIFICATION_FILTERS, filterNannies } from '@/lib/match'
import type { Nanny } from '@/lib/types'

export default function NanniesBrowser({
  initial,
  destinations,
  busyIds,
}: {
  initial: Nanny[]
  destinations: string[]
  busyIds: string[]
}) {
  const params = useSearchParams()
  const router = useRouter()
  const [destination, setDestination] = useState(params.get('destination') || '')
  const [tier, setTier] = useState(params.get('tier') || '')
  const [q, setQ] = useState(params.get('q') || '')
  const [infant, setInfant] = useState(params.get('infant') === '1')
  const [cert, setCert] = useState(params.get('cert') || '')
  const [checkIn, setCheckIn] = useState(params.get('checkIn') || '')
  const [checkOut, setCheckOut] = useState(params.get('checkOut') || '')
  const [book, setBook] = useState<BookingDefaults | undefined>()
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    return filterNannies(initial, {
      destination,
      tier,
      q,
      infant,
      cert,
      busyIds: checkIn && checkOut ? busyIds : [],
    })
  }, [initial, destination, tier, q, infant, cert, checkIn, checkOut, busyIds])

  function apply() {
    const next = new URLSearchParams()
    if (destination) next.set('destination', destination)
    if (tier) next.set('tier', tier)
    if (q) next.set('q', q)
    if (infant) next.set('infant', '1')
    if (cert) next.set('cert', cert)
    if (checkIn) next.set('checkIn', checkIn)
    if (checkOut) next.set('checkOut', checkOut)
    router.replace(`/nannies?${next.toString()}`)
  }

  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Browse</div>
        <h1>Find your <em>VacayNanny</em></h1>
        <p>Filter by destination, dates, infant care, and certification. Every profile is ID-verified and reference-checked before it goes live.</p>
      </section>
      <div className="sec-inner" style={{ paddingBottom: '4rem' }}>
        <div className="search-box nanny-search">
          <div className="sf">
            <label>Destination</label>
            <select value={destination} onChange={e => setDestination(e.target.value)}>
              <option value="">Any destination</option>
              {destinations.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="sf">
            <label>Tier</label>
            <select value={tier} onChange={e => setTier(e.target.value)}>
              <option value="">Any tier</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold (Elite)</option>
            </select>
          </div>
          <div className="sf">
            <label>Infant care</label>
            <select value={infant ? '1' : ''} onChange={e => setInfant(e.target.value === '1')}>
              <option value="">Any age</option>
              <option value="1">Infant / newborn required</option>
            </select>
          </div>
          <div className="sf">
            <label>Certification</label>
            <select value={cert} onChange={e => setCert(e.target.value)}>
              <option value="">Any certification</option>
              {CERTIFICATION_FILTERS.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="sf">
            <label>Check-in</label>
            <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
          </div>
          <div className="sf">
            <label>Check-out</label>
            <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
          </div>
          <div className="sf">
            <label>Search</label>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name, language, skill…" />
          </div>
          <button className="search-go" onClick={apply}>Filter →</button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.45)', margin: '1.2rem 0', fontSize: '0.9rem' }}>
          {filtered.length} nann{filtered.length === 1 ? 'y' : 'ies'} available
          {checkIn && checkOut ? ' on those dates' : ''}
          {infant ? ' with infant care' : ''}
        </p>
        <div className="nannies-grid">
          {filtered.map(n => (
            <NannyCard
              key={n.id}
              nanny={n}
              onBook={nn => {
                setBook({
                  nannyId: nn.id,
                  nannyName: nn.display_name,
                  destination: destination || nn.destinations[0],
                  tier: nn.tier,
                  checkIn,
                  checkOut,
                  infantCare: infant,
                })
                setOpen(true)
              }}
            />
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="form-card" style={{ textAlign: 'center' }}>
            <h3>No matches yet</h3>
            <p style={{ color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>Try another destination, drop a filter, or send a booking request and we&apos;ll auto-match someone who fits.</p>
          </div>
        )}
      </div>
      <BookingModal open={open} onClose={() => setOpen(false)} defaults={book} destinations={destinations} />
    </PageShell>
  )
}
