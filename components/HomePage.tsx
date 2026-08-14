'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import WAFloat from '@/components/WAFloat'
import BookingModal, { type BookingDefaults } from '@/components/BookingModal'
import NannyCard from '@/components/NannyCard'
import { DESTINATIONS } from '@/lib/constants'
import { destinationNannyCount } from '@/lib/data'
import type { Destination, Nanny, Review } from '@/lib/types'

function OceanCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let t = 0
    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)
    function drawWave(yBase: number, amp: number, freq: number, speed: number, r: number, g: number, b: number, alpha: number) {
      ctx.beginPath()
      ctx.moveTo(0, canvas!.height)
      for (let x = 0; x <= canvas!.width; x += 4) {
        const y = yBase + Math.sin(x * freq + t * speed) * amp + Math.sin(x * freq * 0.7 + t * speed * 1.3 + 1) * amp * 0.55
        ctx.lineTo(x, y)
      }
      ctx.lineTo(canvas!.width, canvas!.height)
      ctx.closePath()
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
      ctx.fill()
    }
    function draw() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      const h = canvas!.height
      drawWave(h * 0.72, 22, 0.008, 0.6, 45, 125, 111, 0.10)
      drawWave(h * 0.78, 16, 0.012, 0.8, 26, 46, 53, 0.12)
      drawWave(h * 0.82, 12, 0.016, 1.0, 45, 125, 111, 0.09)
      drawWave(h * 0.87, 8, 0.020, 1.2, 26, 46, 53, 0.08)
      drawWave(h * 0.91, 5, 0.025, 1.4, 2, 12, 20, 0.18)
      t += 0.012
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas ref={canvasRef} id="ocean-bg" />
}

const FAQS = [
  {
    q: 'Are your nannies background-checked?',
    a: 'Yes. Every nanny on VacayNanny undergoes a <strong>multi-layer vetting process</strong> including national ID verification, police clearance certificate (CoGC), reference checks, and an in-person or video interview. Gold-tier nannies also complete a safeguarding training module.',
  },
  {
    q: 'How far in advance should I book?',
    a: 'We recommend booking at least <strong>72 hours ahead</strong> for standard placements. For peak season (December–January, Easter, August) please book 1–2 weeks in advance to guarantee your preferred tier.',
  },
  {
    q: "What happens if my nanny can't make it on the day?",
    a: 'We guarantee a <strong>replacement nanny</strong> within 2 hours or your booking fee is fully refunded. Our coverage team monitors all active placements.',
  },
  {
    q: 'Do nannies travel with us to other countries?',
    a: 'Yes! Our <strong>Gold-tier (Elite) nannies</strong> are passport-holders experienced in international travel. Travel arrangements (flights, accommodation) are at the client\'s expense. See our T&Cs for details.',
  },
  {
    q: 'What are the nanny working hours?',
    a: 'Standard shifts are <strong>8 hours</strong>. Extended shifts (up to 12 hours) and overnight care are available as add-ons. All hours beyond the package limit are charged at an agreed hourly rate.',
  },
  {
    q: 'Can I request the same nanny for multiple days?',
    a: 'Absolutely. When you book recurring days, we <strong>prioritise continuity</strong> so your children have a consistent carer. Specify this preference in the booking notes.',
  },
  {
    q: 'Are nannies trained in first aid?',
    a: 'All <strong>Silver and Gold nannies</strong> hold a valid paediatric first-aid certificate. Bronze nannies have basic first-aid knowledge. You can filter by certification on the <a href="/nannies">search page</a>.',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Full refund if cancelled <strong>48+ hours</strong> before the start time. 50% refund within 24–48 hours. No refund for cancellations under 24 hours except in cases of verified emergency.',
  },
  {
    q: 'Can nannies handle infants?',
    a: 'Yes. Indicate <strong>"Infant care"</strong> as a required skill when booking and we\'ll match you with a nanny who holds relevant newborn/infant experience certificates. Infant care is available across all tiers but most experienced at Silver+.',
  },
  {
    q: 'How are nannies paid?',
    a: 'All payments go through <strong>VacayNanny\'s secure platform</strong> — never directly to the nanny. This protects both parties and ensures our quality guarantee applies. Nannies receive timely payouts after each completed booking.',
  },
  {
    q: 'Is VacayNanny available outside Kenya?',
    a: 'Currently we operate primarily in <strong>Kenya\'s major tourism corridors</strong> (Diani, Malindi, Watamu, Nairobi, Mombasa, Lamu, and the national parks). We\'re expanding to Zanzibar, Rwanda, and South Africa — <a href="/waitlist">join the waitlist</a>.',
  },
]

