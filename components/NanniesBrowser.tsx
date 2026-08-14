'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PageShell from '@/components/PageShell'
import NannyCard from '@/components/NannyCard'
import BookingModal, { type BookingDefaults } from '@/components/BookingModal'
import { DESTINATIONS } from '@/lib/constants'
import type { Nanny } from '@/lib/types'

export default function NanniesBrowser({ initial }: { initial: Nanny[] }) {
  const params = useSearchParams()
  const router = useRouter()
  const [destination, setDestination] = useState(params.get('destination') || '')
  const [tier, setTier] = useState(params.get('tier') || '')
  const [q, setQ] = useState(params.get('q') || '')
  const [book, setBook] = useState<BookingDefaults | undefined>()
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    return initial.filter(n => {
      if (destination && !n.destinations.some(d => d.toLowerCase() === destination.toLowerCase())) return false
      if (tier && n.tier !== tier) return false
      if (q) {
        const hay = [n.display_name, n.bio, n.town, ...n.tags, ...n.languages].join(' ').toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [initial, destination, tier, q])

  function apply() {
    const next = new URLSearchParams()
    if (destination) next.set('destination', destination)
    if (tier) next.set('tier', tier)
    if (q) next.set('q', q)
    router.replace(`/nannies?${next.toString()}`)
  }

  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Browse</div>
        <h1>Find your <em>VacayNanny</em></h1>
        <p>Filter by destination and tier. Every profile is ID-verified and reference-checked before it goes live.</p>
      </section>
      <div className="sec-inner" style={{ paddingBottom: '4rem' }}>
        <div className="search-box" style={{ marginBottom: '2.5rem' }}>
          <div className="sf">
            <label>Destination</label>
            <select value={destination} onChange={e => setDestination(e.target.value)}>
              <option value="">Any destination</option>
              {DESTINATIONS.map(d => <option key={d}>{d}</option>)}
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
            <label>Search</label>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name, language, skill…" />
          </div>
          <button className="search-go" onClick={apply}>Filter →</button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '1.2rem', fontSize: '0.9rem' }}>
          {filtered.length} nann{filtered.length === 1 ? 'y' : 'ies'} available
        </p>
        <div className="nannies-grid">
          {filtered.map(n => (
            <NannyCard
              key={n.id}
              nanny={n}
              onBook={nn => {
                setBook({ nannyId: nn.id, nannyName: nn.display_name, destination: destination || nn.destinations[0], tier: nn.tier })
                setOpen(true)
              }}
            />
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="form-card" style={{ textAlign: 'center' }}>
            <h3>No matches yet</h3>
            <p style={{ color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>Try another destination or send a booking request and we&apos;ll match you manually.</p>
          </div>
        )}
      </div>
      <BookingModal open={open} onClose={() => setOpen(false)} defaults={book} />
    </PageShell>
  )
}
