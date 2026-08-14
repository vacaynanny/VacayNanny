'use client'

import { useState } from 'react'
import Link from 'next/link'
import PageShell from '@/components/PageShell'
import BookingModal from '@/components/BookingModal'
import { tierClass, tierLabel } from '@/lib/constants'
import type { Nanny, Review } from '@/lib/types'

export default function NannyProfile({ nanny, reviews }: { nanny: Nanny; reviews: Review[] }) {
  const [open, setOpen] = useState(false)
  return (
    <PageShell bookDefaults={{ nannyId: nanny.id, nannyName: nanny.display_name, destination: nanny.destinations[0], tier: nanny.tier }}>
      <section className="page-hero" style={{ paddingBottom: 24 }}>
        <Link href="/nannies" className="nav-back" style={{ justifyContent: 'center', marginBottom: 16 }}>← All nannies</Link>
        <h1>{nanny.display_name}</h1>
        <p>{[nanny.town, nanny.county].filter(Boolean).join(', ')} · {nanny.destinations.join(', ')}</p>
      </section>
      <div className="sec-inner profile-layout">
        <div className="profile-main">
          <div className="profile-photo form-card" style={{ padding: 0, overflow: 'hidden' }}>
            <img src={nanny.photo_url || '/images/top-right.png'} alt={nanny.display_name} style={{ width: '100%', height: 360, objectFit: 'cover', display: 'block' }} />
          </div>
          <div className="form-card">
            <h3>About</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>{nanny.bio || 'Profile bio coming soon.'}</p>
          </div>
          <div className="form-card">
            <h3>Skills & care</h3>
            <div className="nc-tags" style={{ marginBottom: 12 }}>
              {nanny.tags.map(t => <span className="nc-tag" key={t}>{t}</span>)}
            </div>
            <div className="review-row"><span className="review-key">Languages</span><span className="review-val">{nanny.languages.join(', ') || '—'}</span></div>
            <div className="review-row"><span className="review-key">Age groups</span><span className="review-val">{nanny.age_groups.join(', ') || '—'}</span></div>
            <div className="review-row"><span className="review-key">Services</span><span className="review-val">{nanny.services.join(', ') || '—'}</span></div>
            <div className="review-row"><span className="review-key">Certifications</span><span className="review-val">{nanny.certifications.join(', ') || '—'}</span></div>
            <div className="review-row"><span className="review-key">Available days</span><span className="review-val">{nanny.available_days.join(', ') || 'Flexible'}</span></div>
            <div className="review-row"><span className="review-key">Travel</span><span className="review-val">{nanny.willing_to_travel || '—'}</span></div>
          </div>
          {reviews.length > 0 && (
            <div className="form-card">
              <h3>Family reviews</h3>
              {reviews.map(r => (
                <div key={r.id} style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: 'var(--gold)', marginBottom: 6 }}>{'★'.repeat(r.rating)}</div>
                  <p style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{r.body}</p>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>{r.parent_name}{r.trip_label ? ` · ${r.trip_label}` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <aside className="profile-aside form-card">
          <span className={`tier-pill ${tierClass(nanny.tier)}`}>{tierLabel(nanny.tier)}</span>
          <div className="price-big" style={{ margin: '16px 0 4px' }}><sup>KES</sup>{nanny.daily_rate_kes.toLocaleString('en-KE')}<sub>/day</sub></div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', marginBottom: 16 }}>8-hour shift · 2-hour replacement guarantee</p>
          <div className="nc-stars" style={{ marginBottom: 20 }}>
            <span>{'★'.repeat(Math.round(nanny.rating_avg || 5))}</span> {nanny.rating_avg.toFixed(1)} ({nanny.review_count} reviews)
          </div>
          <button className="btn-submit" style={{ width: '100%' }} onClick={() => setOpen(true)}>Book {nanny.display_name.split(' ')[0]} →</button>
        </aside>
      </div>
      <BookingModal
        open={open}
        onClose={() => setOpen(false)}
        defaults={{ nannyId: nanny.id, nannyName: nanny.display_name, destination: nanny.destinations[0], tier: nanny.tier }}
      />
    </PageShell>
  )
}
