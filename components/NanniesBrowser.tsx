'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import PageShell from '@/components/PageShell'
import NannyCard from '@/components/NannyCard'
import BookingModal, { type BookingDefaults } from '@/components/BookingModal'
import CareIcon from '@/components/CareIcon'
import Reveal from '@/components/Reveal'
import { CERTIFICATION_FILTERS, filterNannies } from '@/lib/match'
import { useSiteCatalog } from '@/components/SiteCatalogProvider'
import { tierOptionLabel, tierRateMap } from '@/lib/catalog'
import { publicDailyRate, publicTier } from '@/lib/safeguarding'
import type { Nanny } from '@/lib/types'
import styles from './NanniesBrowser.module.css'

export default function NanniesBrowser({
  initial,
  destinations,
  kenyaNames,
  busyIds,
}: {
  initial: Nanny[]
  destinations: string[]
  kenyaNames: string[]
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
  const [pending, startTransition] = useTransition()
  const site = useSiteCatalog()
  const rates = tierRateMap(site.tiers)
  const appliedDestination = params.get('destination') || ''
  const appliedCheckIn = params.get('checkIn') || ''
  const appliedCheckOut = params.get('checkOut') || ''
  const hasFilters = [
    'destination',
    'tier',
    'q',
    'infant',
    'cert',
    'checkIn',
    'checkOut',
  ].some((key) => params.get(key))
  const filtered = useMemo(
    () =>
      filterNannies(initial, {
        checkIn: appliedCheckIn,
        checkOut: appliedCheckOut,
        destination: appliedDestination,
        tier: params.get('tier') || '',
        q: params.get('q') || '',
        infant: params.get('infant') === '1',
        cert: params.get('cert') || '',
        busyIds: appliedCheckIn && appliedCheckOut ? busyIds : [],
        kenyaDestinations: kenyaNames,
      }),
    [
      initial,
      params,
      appliedDestination,
      appliedCheckIn,
      appliedCheckOut,
      busyIds,
      kenyaNames,
    ],
  )

  function apply(event: React.FormEvent) {
    event.preventDefault()
    const next = new URLSearchParams()
    if (destination) next.set('destination', destination)
    if (tier) next.set('tier', tier)
    if (q.trim()) next.set('q', q.trim())
    if (infant) next.set('infant', '1')
    if (cert) next.set('cert', cert)
    if (checkIn) next.set('checkIn', checkIn)
    if (checkOut) next.set('checkOut', checkOut)
    startTransition(() =>
      router.replace(`/nannies${next.size ? `?${next}` : ''}`, { scroll: false }),
    )
  }
  function reset() {
    setDestination('')
    setTier('')
    setQ('')
    setInfant(false)
    setCert('')
    setCheckIn('')
    setCheckOut('')
    startTransition(() => router.replace('/nannies', { scroll: false }))
  }
  function requestHelp() {
    setBook({
      destination: appliedDestination,
      checkIn: appliedCheckIn,
      checkOut: appliedCheckOut,
      infantCare: params.get('infant') === '1',
    })
    setOpen(true)
  }

  return (
    <PageShell>
      <main className={styles.page}>
        <Reveal className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Good care. More holiday.</p>
            <h1>
              A familiar face,
              <br />a little <em>peace of mind.</em>
            </h1>
            <p>
              Find someone who fits your family. Explore their experience, get to know
              their approach and make room for a holiday you can all enjoy.
            </p>
          </div>
          <div className={styles.reassurance}>
            <CareIcon kind="heart" />
            <p>
              A thoughtful match starts with you.
              <span>
                Tell us about your children, your plans and the care that would make a
                difference.
              </span>
            </p>
          </div>
        </Reveal>
        <div className={styles.layout}>
          <form className={styles.filters} onSubmit={apply} aria-label="Find your nanny">
            <div className={styles.filterHeading}>
              <h2>Your family, your plans</h2>
              <button type="button" onClick={reset}>
                Reset
              </button>
            </div>
            <label>
              <span>Destination</span>
              <select
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              >
                <option value="">Any destination</option>
                {destinations.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <div className={styles.dates}>
              <label>
                <span>Check-in</span>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(event) => setCheckIn(event.target.value)}
                />
              </label>
              <label>
                <span>Check-out</span>
                <input
                  type="date"
                  min={checkIn || undefined}
                  value={checkOut}
                  onChange={(event) => setCheckOut(event.target.value)}
                />
              </label>
            </div>
            <label>
              <span>Care tier</span>
              <select value={tier} onChange={(event) => setTier(event.target.value)}>
                <option value="">Any tier</option>
                {site.tiers.map((option) => (
                  <option key={option.code} value={option.code}>
                    {tierOptionLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Infant care</span>
              <select
                value={infant ? '1' : ''}
                onChange={(event) => setInfant(event.target.value === '1')}
              >
                <option value="">Any age</option>
                <option value="1">Infant / newborn required</option>
              </select>
            </label>
            <label>
              <span>Certification</span>
              <select value={cert} onChange={(event) => setCert(event.target.value)}>
                <option value="">Any certification</option>
                {CERTIFICATION_FILTERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>A name, language or skill</span>
              <input
                type="search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Try Swahili or creative play"
              />
            </label>
            <button
              className={`btn-coral ${styles.submit}`}
              type="submit"
              disabled={pending}
            >
              {pending ? 'Finding your match…' : 'Show my matches'}{' '}
              <span aria-hidden="true">→</span>
            </button>
            <p className={styles.filterNote}>
              Care is confirmed after your request has been reviewed and the match
              accepted.
            </p>
          </form>
          <section
            className={styles.results}
            aria-labelledby="nanny-results-title"
            aria-busy={pending}
          >
            <div className={styles.resultsHeading}>
              <div>
                <p className={styles.eyebrow}>Meet your next extra pair of hands</p>
                <h2 id="nanny-results-title">
                  {appliedDestination || 'Our nanny community'}
                </h2>
              </div>
              <p role="status">
                {filtered.length} {filtered.length === 1 ? 'profile' : 'profiles'} to
                explore
              </p>
            </div>
            {hasFilters && (
              <div className={styles.applied}>
                <span>
                  {[
                    appliedDestination,
                    params.get('tier')
                      ? `${site.tiers.find((t) => t.code === params.get('tier'))?.label || params.get('tier')} care`
                      : '',
                    params.get('infant') === '1' ? 'Infant care' : '',
                    params.get('cert')
                      ? CERTIFICATION_FILTERS.find((c) => c.id === params.get('cert'))
                          ?.label
                      : '',
                    params.get('q'),
                    appliedCheckIn && appliedCheckOut
                      ? `${appliedCheckIn} – ${appliedCheckOut}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <button onClick={reset}>
                  Clear filters <span aria-hidden="true">×</span>
                </button>
              </div>
            )}
            {filtered.length > 0 ? (
              <div className={styles.grid}>
                {filtered.map((nanny) => (
                  <NannyCard
                    key={nanny.id}
                    nanny={nanny}
                    onBook={(selected) => {
                      setBook({
                        nannyId: selected.id,
                        nannyName: selected.display_name,
                        destination: appliedDestination || selected.destinations[0],
                        tier: publicTier(selected),
                        dailyRateKes: publicDailyRate(selected, rates),
                        checkIn: appliedCheckIn,
                        checkOut: appliedCheckOut,
                        infantCare: params.get('infant') === '1',
                      })
                      setOpen(true)
                    }}
                  />
                ))}
                <aside
                  className={`${styles.help} ${filtered.length > 1 ? styles.helpWide : ''}`}
                >
                  <CareIcon kind="sun" />
                  <div>
                    <p className={styles.eyebrow}>A little help choosing?</p>
                    <h3>
                      We&apos;ll get to know
                      <br />
                      your kind of family.
                    </h3>
                    <p>
                      Share the little things that matter. We&apos;ll help you find care
                      that feels right for your children and your plans.
                    </p>
                  </div>
                  <button className="btn-ghost" onClick={requestHelp}>
                    Help me find a nanny <span aria-hidden="true">↗</span>
                  </button>
                </aside>
              </div>
            ) : (
              <div className={styles.empty}>
                <CareIcon kind="people" />
                <h3>Let&apos;s find another way.</h3>
                <p>
                  There isn&apos;t a profile matching these details yet. Try fewer
                  filters, or tell us what you need and we&apos;ll help with the next
                  step.
                </p>
                <div>
                  <button className="btn-coral" onClick={requestHelp}>
                    Request a match <span aria-hidden="true">↗</span>
                  </button>
                  <button className={styles.clearButton} onClick={reset}>
                    Clear filters
                  </button>
                </div>
              </div>
            )}
            <div className={styles.bottomNote}>
              <CareIcon kind="leaf" />
              <p>
                A little more reassurance?{' '}
                <Link href="/#how">Here&apos;s how matching works</Link>, from your first
                request to the start of care.
              </p>
            </div>
          </section>
        </div>
      </main>
      <BookingModal
        open={open}
        onClose={() => setOpen(false)}
        defaults={book}
        destinations={destinations}
      />
    </PageShell>
  )
}
