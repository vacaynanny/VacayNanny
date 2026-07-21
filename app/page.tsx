'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/* ── Ocean canvas animation ── */
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
    function drawWave(
      yBase: number, amp: number, freq: number, speed: number,
      r: number, g: number, b: number, alpha: number
    ) {
      ctx.beginPath()
      ctx.moveTo(0, canvas!.height)
      for (let x = 0; x <= canvas!.width; x += 4) {
        const y = yBase + Math.sin(x * freq + t * speed) * amp +
          Math.sin(x * freq * 0.7 + t * speed * 1.3 + 1) * amp * 0.55
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
      drawWave(h * 0.72, 22, 0.008, 0.6,  45, 125, 111, 0.10)
      drawWave(h * 0.78, 16, 0.012, 0.8,  26,  46,  53, 0.12)
      drawWave(h * 0.82, 12, 0.016, 1.0,  45, 125, 111, 0.09)
      drawWave(h * 0.87,  8, 0.020, 1.2,  26,  46,  53, 0.08)
      drawWave(h * 0.91,  5, 0.025, 1.4,   2,  12,  20, 0.18)
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

/* ── Deck carousel ── */
const DECK_CARDS = [
  {
    icon: '🍽️', iconCls: 'dc-icon-dinner',
    headline: 'Private Beachside Dinner', sub: 'Nanny on duty while you savour a sunset 5-course meal.',
    footer: 'Nanny available now',
  },
  {
    icon: '💆', iconCls: 'dc-icon-spa',
    headline: 'Spa Day Unlocked',
    sub: "Kids happily supervised at the resort kids' club.",
    footer: 'Nanny confirmed',
  },
  {
    icon: '🗺️', iconCls: 'dc-icon-explore',
    headline: 'Explore Without Worry', sub: 'Safari excursion booked — children safe with your nanny.',
    footer: 'Nanny available now',
  },
]

function DeckCarousel() {
  const [active, setActive] = useState(0)
  const [exiting, setExiting] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function advance(next: number) {
    setExiting(active)
    setTimeout(() => setExiting(null), 450)
    setActive(next)
  }

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % DECK_CARDS.length
        setExiting(prev)
        setTimeout(() => setExiting(null), 450)
        return next
      })
    }, 3500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function getPos(idx: number) {
    const len = DECK_CARDS.length
    const rel = (idx - active + len) % len
    return rel < 3 ? rel : -1
  }

  return (
    <div className="deck-wrap">
      <div className="deck-trust">
        <span className="deck-trust-star">★</span> Rated 4.9 / 5 by 200+ families
      </div>
      {DECK_CARDS.map((card, i) => {
        const pos = getPos(i)
        if (pos < 0) return null
        return (
          <div
            key={i}
            className={`deck-card${exiting === i ? ' exiting' : ''}`}
            data-pos={pos}
            onClick={() => advance((active + 1) % DECK_CARDS.length)}
          >
            <div className={`dc-icon ${card.iconCls}`}>{card.icon}</div>
            <div className="dc-headline">{card.headline}</div>
            <div className="dc-sub">{card.sub}</div>
            <div className="dc-divider" />
            <div className="dc-footer">
              <div className="dc-live-dot" />
              <span className="dc-footer-text">{card.footer}</span>
            </div>
          </div>
        )
      })}
      <div className="deck-dots">
        {DECK_CARDS.map((_, i) => (
          <span
            key={i}
            className={`deck-dot${i === active ? ' active' : ''}`}
            onClick={() => advance(i)}
          />
        ))}
      </div>
    </div>
  )
}

/* ── Booking modal ── */
interface BookingForm {
  name: string; email: string; phone: string; destination: string;
  checkIn: string; checkOut: string; children: string; tier: string; notes: string;
}

function BookingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<BookingForm>({
    name: '', email: '', phone: '', destination: '',
    checkIn: '', checkOut: '', children: '', tier: '', notes: '',
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  function change(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setStatus(res.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (!open) return null
  return (
    <div className="modal-bg on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-x" onClick={onClose}>✕</button>
        {status === 'done' ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#fff', marginBottom: '0.5rem' }}>Request Received!</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>We'll confirm your nanny within 2 hours.</p>
            <button className="btn-coral" style={{ marginTop: '1.5rem' }} onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <h2>Book Your Nanny</h2>
            <p className="modal-sub">Fill in your details and we'll match you with the perfect nanny.</p>
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
                  <label>Phone</label>
                  <input name="phone" value={form.phone} onChange={change} placeholder="+254 700 000 000" />
                </div>
                <div className="mfield">
                  <label>Destination</label>
                  <select name="destination" value={form.destination} onChange={change}>
                    <option value="">Select destination</option>
                    <option>Diani Beach</option>
                    <option>Malindi</option>
                    <option>Watamu</option>
                    <option>Nairobi</option>
                    <option>Mombasa</option>
                    <option>Lamu</option>
                    <option>Masai Mara</option>
                    <option>Amboseli</option>
                    <option>Zanzibar</option>
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
                  <label>Nanny Tier</label>
                  <select name="tier" value={form.tier} onChange={change}>
                    <option value="">Any tier</option>
                    <option>Bronze</option><option>Silver</option><option>Gold (Elite)</option>
                  </select>
                </div>
              </div>
              <div className="mfield" style={{ marginBottom: '1rem' }}>
                <label>Special Requests / Notes</label>
                <input name="notes" value={form.notes} onChange={change} placeholder="Allergies, sleep schedules, special needs…" />
              </div>
              {status === 'error' && (
                <p style={{ color: '#ff8a8a', fontSize: '0.82rem', marginBottom: '0.7rem' }}>
                  Something went wrong. Please try again.
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

/* ── WhatsApp float ── */
function WAFloat() {
  const [open, setOpen] = useState(false)
  return (
    <div className="wa-wrap">
      <div className={`wa-bubble${open ? ' open' : ''}`}>
        <div className="wa-head">
          <div className="wa-av">VN</div>
          <div>
            <div className="wa-name">VacayNanny Support</div>
            <div className="wa-status">● Online now</div>
          </div>
        </div>
        <div className="wa-msg">
          Hi there! 👋 Need help booking a nanny for your holiday? Chat with us — we respond in under 5 minutes!
        </div>
        <a
          className="wa-link"
          href="https://wa.me/254700000000?text=Hi%20VacayNanny!%20I'd%20like%20to%20book%20a%20nanny."
          target="_blank"
          rel="noopener noreferrer"
        >
          Chat on WhatsApp
        </a>
      </div>
      <button className="wa-btn" onClick={() => setOpen(o => !o)} aria-label="WhatsApp">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.112 1.523 5.836L0 24l6.336-1.502C8.04 23.447 9.985 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.956 0-3.792-.574-5.338-1.564l-.376-.228-3.931.932.977-3.848-.248-.392C2.006 15.318 2 13.671 2 12 2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
        </svg>
      </button>
    </div>
  )
}

/* ── FAQ ── */
const FAQS = [
  {
    q: 'Are your nannies background-checked?',
    a: 'Yes. Every nanny on VacayNanny undergoes a <strong>multi-layer vetting process</strong> including national ID verification, police clearance certificate (CoGC), reference checks, and an in-person or video interview. Gold-tier nannies also complete a safeguarding training module.'
  },
  {
    q: 'How far in advance should I book?',
    a: 'We recommend booking at least <strong>72 hours ahead</strong> for standard placements. For peak season (December–January, Easter, August) please book 1–2 weeks in advance to guarantee your preferred tier.'
  },
  {
    q: 'What happens if my nanny can\'t make it on the day?',
    a: 'We guarantee a <strong>replacement nanny</strong> within 2 hours or your booking fee is fully refunded. Our coverage team monitors all active placements.'
  },
  {
    q: 'Do nannies travel with us to other countries?',
    a: 'Yes! Our <strong>Gold-tier (Elite) nannies</strong> are passport-holders experienced in international travel. Travel arrangements (flights, accommodation) are at the client\'s expense. See our T&Cs for details.'
  },
  {
    q: 'What are the nanny working hours?',
    a: 'Standard shifts are <strong>8 hours</strong>. Extended shifts (up to 12 hours) and overnight care are available as add-ons. All hours beyond the package limit are charged at an agreed hourly rate.'
  },
  {
    q: 'Can I request the same nanny for multiple days?',
    a: 'Absolutely. When you book recurring days, we <strong>prioritise continuity</strong> so your children have a consistent carer. Specify this preference in the booking notes.'
  },
  {
    q: 'Are nannies trained in first aid?',
    a: 'All <strong>Silver and Gold nannies</strong> hold a valid paediatric first-aid certificate. Bronze nannies have basic first-aid knowledge. You can filter by certification on the search page.'
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Full refund if cancelled <strong>48+ hours</strong> before the start time. 50% refund within 24–48 hours. No refund for cancellations under 24 hours except in cases of verified emergency.'
  },
  {
    q: 'Can nannies handle infants?',
    a: 'Yes. Indicate <strong>"Infant care"</strong> as a required skill when booking and we\'ll match you with a nanny who holds relevant newborn/infant experience certificates. Infant care is available across all tiers but most experienced at Silver+.'
  },
  {
    q: 'How are nannies paid?',
    a: 'All payments go through <strong>VacayNanny\'s secure platform</strong> — never directly to the nanny. This protects both parties and ensures our quality guarantee applies. Nannies receive timely payouts after each completed booking.'
  },
  {
    q: 'Is VacayNanny available outside Kenya?',
    a: 'Currently we operate primarily in <strong>Kenya\'s major tourism corridors</strong> (Diani, Malindi, Watamu, Nairobi, Mombasa, Lamu, and the national parks). We\'re expanding to Zanzibar, Rwanda, and South Africa — <a href="#">join the waitlist</a>.'
  },
]

/* ── Main Page ── */
export default function HomePage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [pricingHover, setPricingHover] = useState(false)

  // Nav scroll
  useEffect(() => {
    function onScroll() { setNavScrolled(window.scrollY > 40) }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Reveal observer
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target) } })
    }, { threshold: 0.12 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <>
      <OceanCanvas />
      <div className="site-wrap">
        {/* NAV */}
        <nav className={`nav${navScrolled ? ' scrolled' : ''}`}>
          <a href="#" className="nav-logo">Vacay<em>Nanny</em></a>
          <ul className="nav-links">
            <li><a href="#how">How It Works</a></li>
            <li><a href="#nannies">Our Nannies</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#destinations">Destinations</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
          <button className="nav-cta" onClick={() => setModalOpen(true)}>Book a Nanny</button>
        </nav>

        {/* HERO */}
        <section className="hero">
          <div className="hero-bg" />

          {/* Pill badge — top right, floats on background */}
          <div className="hero-pill-badge">
            <span className="hero-pill-star">★</span> Every nanny vetted &amp; certified
          </div>

          {/* Glass badge — lower right, floats on background */}
          <div className="hero-glass-badge">
            <div className="hgb-star-wrap">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <defs>
                  <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F5C24B"/>
                    <stop offset="100%" stopColor="#FFB84C"/>
                  </linearGradient>
                </defs>
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="url(#starGrad)" stroke="#E8A020" strokeWidth="0.5"/>
              </svg>
            </div>
            <div>
              <div className="hgb-title">Vetted &amp; Certified</div>
              <div className="hgb-sub">Your child is in safe hands</div>
            </div>
          </div>

          {/* Left: copy */}
          <div className="hero-text">
            <span className="hero-eyebrow">✦ Trusted childcare across East Africa &amp; beyond</span>
            <h1>Trusted Holiday Nannies,<br /><em>Wherever You Travel</em></h1>
            <p className="hero-sub">
              Every nanny is DBS checked, reference verified, and first-aid certified. Available in Mombasa, Zanzibar, Cape Town and beyond.
            </p>
            <div className="hero-actions">
              <a href="#search" className="btn-coral">Find a Nanny</a>
              <a href="#how" className="btn-ghost">How It Works</a>
            </div>
            <p className="hero-trust-line">DBS checked &nbsp;·&nbsp; Reference verified &nbsp;·&nbsp; First-aid certified</p>
            <div className="hero-stats">
              <div><div className="stat-num">50+</div><div className="stat-lbl">Vetted Nannies</div></div>
              <div><div className="stat-num">8</div><div className="stat-lbl">Destinations</div></div>
              <div><div className="stat-num">100%</div><div className="stat-lbl">Vetted &amp; Insured</div></div>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
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

        {/* SEARCH */}
        <section className="sec sec-search" id="search">
          <div className="sec-inner">
            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              <div className="sec-label">Find Your Match</div>
              <h2 className="sec-title">Search <em>Available Nannies</em></h2>
            </div>
            <div className="search-box">
              <div className="sf">
                <label>Destination</label>
                <select>
                  <option>Any destination</option>
                  <option>Diani Beach</option>
                  <option>Malindi</option>
                  <option>Watamu</option>
                  <option>Nairobi</option>
                  <option>Mombasa</option>
                  <option>Lamu</option>
                  <option>Masai Mara</option>
                  <option>Amboseli</option>
                  <option>Zanzibar</option>
                </select>
              </div>
              <div className="sf">
                <label>Check-in</label>
                <input type="date" />
              </div>
              <div className="sf">
                <label>Check-out</label>
                <input type="date" />
              </div>
              <div className="sf">
                <label>Nanny Tier</label>
                <select>
                  <option>Any tier</option>
                  <option>Bronze</option>
                  <option>Silver</option>
                  <option>Gold (Elite)</option>
                </select>
              </div>
              <button className="search-go" onClick={() => setModalOpen(true)}>Search →</button>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="sec sec-how" id="how">
          <div className="sec-inner">
            <div className="reveal">
              <div className="sec-label">Simple Process</div>
              <h2 className="sec-title">How It <em>Works</em></h2>
              <p className="sec-sub">From search to seaside — we make holiday childcare effortless in four steps.</p>
            </div>
            <div className="process-row reveal">
              <div className="process-step">
                <div className="process-step-label">Step 1</div>
                <div className="process-step-title">Search & Filter</div>
                <img src="/images/step1.png" alt="Search on app" className="process-phone-image" />
              </div>
              <div className="process-arrow">→</div>
              <div className="process-step">
                <div className="process-step-label">Step 2</div>
                <div className="process-step-title">Choose Your Nanny</div>
                <img src="/images/step2.png" alt="Choose nanny" className="process-phone-image" />
              </div>
              <div className="process-arrow">→</div>
              <div className="process-step">
                <div className="process-step-label">Step 3</div>
                <div className="process-step-title">Secure Booking</div>
                <img src="/images/step3.png" alt="Book securely" className="process-phone-image" />
              </div>
              <div className="process-arrow">→</div>
              <div className="process-step">
                <div className="process-step-label">Step 4</div>
                <div className="process-step-title">Enjoy Your Holiday</div>
                <img src="/images/step4.png" alt="Enjoy holiday" className="process-phone-image" />
              </div>
            </div>
          </div>
        </section>

        {/* LIFESTYLE MOSAIC */}
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
              <div className="life-tile">
                <img src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&auto=format&fit=crop" alt="Spa" />
                <div className="life-shade" /><div className="life-info"><div className="life-title">Spa & Wellness</div><div className="life-sub">Full day, uninterrupted</div></div>
              </div>
              <div className="life-tile">
                <img src="https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=600&auto=format&fit=crop" alt="Fine dining" />
                <div className="life-shade" /><div className="life-info"><div className="life-title">Fine Dining</div><div className="life-sub">Table for two, finally</div></div>
              </div>
              <div className="life-tile">
                <img src="https://images.unsplash.com/photo-1516426122078-c23e76319801?w=600&auto=format&fit=crop" alt="Safari" />
                <div className="life-shade" /><div className="life-info"><div className="life-title">Safari Adventure</div><div className="life-sub">Masai Mara awaits</div></div>
              </div>
              <div className="life-tile">
                <img src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop" alt="Water sports" />
                <div className="life-shade" /><div className="life-info"><div className="life-title">Water Sports</div><div className="life-sub">Kitesurfing, diving &amp; more</div></div>
              </div>
            </div>
          </div>
        </section>

        {/* NANNIES */}
        <section className="sec sec-nannies" id="nannies">
          <div className="sec-inner">
            <div className="reveal">
              <div className="sec-label">Our Team</div>
              <h2 className="sec-title">Meet Our <em>Nannies</em></h2>
              <p className="sec-sub">Every nanny is vetted, trained, and passionate about giving children the best holiday experience.</p>
            </div>
            <div className="nannies-grid reveal">
              {[
                { name: 'Amara Ochieng', loc: 'Diani Beach · Kwale', tier: 'Elite', tierCls: 't-elite', rate: 'KES 4,500', tags: ['Infant care','CPR/First Aid','Swahili/English','Swimming'], stars: 5, reviews: 48 },
                { name: 'Faith Wanjiku', loc: 'Nairobi · Mombasa', tier: 'Pro', tierCls: 't-pro', rate: 'KES 3,200', tags: ['Ages 2–10','Arts & Crafts','English/Kikuyu','Tutoring'], stars: 5, reviews: 31 },
                { name: 'Grace Atieno', loc: 'Malindi · Watamu', tier: 'Elite', tierCls: 't-elite', rate: 'KES 4,800', tags: ['Newborn','Montessori','French/Swahili','Travel nanny'], stars: 5, reviews: 62 },
                { name: 'Mercy Kamau', loc: 'Lamu · Malindi', tier: 'Pro', tierCls: 't-pro', rate: 'KES 3,000', tags: ['Ages 3–12','Swimming','English/Swahili','Cooking'], stars: 4, reviews: 22 },
                { name: 'Patience Njeri', loc: 'Nairobi · Nationwide', tier: 'Elite', tierCls: 't-elite', rate: 'KES 5,200', tags: ['Special needs','BSL basics','Fluent English','Overnight'], stars: 5, reviews: 55 },
                { name: 'Rose Achieng', loc: 'Mombasa · Diani', tier: 'Standard', tierCls: 't-basic', rate: 'KES 2,200', tags: ['Ages 4–14','Outdoor play','Swahili/English','Arts'], stars: 4, reviews: 18 },
              ].map((n, i) => (
                <div className="nanny-card reveal" key={i}>
                  <div className="nc-photo">
                    <img
                      src={`https://images.unsplash.com/photo-${['1531746020798-e6953c6e8e04','1573496359142-b8d87734a5a2','1580489944761-15a19d654956','1438761681033-6461ffad8d80','1544005313-94ddf0286df2','1489424731084-a5d8b86c3b24'][i]}?w=400&auto=format&fit=crop&face`}
                      alt={n.name}
                    />
                    <span className={`tier-pill ${n.tierCls}`}>{n.tier}</span>
                  </div>
                  <div className="nc-body">
                    <div className="nc-name">{n.name}</div>
                    <div className="nc-loc">📍 {n.loc}</div>
                    <div className="nc-stars"><span>{'★'.repeat(n.stars)}</span> ({n.reviews} reviews)</div>
                    <div className="nc-tags">{n.tags.map(t => <span className="nc-tag" key={t}>{t}</span>)}</div>
                    <div className="nc-foot">
                      <div className="nc-rate">{n.rate}<small>/day</small></div>
                      <button className="book-btn" onClick={() => setModalOpen(true)}>Book Now</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
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
              {/* BRONZE */}
              <div className="price-card bronze">
                <div className="medal-stripe" />
                <span className="tier-pill-top">ENTRY</span>
                <div className="price-rank">Tier 01</div>
                <div className="price-name">Bronze</div>
                <div className="price-desc">Reliable, caring nannies for straightforward childcare needs.</div>
                <div className="price-divider" />
                <div className="price-big"><sup>KES</sup>2,200<sub>/day</sub></div>
                <div className="price-period">8-hour shift · 1–2 children</div>
                <ul className="price-feats">
                  <li>Background-checked nanny</li>
                  <li>Basic first-aid trained</li>
                  <li>Ages 3–14 care</li>
                  <li>Single-property coverage</li>
                  <li>WhatsApp parent updates</li>
                  <li>2-hour replacement guarantee</li>
                </ul>
                <button className="price-btn" onClick={() => setModalOpen(true)}>Get Started</button>
              </div>
              {/* SILVER */}
              <div className="price-card silver">
                <div className="medal-stripe" />
                <span className="tier-pill-top">POPULAR</span>
                <div className="price-rank">Tier 02</div>
                <div className="price-name">Silver</div>
                <div className="price-desc">Enhanced care with certified skills for growing families.</div>
                <div className="price-divider" />
                <div className="price-big"><sup>KES</sup>3,200<sub>/day</sub></div>
                <div className="price-period">8-hour shift · Up to 3 children</div>
                <ul className="price-feats">
                  <li>Everything in Bronze</li>
                  <li>Paediatric First Aid cert.</li>
                  <li>Infant &amp; toddler care</li>
                  <li>Basic tutoring / homework</li>
                  <li>Swimming supervision</li>
                  <li>Bilingual (English + Swahili)</li>
                </ul>
                <button className="price-btn" onClick={() => setModalOpen(true)}>Choose Silver</button>
              </div>
              {/* GOLD */}
              <div className="price-card gold">
                <div className="medal-stripe" />
                <span className="tier-pill-top">ELITE</span>
                <div className="price-rank">Tier 03</div>
                <div className="price-name">Gold</div>
                <div className="price-desc">Premium international-standard care for discerning families.</div>
                <div className="price-divider" />
                <div className="price-big"><sup>KES</sup>5,200<sub>/day</sub></div>
                <div className="price-period">8-hour shift · Up to 4 children</div>
                <ul className="price-feats">
                  <li>Everything in Silver</li>
                  <li>Newborn &amp; special-needs care</li>
                  <li>Passport-holder · Can travel abroad</li>
                  <li>Montessori / early education</li>
                  <li>Multilingual (3+ languages)</li>
                  <li>Overnight care available</li>
                </ul>
                <button className="price-btn" onClick={() => setModalOpen(true)}>Go Elite →</button>
              </div>
            </div>

            {/* ADD-ONS */}
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

        {/* DESTINATIONS */}
        <section className="sec sec-dest" id="destinations">
          <div className="sec-inner">
            <div className="reveal">
              <div className="sec-label">Where We Operate</div>
              <h2 className="sec-title">Holiday <em>Destinations</em></h2>
              <p className="sec-sub">We cover Kenya's top family holiday spots — and growing.</p>
            </div>
            <div className="dest-grid reveal">
              {[
                { name: 'Diani Beach', count: '42 nannies', img: 'photo-1559827260-dc66d52bef19' },
                { name: 'Malindi', count: '28 nannies', img: 'photo-1548013146-72479768bada' },
                { name: 'Watamu', count: '19 nannies', img: 'photo-1605640840605-14ac1855827b' },
                { name: 'Nairobi', count: '85 nannies', img: 'photo-1611348524140-53c9a25263d6' },
                { name: 'Mombasa', count: '34 nannies', img: 'photo-1506905925346-21bda4d32df4' },
                { name: 'Lamu', count: '14 nannies', img: 'photo-1590523741831-ab7e8b8f9c7f' },
                { name: 'Masai Mara', count: '11 nannies', img: 'photo-1516426122078-c23e76319801' },
                { name: 'Amboseli', count: '9 nannies', img: 'photo-1489749798305-4fea3ae63d43' },
                { name: 'Zanzibar', count: '22 nannies', img: 'photo-1559827291-72ee739d0d9a' },
              ].map(d => (
                <div className="dest-card reveal" key={d.name}>
                  <img src={`https://images.unsplash.com/${d.img}?w=400&auto=format&fit=crop`} alt={d.name} />
                  <div className="dest-shade" />
                  <div className="dest-info">
                    <div className="dest-name">{d.name}</div>
                    <div className="dest-count">{d.count}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="sec sec-testi">
          <div className="sec-inner">
            <div className="reveal">
              <div className="sec-label">Parent Stories</div>
              <h2 className="sec-title">Families <em>Love Us</em></h2>
            </div>
            <div className="testi-grid reveal">
              {[
                {
                  text: 'We hired Grace for 5 days in Diani. She was incredible with our 2-year-old and 4-year-old. My husband and I finally had real couple time on a holiday for the first time in years. We\'ll never travel without VacayNanny again.',
                  name: 'Sarah M.',
                  trip: 'Diani Beach, December 2024',
                  stars: 5,
                  avatar: 'photo-1531746020798-e6953c6e8e04',
                },
                {
                  text: 'Faith joined us on safari in the Mara. She kept our kids engaged, did educational activities about wildlife, and managed mealtime like a pro. Worth every shilling. Absolute peace of mind.',
                  name: 'David & Priya K.',
                  trip: 'Masai Mara, August 2024',
                  stars: 5,
                  avatar: 'photo-1527980965255-d3b416303d12',
                },
                {
                  text: 'As a solo mum travelling with 3 kids, I was nervous. Amara was a godsend — professional, warm, and my kids adored her. The booking process was seamless and customer support was always available.',
                  name: 'Christine O.',
                  trip: 'Watamu, April 2025',
                  stars: 5,
                  avatar: 'photo-1438761681033-6461ffad8d80',
                },
              ].map((t, i) => (
                <div className="testi-card reveal" key={i}>
                  <div className="testi-quote">"</div>
                  <p className="testi-text">{t.text}</p>
                  <div className="testi-author">
                    <div className="testi-av">
                      <img src={`https://images.unsplash.com/${t.avatar}?w=80&auto=format&fit=crop`} alt={t.name} />
                    </div>
                    <div>
                      <div className="testi-name">{t.name}</div>
                      <div className="testi-trip">{t.trip}</div>
                      <div className="testi-stars">{'★'.repeat(t.stars)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="sec sec-faq" id="faq">
          <div className="sec-inner">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <div className="sec-label">Got Questions?</div>
              <h2 className="sec-title">Frequently Asked <em>Questions</em></h2>
              <p className="sec-sub" style={{ margin: '0.9rem auto 0' }}>Everything parents want to know before their first booking.</p>
            </div>
            <div className="faq-grid reveal">
              {FAQS.map((faq, i) => (
                <div
                  key={i}
                  className={`faq-item${faqOpen === i ? ' open' : ''}`}
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                >
                  <div className="faq-q">
                    <span className="faq-q-text">{faq.q}</span>
                    <span className="faq-icon">+</span>
                  </div>
                  <div className="faq-a">
                    <div
                      className="faq-a-inner"
                      dangerouslySetInnerHTML={{ __html: faq.a }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="faq-cta reveal">
              <p><strong>Still have questions?</strong> We'd love to help.</p>
              <button className="btn-coral" onClick={() => setModalOpen(true)}>Talk to Us</button>
            </div>
          </div>
        </section>

        {/* PARTNERS */}
        <section className="sec sec-partners">
          <div className="sec-inner">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <div className="sec-label">Trusted By</div>
              <h2 className="sec-title">Our <em>Partners</em></h2>
            </div>
            <div className="partners-row reveal">
              {['Sarova Hotels','Leopard Beach Resort','Fairmont The Norfolk','Hemingways','Elewana Collection','Sun &amp; Sand Resorts'].map(p => (
                <div className="partner-pill" key={p} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
            </div>
          </div>
        </section>

        {/* NANNY CTA */}
        <section className="sec" style={{ background: 'rgba(26,46,53,0.85)', textAlign: 'center' }}>
          <div className="sec-inner reveal">
            <div className="sec-label">Join Our Team</div>
            <h2 className="sec-title" style={{ textAlign: 'center' }}>Are You a <em>Professional Nanny?</em></h2>
            <p className="sec-sub" style={{ margin: '0.9rem auto 0', textAlign: 'center' }}>
              Earn premium rates, work at Kenya's finest resorts, and build a career in luxury childcare.
            </p>
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <Link href="/become-a-nanny" className="btn-coral">Apply to Join →</Link>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="sec sec-cta">
          <div className="sec-inner">
            <div className="cta-inner reveal">
              <h2>Ready to <em>Truly Relax</em>?</h2>
              <p>Your perfect holiday is one nanny away. Book in minutes, enjoy it for days.</p>
              <div className="cta-btns">
                <button className="btn-white" onClick={() => setModalOpen(true)}>Book a Nanny Today</button>
                <Link href="/become-a-nanny" className="btn-ghost-w">Become a Nanny</Link>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="sec">
          <div className="sec-inner">
            <div className="footer-grid">
              <div>
                <div className="footer-logo">Vacay<em>Nanny</em></div>
                <p className="footer-about">Kenya's first dedicated holiday childcare platform. Professional nannies for families who believe great vacations and great parenting go hand in hand.</p>
                <div className="footer-social">
                  {['f','in','tw','ig'].map(s => <a href="#" className="soc-btn" key={s}>{s}</a>)}
                </div>
              </div>
              <div className="footer-col">
                <h4>For Families</h4>
                <ul>
                  <li><a href="#how">How It Works</a></li>
                  <li><a href="#nannies">Our Nannies</a></li>
                  <li><a href="#pricing">Pricing</a></li>
                  <li><a href="#destinations">Destinations</a></li>
                  <li><a href="#faq">FAQ</a></li>
                </ul>
              </div>
              <div className="footer-col">
                <h4>For Nannies</h4>
                <ul>
                  <li><Link href="/become-a-nanny">Apply Now</Link></li>
                  <li><a href="#">Nanny Resources</a></li>
                  <li><a href="#">Training &amp; Certification</a></li>
                  <li><a href="#">Nanny Community</a></li>
                </ul>
              </div>
              <div className="footer-col">
                <h4>Company</h4>
                <ul>
                  <li><a href="#">About Us</a></li>
                  <li><a href="#">Blog</a></li>
                  <li><a href="#">Press</a></li>
                  <li><a href="#">Careers</a></li>
                  <li><a href="#">Contact</a></li>
                </ul>
              </div>
            </div>
            <div className="footer-bottom">
              <span>© 2025 VacayNanny Ltd. All rights reserved.</span>
              <div className="footer-bottom-links">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
                <a href="#">Cookie Policy</a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* BOOKING MODAL */}
      <BookingModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {/* WHATSAPP */}
      <WAFloat />
    </>
  )
}
