'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import MediaImage from '@/components/MediaImage'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import WAFloat from '@/components/WAFloat'
import BookingModal, { type BookingDefaults } from '@/components/BookingModal'
import NannyCard from '@/components/NannyCard'
import { destinationNames } from '@/lib/destinations'
import { destinationNannyCount } from '@/lib/data'
import { CERTIFICATION_FILTERS } from '@/lib/match'
import { useSiteCatalog } from '@/components/SiteCatalogProvider'
import { applyPolicyTokens, formatCareMultiplier, tierOptionLabel, tierRateMap } from '@/lib/catalog'
import { formatKes } from '@/lib/constants'
import { publicDailyRate, publicTier } from '@/lib/safeguarding'
import type { Destination, Nanny, Review } from '@/lib/types'

function OceanCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Skip expensive animation on low-power / reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let t = 0
    let last = 0
    let visible = !document.hidden
    function resize() {
      // Cap DPR so retina phones don't paint 4x pixels
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      canvas!.style.width = w + 'px'
      canvas!.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    function onVis() {
      visible = !document.hidden
      if (visible && !raf) loop(performance.now())
    }
    document.addEventListener('visibilitychange', onVis)
    function drawWave(yBase: number, amp: number, freq: number, speed: number, r: number, g: number, b: number, alpha: number) {
      ctx.beginPath()
      ctx.moveTo(0, canvas!.clientHeight)
      for (let x = 0; x <= canvas!.clientWidth; x += 8) {
        const y = yBase + Math.sin(x * freq + t * speed) * amp + Math.sin(x * freq * 0.7 + t * speed * 1.3 + 1) * amp * 0.55
        ctx.lineTo(x, y)
      }
      ctx.lineTo(canvas!.clientWidth, canvas!.clientHeight)
      ctx.closePath()
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
      ctx.fill()
    }
    function loop(now: number) {
      raf = 0
      if (!visible) return
      // ~30fps is enough for background waves
      if (now - last >= 33) {
        last = now
        ctx.clearRect(0, 0, canvas!.clientWidth, canvas!.clientHeight)
        const h = canvas!.clientHeight
        drawWave(h * 0.72, 22, 0.008, 0.6, 45, 125, 111, 0.10)
        drawWave(h * 0.78, 16, 0.012, 0.8, 26, 46, 53, 0.12)
        drawWave(h * 0.82, 12, 0.016, 1.0, 45, 125, 111, 0.09)
        drawWave(h * 0.87, 8, 0.020, 1.2, 26, 46, 53, 0.08)
        t += 0.018
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
  return <canvas ref={canvasRef} id="ocean-bg" />
}

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
  const site = useSiteCatalog()
  const rates = tierRateMap(site.tiers)
  const [modalOpen, setModalOpen] = useState(false)
  const [bookDefaults, setBookDefaults] = useState<BookingDefaults>({})
  const [faqOpen, setFaqOpen] = useState<string | null>(null)
  const [search, setSearch] = useState({ destination: '', checkIn: '', checkOut: '', tier: '', infant: '', cert: '' })

  // Robust reveal observer with fallback timeout
  useEffect(() => {
    let obs: IntersectionObserver | null = null
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null

    function initObserver() {
      const els = document.querySelectorAll('.reveal:not(.in)')
      if (!els.length) return

      obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            obs?.unobserve(e.target)
          }
        })
      }, { threshold: 0.05, rootMargin: '50px' }) // Lower threshold, earlier trigger

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      els.forEach(el => obs.observe(el))

      // Fallback: reveal all after 3s in case observer fails (e.g. reduced motion, Safari quirks)
      fallbackTimer = setTimeout(() => {
        document.querySelectorAll('.reveal:not(.in)').forEach(el => el.classList.add('in'))
      }, 3000)
    }

    // Initial run
    initObserver()

    // Re-run on scroll/resize in case new elements appear (e.g. after data loads)
    const onScroll = () => initObserver()
    const onResize = () => initObserver()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      obs?.disconnect()
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      fallbackTimer && clearTimeout(fallbackTimer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
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
    if (search.infant) params.set('infant', '1')
    if (search.cert) params.set('cert', search.cert)
    router.push(`/nannies${params.toString() ? `?${params}` : ''}`)
  }

  const featured = nannies.slice(0, 6)

  return (
    <>
      <OceanCanvas />
      <div className="site-wrap">
        <Nav onBook={() => openBook()} />

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
              <div><div className="stat-num">{nannies.length}</div><div className="stat-lbl">Vetted Nannies</div></div>
              <div><div className="stat-num">{destinations.length}</div><div className="stat-lbl">Destinations</div></div>
              <div><div className="stat-num">100%</div><div className="stat-lbl">Vetted &amp; Insured</div></div>
            </div>
          </div>
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
        </section>

        <section className="sec sec-search" id="search">
          <div className="sec-inner">
            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              <div className="sec-label">Find Your Match</div>
              <h2 className="sec-title">Search <em>Available Nannies</em></h2>
            </div>
            <div className="search-box nanny-search">
              <div className="sf">
                <label>Destination</label>
                <select value={search.destination} onChange={e => setSearch(s => ({ ...s, destination: e.target.value }))}>
                  <option value="">Any destination</option>
                  {destinationNames(destinations).map(d => <option key={d}>{d}</option>)}
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
                  {site.tiers.map(tier => (
                    <option key={tier.code} value={tier.code}>{tierOptionLabel(tier)}</option>
                  ))}
                </select>
              </div>
              <div className="sf">
                <label>Infant care</label>
                <select value={search.infant} onChange={e => setSearch(s => ({ ...s, infant: e.target.value }))}>
                  <option value="">Any age</option>
                  <option value="1">Infant / newborn required</option>
                </select>
              </div>
              <div className="sf">
                <label>Certification</label>
                <select value={search.cert} onChange={e => setSearch(s => ({ ...s, cert: e.target.value }))}>
                  <option value="">Any certification</option>
                  {CERTIFICATION_FILTERS.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
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
              <p className="sec-sub">From search to seaside — we make holiday childcare effortless.</p>
            </div>
            <div className="process-row reveal">
              {site.steps.flatMap((step, i) => [
                i > 0 ? <div className="process-arrow" key={`a${step.id}`}>→</div> : null,
                <div className="process-step" key={step.id}>
                  <div className="process-step-label">{step.stepLabel}</div>
                  <div className="process-step-title">{step.title}</div>
                  <MediaImage src={step.imageUrl} alt={step.imageAlt || step.title} width={506} height={987} className="process-phone-image" />
                </div>,
              ])}
            </div>
          </div>
        </section>

        <section className="sec sec-life">
          <div className="sec-inner">
            <div className="reveal">
              <div className="sec-label">What We Take Care Of</div>
              <h2 className="sec-title">What Your Nanny <em>Handles</em></h2>
              <p className="sec-sub">From bedtime routines and beach days to hotel care and day-trip support. Your nanny covers it so you can be present.</p>
            </div>
            <div className="life-grid reveal">
              <div className="life-tile big">
                <MediaImage src="https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=1200&auto=format&fit=crop&q=80" alt="Kids having fun at the beach with a nanny" fill sizes="(max-width: 900px) 100vw, 50vw" />
                <div className="life-shade" /><div className="life-info"><div className="life-title">Beach days sorted</div><div className="life-sub">Nanny leads the adventure, parents breathe</div></div>
                <div className="life-tag">With Nanny</div>
              </div>
              {[
                ['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&auto=format&fit=crop&q=80', 'Couple at a dinner table', 'Romantic dinner', 'Just the two of you', 'Parent Freedom'],
                ['https://images.unsplash.com/photo-1551966775-a4ddc8df052b?w=900&auto=format&fit=crop&q=80', 'Kids colouring and painting', 'Art time', 'Creativity on the sand', 'With Nanny'],
                ['https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900&auto=format&fit=crop&q=80', 'Parents relaxing while children are cared for', 'Time to yourself', 'While your nanny has it covered', 'Parent Freedom'],
                ['https://images.unsplash.com/photo-1519046904884-53103b34b206?w=900&auto=format&fit=crop&q=80', 'Kids at a resort pool', 'Pool fun', 'Safe, supervised, smiling', 'With Nanny'],
              ].map(([src, alt, title, sub, tag]) => (
                <div className="life-tile" key={title}>
                  <MediaImage src={src} alt={alt} fill sizes="(max-width: 900px) 50vw, 25vw" />
                  <div className="life-shade" /><div className="life-info"><div className="life-title">{title}</div><div className="life-sub">{sub}</div></div>
                  <div className="life-tag">{tag}</div>
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
                <NannyCard key={n.id} nanny={n} onBook={nn => openBook({
                  nannyId: nn.id,
                  nannyName: nn.display_name,
                  destination: nn.destinations[0],
                  tier: publicTier(nn),
                  dailyRateKes: publicDailyRate(nn, rates),
                })} />
              ))}
            </div>
            {featured.length === 0 && <p className="sec-sub">No nannies are published yet.</p>}
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
              <p className="sec-sub" style={{ margin: '0.9rem auto 0' }}>All plans include our {site.policies.replacementSlaHours}-hour replacement guarantee and 24/7 parent support.</p>
            </div>
            {site.tiers.length === 0 ? (
              <p className="sec-sub">Published rates are not available right now.</p>
            ) : (
            <div className="pricing-grid reveal">
              {site.tiers.map((tier, index) => (
                <div className={`price-card ${tier.code}`} key={tier.code}>
                  <div className="medal-stripe" />
                  {tier.badge ? <span className="tier-pill-top">{tier.badge}</span> : null}
                  <div className="price-rank">Tier {String(index + 1).padStart(2, '0')}</div>
                  <div className="price-name">{tier.cardTitle}</div>
                  <div className="price-desc">{tier.description}</div>
                  <div className="price-divider" />
                  <div className="price-big"><sup>KES</sup>{tier.dailyRateKes.toLocaleString('en-KE')}<sub>/day</sub></div>
                  <div className="price-period">{applyPolicyTokens(tier.period, site.policies)}</div>
                  <ul className="price-feats">{tier.features.map((feature, featureIndex) => <li key={`${tier.code}-${featureIndex}`}>{applyPolicyTokens(feature, site.policies)}</li>)}</ul>
                  <button className="price-btn" onClick={() => openBook({ tier: tier.code })}>{tier.cta}</button>
                </div>
              ))}
            </div>
            )}
            {(site.care.some(care => care.code !== 'standard') || site.addons.length > 0) && (
            <div className="addons reveal">
              <h3>Optional Add-ons</h3>
              <div className="addon-chips">
                {site.care.filter(care => care.code !== 'standard').map(care => (
                  <div className="addon-chip" key={care.code}>
                    <div className="addon-chip-name">{care.label}</div>
                    <div className="addon-chip-price">{formatCareMultiplier(care.multiplier)}</div>
                  </div>
                ))}
                {site.addons.map(addon => (
                  <div className="addon-chip" key={addon.id}>
                    <div className="addon-chip-name">{addon.name}</div>
                    {addon.description ? <div className="addon-chip-name">{addon.description}</div> : null}
                    <div className="addon-chip-price">
                      {addon.pricingMode === 'custom' || addon.amountKes == null ? 'Custom quote' : `+${formatKes(addon.amountKes)}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}
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
                  {d.image_url ? <MediaImage src={d.image_url} alt={d.name} fill sizes="(max-width: 700px) 100vw, 33vw" /> : null}
                  <div className="dest-shade" />
                  <div className="dest-info">
                    <div className="dest-name">{d.name}</div>
                    <div className="dest-count">{destinationNannyCount(nannies, d.name)} nannies</div>
                  </div>
                </Link>
              ))}
            </div>
            {destinations.length === 0 && <p className="sec-sub">No destinations are published yet.</p>}
          </div>
        </section>

        {reviews.length > 0 && (
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
                      <MediaImage src={t.avatar_url || '/images/top-right.png'} alt={t.parent_name} fill sizes="44px" />
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
        )}

        <section className="sec sec-faq" id="faq">
          <div className="sec-inner">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <div className="sec-label">Got Questions?</div>
              <h2 className="sec-title">Frequently Asked <em>Questions</em></h2>
              <p className="sec-sub" style={{ margin: '0.9rem auto 0' }}>Everything parents want to know before their first booking.</p>
            </div>
            <div className="faq-grid reveal">
              {site.faqs.map(faq => (
                <div key={faq.id} className={`faq-item${faqOpen === faq.id ? ' open' : ''}`} onClick={() => setFaqOpen(faqOpen === faq.id ? null : faq.id)}>
                  <div className="faq-q">
                    <span className="faq-q-text">{faq.question}</span>
                    <span className="faq-icon">+</span>
                  </div>
                  <div className="faq-a">
                    <div className="faq-a-inner" style={{ whiteSpace: 'pre-wrap' }}>{applyPolicyTokens(faq.answer, site.policies)}</div>
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
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>
      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaults={bookDefaults}
        destinations={destinationNames(destinations)}
      />
      <WAFloat />
    </>
  )
}
