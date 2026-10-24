'use client'

import { useState } from 'react'
import MediaImage from '@/components/MediaImage'
import Link from 'next/link'
import PageShell from '@/components/PageShell'
import BookingModal from '@/components/BookingModal'
import { tierClass, tierLabel } from '@/lib/constants'
import { useSiteCatalog } from '@/components/SiteCatalogProvider'
import { tierLabels, tierRateMap } from '@/lib/catalog'
import { publicDailyRate, publicTier } from '@/lib/safeguarding'
import type { Nanny, Review } from '@/lib/types'

function chips(items: string[]) {
  return items.map(item => item.trim()).filter(Boolean)
}

export default function NannyProfile({
  nanny,
  reviews,
  destinations,
}: {
  nanny: Nanny
  reviews: Review[]
  destinations: string[]
}) {
  const [open, setOpen] = useState(false)
  const site = useSiteCatalog()
  const shownTier = publicTier(nanny)
  const rate = publicDailyRate(nanny, tierRateMap(site.tiers))
  const label = tierLabel(shownTier, tierLabels(site.tiers))
  const firstName = nanny.display_name.split(' ')[0] || nanny.display_name
  const place = [nanny.town, nanny.county].filter(Boolean).join(', ')
  const spots = chips(nanny.destinations)
  const where = [place, spots.join(' · ')].filter(Boolean).join(' · ')
  const reviewed = nanny.review_count > 0
  const stars = Math.min(5, Math.max(1, Math.round(nanny.rating_avg || 0)))
  const facts = [
    { label: 'Languages', items: chips(nanny.languages) },
    { label: 'Age groups', items: chips(nanny.age_groups) },
    { label: 'Services', items: chips(nanny.services) },
    { label: 'Certifications', items: chips(nanny.certifications) },
    { label: 'Available days', items: chips(nanny.available_days) },
    { label: 'Travel', items: chips(nanny.willing_to_travel ? [nanny.willing_to_travel] : []) },
  ].filter(fact => fact.items.length > 0)
  const tags = chips(nanny.tags)

  return (
    <PageShell bookDefaults={{ nannyId: nanny.id, nannyName: nanny.display_name, destination: nanny.destinations[0], tier: shownTier, dailyRateKes: rate }}>
      <article className="nanny-page">
        <Link href="/nannies" className="nav-back">← All nannies</Link>
        <div className="nanny-stage">
          <div className="nanny-portrait">
            <MediaImage
              src={nanny.photo_url || '/images/top-right.png'}
              alt={nanny.display_name}
              fill
              sizes="(max-width: 860px) 100vw, 420px"
              style={{ objectFit: 'cover', objectPosition: 'center 18%' }}
            />
            <span className={`tier-pill ${tierClass(shownTier)}`}>{label}</span>
          </div>
          <div className="nanny-copy">
            <h1>{nanny.display_name}</h1>
            {where && <p className="nanny-place">{where}</p>}
            {tags.length > 0 && (
              <div className="nanny-chips">
                {tags.map(tag => <span key={tag}>{tag}</span>)}
              </div>
            )}
            <p className="nanny-bio">
              {nanny.bio?.trim() || `${firstName} is a ${label.toLowerCase()} nanny on VacayNanny. A longer bio will be added as the profile is completed.`}
            </p>
            <div className="nanny-book">
              <p className="nanny-rate"><sup>KES</sup> {rate.toLocaleString('en-KE')} <small>/day</small></p>
              <p className="nanny-shift">{site.policies.standardShiftHours}-hour shift · {site.policies.replacementSlaHours}-hour replacement guarantee</p>
              {reviewed ? (
                <p className="nanny-rating"><span>{'★'.repeat(stars)}</span> {nanny.rating_avg.toFixed(1)} · {nanny.review_count} {nanny.review_count === 1 ? 'review' : 'reviews'}</p>
              ) : (
                <p className="nanny-rating">No family reviews yet</p>
              )}
              <button className="btn-submit" type="button" onClick={() => setOpen(true)}>Book {firstName} →</button>
            </div>
          </div>
        </div>

        {facts.length > 0 && (
          <section className="nanny-facts" aria-label="Skills and care">
            {facts.map(fact => (
              <div key={fact.label}>
                <h2>{fact.label}</h2>
                <div className="nanny-chips">
                  {fact.items.map(item => <span key={item}>{item}</span>)}
                </div>
              </div>
            ))}
          </section>
        )}

        {reviews.length > 0 && (
          <section className="nanny-reviews" aria-label="Family reviews">
            <h2>Family reviews</h2>
            {reviews.map(review => (
              <blockquote key={review.id}>
                <p className="nanny-rating"><span>{'★'.repeat(Math.min(5, Math.max(1, review.rating)))}</span></p>
                <p>{review.body}</p>
                <footer>{review.parent_name}{review.trip_label ? ` · ${review.trip_label}` : ''}</footer>
              </blockquote>
            ))}
          </section>
        )}
      </article>
      <BookingModal
        open={open}
        onClose={() => setOpen(false)}
        defaults={{ nannyId: nanny.id, nannyName: nanny.display_name, destination: nanny.destinations[0], tier: shownTier, dailyRateKes: rate }}
        destinations={destinations}
      />
    </PageShell>
  )
}