export default function HomePage({
  nannies,
  destinations,
  reviews,
}: {
  nannies: Nanny[]
  destinations: Destination[]
  reviews: Review[]
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [bookDefaults, setBookDefaults] = useState<BookingDefaults>({})
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [pricingHover, setPricingHover] = useState(false)
  const [search, setSearch] = useState({ destination: '', checkIn: '', checkOut: '', tier: '' })

  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          obs.unobserve(e.target)
        }
      })
    }, { threshold: 0.12 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  function openBook(defaults?: BookingDefaults) {
    setBookDefaults(defaults || {})
    setModalOpen(true)
  }

  function goSearch() {
    const params = new URLSearchParams()
    if (search.destination) params.set('destination', search.destination)
    if (search.tier) params.set('tier', search.tier)
    if (search.checkIn) params.set('checkIn', search.checkIn)
    if (search.checkOut) params.set('checkOut', search.checkOut)
    router.push(`/nannies${params.toString() ? `?${params}` : ''}`)
  }

  const featured = nannies.slice(0, 6)

  return (
    <>
      <OceanCanvas />
      <div className="site-wrap">
        <Nav onBook={() => openBook()} variant="home" />

        <section className="hero">
          <div className="hero-bg" />
          <div className="hero-pill-badge">
            <span className="hero-pill-star">★</span> Every nanny vetted &amp; certified
          </div>
          <div className="hero-glass-badge">
            <div className="hgb-star-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <defs>
                  <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F5C24B" />
                    <stop offset="100%" stopColor="#FFB84C" />
                  </linearGradient>
                </defs>
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="url(#starGrad)" stroke="#E8A020" strokeWidth="0.5" />
              </svg>
            </div>
            <div>
              <div className="hgb-title">Vetted &amp; Certified</div>
              <div className="hgb-sub">Your child is in safe hands</div>
            </div>
          </div>
          <div className="hero-text">
            <span className="hero-eyebrow">✦ Trusted childcare across East Africa &amp; beyond</span>
            <h1>Trusted Holiday Nannies,<br /><em>Wherever You Travel</em></h1>
            <p className="hero-sub">
              Every nanny is ID-verified, reference-checked, and first-aid certified. Available in Mombasa, Zanzibar, Nairobi and beyond.
            </p>
            <div className="hero-actions">
              <a href="#search" className="btn-coral">Find a Nanny</a>
              <a href="#how" className="btn-ghost">How It Works</a>
            </div>
            <p className="hero-trust-line">Police-cleared &nbsp;·&nbsp; Reference verified &nbsp;·&nbsp; First-aid certified</p>
            <div className="hero-stats">
              <div><div className="stat-num">{nannies.length}+</div><div className="stat-lbl">Vetted Nannies</div></div>
              <div><div className="stat-num">{destinations.length}</div><div className="stat-lbl">Destinations</div></div>
              <div><div className="stat-num">100%</div><div className="stat-lbl">Vetted &amp; Insured</div></div>
            </div>
          </div>
        </section>

        <div className="trust-strip">
          <span className="trust-strip-label">Why families trust us</span>
          <div className="trust-strip-items">
            <span className="trust-strip-item">Police-Cleared Nannies</span>
            <span className="trust-strip-sep">·</span>
            <span className="trust-strip-item">Paediatric First Aid</span>
            <span className="trust-strip-sep">·</span>
            <span className="trust-strip-item">2-Hour Replacement Guarantee</span>
            <span className="trust-strip-sep">·</span>
            <span className="trust-strip-item">Insured & Bonded</span>
            <span className="trust-strip-sep">·</span>
            <span className="trust-strip-item">Multilingual Carers</span>
          </div>
        </div>

        <section className="sec sec-search" id="search">
          <div className="sec-inner">
            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              <div className="sec-label">Find Your Match</div>
              <h2 className="sec-title">Search <em>Available Nannies</em></h2>
            </div>
            <div className="search-box">
              <div className="sf">
                <label>Destination</label>
                <select value={search.destination} onChange={e => setSearch(s => ({ ...s, destination: e.target.value }))}>
                  <option value="">Any destination</option>
                  {DESTINATIONS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="sf">
                <label>Check-in</label>
                <input type="date" value={search.checkIn} onChange={e => setSearch(s => ({ ...s, checkIn: e.target.value }))} />
              </div>
              <div className="sf">
                <label>Check-out</label>
                <input type="date" value={search.checkOut} onChange={e => setSearch(s => ({ ...s, checkOut: e.target.value }))} />
              </div>
              <div className="sf">
                <label>Nanny Tier</label>
                <select value={search.tier} onChange={e => setSearch(s => ({ ...s, tier: e.target.value }))}>
                  <option value="">Any tier</option>
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold (Elite)</option>
                </select>
              </div>
              <button className="search-go" onClick={goSearch}>Search →</button>
            </div>
          </div>
        </section>

        <section className="sec sec-how" id="how">
          <div className="sec-inner">
            <div className="reveal">
              <div className="sec-label">Simple Process</div>
              <h2 className="sec-title">How It <em>Works</em></h2>
              <p className="sec-sub">From search to seaside — we make holiday childcare effortless in four steps.</p>
            </div>
            <div className="process-row reveal">
              {[
                ['Step 1', 'Search & Filter', '/images/step-1.png', 'Search on app'],
                ['Step 2', 'Choose Your Nanny', '/images/step-2.png', 'Choose nanny'],
                ['Step 3', 'Secure Booking', '/images/step-3.png', 'Book securely'],
                ['Step 4', 'Enjoy Your Holiday', '/images/step-4.png', 'Enjoy holiday'],
              ].flatMap(([label, title, src, alt], i) => [
                i > 0 ? <div className="process-arrow" key={`a${i}`}>→</div> : null,
                <div className="process-step" key={title}>
                  <div className="process-step-label">{label}</div>
                  <div className="process-step-title">{title}</div>
                  <img src={src} alt={alt} className="process-phone-image" />
                </div>,
              ])}
            </div>
          </div>
        </section>

        <section className="sec sec-life">
          <div className="sec-inner">
            <div className="reveal">
              <div className="sec-label">The VacayNanny Life</div>
              <h2 className="sec-title">Moments You <em>Deserve</em></h2>
              <p className="sec-sub">While your children are safe and happy, you get to live the holiday you imagined.</p>
            </div>
            <div className="life-grid reveal">
              <div className="life-tile big">
                <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop" alt="Beach sunset" />
                <div className="life-shade" /><div className="life-info"><div className="life-title">Sunset Strolls</div><div className="life-sub">Diani Beach, Kenya</div></div>
                <div className="life-tag">Popular</div>
              </div>
              {[
                ['https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&auto=format&fit=crop', 'Spa', 'Spa & Wellness', 'Full day, uninterrupted'],
                ['https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=600&auto=format&fit=crop', 'Fine dining', 'Fine Dining', 'Table for two, finally'],
                ['https://images.unsplash.com/photo-1516426122078-c23e76319801?w=600&auto=format&fit=crop', 'Safari', 'Safari Adventure', 'Masai Mara awaits'],
                ['https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop', 'Water sports', 'Water Sports', 'Kitesurfing, diving & more'],
              ].map(([src, alt, title, sub]) => (
                <div className="life-tile" key={title}>
                  <img src={src} alt={alt} />
                  <div className="life-shade" /><div className="life-info"><div className="life-title">{title}</div><div className="life-sub">{sub}</div></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec sec-nannies" id="nannies">
          <div className="sec-inner">
            <div className="reveal">
              <div className="sec-label">Our Team</div>
              <h2 className="sec-title">Meet Our <em>Nannies</em></h2>
              <p className="sec-sub">Every nanny is vetted, trained, and passionate about giving children the best holiday experience.</p>
            </div>
            <div className="nannies-grid reveal">
              {featured.map(n => (
                <NannyCard key={n.id} nanny={n} onBook={nn => openBook({ nannyId: nn.id, nannyName: nn.display_name, destination: nn.destinations[0], tier: nn.tier })} />
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <Link href="/nannies" className="btn-ghost">Browse all nannies →</Link>
            </div>
          </div>
        </section>

        <section className="sec sec-pricing" id="pricing">
          <div className="sec-inner">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <div className="sec-label">Transparent Pricing</div>
              <h2 className="sec-title">Choose Your <em>Tier</em></h2>
              <p className="sec-sub" style={{ margin: '0.9rem auto 0' }}>All plans include our 2-hour replacement guarantee and 24/7 parent support.</p>
            </div>
            <div
              className={`pricing-grid reveal${pricingHover ? ' has-hover' : ''}`}
              onMouseEnter={() => setPricingHover(true)}
              onMouseLeave={() => setPricingHover(false)}
            >
              {[
                { cls: 'bronze', pill: 'ENTRY', rank: 'Tier 01', name: 'Bronze', desc: 'Reliable, caring nannies for straightforward childcare needs.', price: '2,200', period: '8-hour shift · 1–2 children', feats: ['Background-checked nanny', 'Basic first-aid trained', 'Ages 3–14 care', 'Single-property coverage', 'WhatsApp parent updates', '2-hour replacement guarantee'], cta: 'Get Started', tier: 'bronze' },
                { cls: 'silver', pill: 'POPULAR', rank: 'Tier 02', name: 'Silver', desc: 'Enhanced care with certified skills for growing families.', price: '3,200', period: '8-hour shift · Up to 3 children', feats: ['Everything in Bronze', 'Paediatric First Aid cert.', 'Infant & toddler care', 'Basic tutoring / homework', 'Swimming supervision', 'Bilingual (English + Swahili)'], cta: 'Choose Silver', tier: 'silver' },
                { cls: 'gold', pill: 'ELITE', rank: 'Tier 03', name: 'Gold', desc: 'Premium international-standard care for discerning families.', price: '5,200', period: '8-hour shift · Up to 4 children', feats: ['Everything in Silver', 'Newborn & special-needs care', 'Passport-holder · Can travel abroad', 'Montessori / early education', 'Multilingual (3+ languages)', 'Overnight care available'], cta: 'Go Elite →', tier: 'gold' },
              ].map(p => (
                <div className={`price-card ${p.cls}`} key={p.name}>
                  <div className="medal-stripe" />
                  <span className="tier-pill-top">{p.pill}</span>
                  <div className="price-rank">{p.rank}</div>
                  <div className="price-name">{p.name}</div>
                  <div className="price-desc">{p.desc}</div>
                  <div className="price-divider" />
                  <div className="price-big"><sup>KES</sup>{p.price}<sub>/day</sub></div>
                  <div className="price-period">{p.period}</div>
                  <ul className="price-feats">{p.feats.map(f => <li key={f}>{f}</li>)}</ul>
                  <button className="price-btn" onClick={() => openBook({ tier: p.tier })}>{p.cta}</button>
                </div>
              ))}
            </div>
            <div className="addons reveal">
              <h3>Optional Add-ons</h3>
              <div className="addon-chips">
                {[
                  ['Extended shift (12 hrs)', '+KES 1,200'],
                  ['Overnight care', '+KES 2,500'],
                  ['Airport transfer escort', '+KES 800'],
                  ['Meal preparation', '+KES 500'],
                  ['Light tutoring session', '+KES 600'],
                  ['Activity coordination', '+KES 700'],
                  ['Second nanny (twin/triplet care)', '+KES 3,000'],
                  ['International travel', 'Custom quote'],
                ].map(([name, price]) => (
                  <div className="addon-chip" key={name}>
                    <div className="addon-chip-name">{name}</div>
                    <div className="addon-chip-price">{price}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="sec sec-dest" id="destinations">
          <div className="sec-inner">
            <div className="reveal">
              <div className="sec-label">Where We Operate</div>
              <h2 className="sec-title">Holiday <em>Destinations</em></h2>
              <p className="sec-sub">We cover Kenya&apos;s top family holiday spots — and growing.</p>
            </div>
            <div className="dest-grid reveal">
              {destinations.map(d => (
                <Link href={`/nannies?destination=${encodeURIComponent(d.name)}`} className="dest-card reveal" key={d.id} style={{ textDecoration: 'none' }}>
                  <img src={d.image_url || ''} alt={d.name} />
                  <div className="dest-shade" />
                  <div className="dest-info">
                    <div className="dest-name">{d.name}</div>
                    <div className="dest-count">{destinationNannyCount(nannies, d.name)} nannies</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="sec sec-testi">
          <div className="sec-inner">
            <div className="reveal">
              <div className="sec-label">Parent Stories</div>
              <h2 className="sec-title">Families <em>Love Us</em></h2>
            </div>
            <div className="testi-grid reveal">
              {reviews.slice(0, 3).map(t => (
                <div className="testi-card reveal" key={t.id}>
                  <div className="testi-quote">&quot;</div>
                  <p className="testi-text">{t.body}</p>
                  <div className="testi-author">
                    <div className="testi-av">
                      <img src={t.avatar_url || '/images/top-right.png'} alt={t.parent_name} />
                    </div>
                    <div>
                      <div className="testi-name">{t.parent_name}</div>
                      <div className="testi-trip">{t.trip_label}</div>
                      <div className="testi-stars">{'★'.repeat(t.rating)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec sec-faq" id="faq">
          <div className="sec-inner">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <div className="sec-label">Got Questions?</div>
              <h2 className="sec-title">Frequently Asked <em>Questions</em></h2>
              <p className="sec-sub" style={{ margin: '0.9rem auto 0' }}>Everything parents want to know before their first booking.</p>
            </div>
            <div className="faq-grid reveal">
              {FAQS.map((faq, i) => (
                <div key={i} className={`faq-item${faqOpen === i ? ' open' : ''}`} onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                  <div className="faq-q">
                    <span className="faq-q-text">{faq.q}</span>
                    <span className="faq-icon">+</span>
                  </div>
                  <div className="faq-a">
                    <div className="faq-a-inner" dangerouslySetInnerHTML={{ __html: faq.a }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="faq-cta reveal">
              <p><strong>Still have questions?</strong> We&apos;d love to help.</p>
              <Link href="/contact" className="btn-coral">Talk to Us</Link>
            </div>
          </div>
        </section>

        <section className="sec sec-partners">
          <div className="sec-inner">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <div className="sec-label">Trusted By</div>
              <h2 className="sec-title">Our <em>Partners</em></h2>
            </div>
            <div className="partners-row reveal">
              {['Sarova Hotels', 'Leopard Beach Resort', 'Fairmont The Norfolk', 'Hemingways', 'Elewana Collection', 'Sun & Sand Resorts'].map(p => (
                <div className="partner-pill" key={p}>{p}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec" style={{ background: 'rgba(26,46,53,0.85)', textAlign: 'center' }}>
          <div className="sec-inner reveal">
            <div className="sec-label">Join Our Team</div>
            <h2 className="sec-title" style={{ textAlign: 'center' }}>Are You a <em>Professional Nanny?</em></h2>
            <p className="sec-sub" style={{ margin: '0.9rem auto 0', textAlign: 'center' }}>
              Earn premium rates, work at Kenya&apos;s finest resorts, and build a career in luxury childcare.
            </p>
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <Link href="/become-a-nanny" className="btn-coral">Apply to Join →</Link>
            </div>
          </div>
        </section>

        <section className="sec sec-cta">
          <div className="sec-inner">
            <div className="cta-inner reveal">
              <h2>Ready to <em>Truly Relax</em>?</h2>
              <p>Your perfect holiday is one nanny away. Book in minutes, enjoy it for days.</p>
              <div className="cta-btns">
                <button className="btn-white" onClick={() => openBook()}>Book a Nanny Today</button>
                <Link href="/become-a-nanny" className="btn-ghost-w">Become a Nanny</Link>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>
      <BookingModal open={modalOpen} onClose={() => setModalOpen(false)} defaults={bookDefaults} />
      <WAFloat />
    </>
  )
}
