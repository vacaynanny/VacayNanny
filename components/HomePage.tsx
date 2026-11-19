'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ImageSlideshow from './ImageSlideshow'
import { familySlides } from '@/lib/marketing-slides'
import Nav from './Nav'
import Footer from './Footer'
import WAFloat from './WAFloat'
import BookingModal, { type BookingDefaults } from './BookingModal'
import NannyCard from './NannyCard'
import Reveal from './Reveal'
import CareIcon from './CareIcon'
import DestinationExplorer from './DestinationExplorer'
import { useSiteCatalog } from './SiteCatalogProvider'
import {
  applyPolicyTokens,
  formatCareMultiplier,
  tierRateMap,
} from '@/lib/catalog'
import { destinationNames } from '@/lib/destinations'
import { formatKes } from '@/lib/constants'
import { publicDailyRate, publicTier } from '@/lib/safeguarding'
import type { Destination, Nanny, Review } from '@/lib/types'
import styles from './HomePage.module.css'

const specialistServices = [
  {
    icon: 'heart' as const,
    title: 'Specialised Childcare',
    text: 'Individualised care and support for children with autism, ADHD, developmental delays, sensory needs and other additional support needs.',
  },
  {
    icon: 'people' as const,
    title: 'Adult & Elderly Care',
    text: 'Personal care and support for adults and older adults, including those with autism, disabilities, dementia, mobility challenges, or other care needs.',
  },
  {
    icon: 'medical' as const,
    title: 'Professional Nursing Care',
    text: 'Clinical nursing services for children and adults, including post-surgery care, recovery support, medication management and other nursing needs, delivered by qualified professionals.',
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
  const site = useSiteCatalog()
  const [modalOpen, setModalOpen] = useState(false)
  const [defaults, setDefaults] = useState<BookingDefaults>({})
  const [search, setSearch] = useState({
    destination: '',
    checkIn: '',
    checkOut: '',
  })
  const rates = tierRateMap(site.tiers)
  function book(value: BookingDefaults = {}) {
    setDefaults(value)
    setModalOpen(true)
  }
  function find(event: React.FormEvent) {
    event.preventDefault()
    const params = new URLSearchParams()
    Object.entries(search).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    router.push(`/nannies?${params}`)
  }
  return (
    <>
      <Nav onBook={() => book()} />
      <main className={styles.home} id="main-content">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Kenya, with room to exhale</p>
            <h1>
              A holiday that feels
              <br />
              like a <em>holiday.</em>
            </h1>
            <p className={styles.intro}>
              Little adventures for them.
              <br />A little breathing room for you.
            </p>
            <p>
              Thoughtful childcare for your family&apos;s time away. Find a
              nanny who fits your plans, from slow beach days to a well-deserved
              dinner for two.
            </p>
            <div className={styles.actions}>
              <button className="btn-coral" onClick={() => book()}>
                Start a booking <span aria-hidden="true">↗</span>
              </button>
              <a href="#how" className={styles.textLink}>
                How it works <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className={styles.heroNote}>
              <CareIcon kind="sun" />
              <span>
                A little luxury for parents.
                <br />A lot of care for little ones.
              </span>
            </div>
          </div>
          <div className={styles.heroImage}>
            <ImageSlideshow
              slides={familySlides}
              label="Family holiday moments"
              sizes="(max-width: 760px) 100vw, 54vw"
              priority
            />
            <div className={styles.imageCaption}>
              More together time. More you time.
            </div>
            <svg
              className={styles.wave}
              viewBox="0 0 190 30"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 16Q18 0 34 16T66 16 98 16 130 16 162 16 190 16"
                stroke="currentColor"
                strokeWidth="3"
              />
            </svg>
          </div>
        </section>
        <section
          className={styles.searchSection}
          id="search"
          aria-label="Find a nanny"
        >
          <div>
            <p className={styles.eyebrow}>Let&apos;s plan your time away</p>
            <h2>Where are you headed?</h2>
          </div>
          <form className={styles.search} onSubmit={find}>
            <label>
              Destination
              <select
                value={search.destination}
                onChange={(e) =>
                  setSearch({ ...search, destination: e.target.value })
                }
              >
                <option value="">Choose a destination</option>
                {destinationNames(destinations).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Arrival
              <input
                type="date"
                value={search.checkIn}
                onChange={(e) =>
                  setSearch({ ...search, checkIn: e.target.value })
                }
              />
            </label>
            <label>
              Departure
              <input
                type="date"
                min={search.checkIn || undefined}
                value={search.checkOut}
                onChange={(e) =>
                  setSearch({ ...search, checkOut: e.target.value })
                }
              />
            </label>
            <button className="btn-coral" type="submit">
              Find a nanny <span aria-hidden="true">→</span>
            </button>
          </form>
        </section>
        <section className={styles.section} id="families">
          <Reveal className={styles.splitHeading}>
            <div>
              <p className={styles.eyebrow}>The VacayNanny way</p>
              <h2>
                Care that fits in.
                <br />
                <em>Memories that stay.</em>
              </h2>
            </div>
            <p>
              Familiar routines, new places, and someone who cares. We help you
              make space for everything a family holiday can be.
            </p>
          </Reveal>
          <Reveal className={styles.careGrid}>
            {[
              {
                icon: 'home' as const,
                title: 'At your hotel.',
                text: 'From playtime to bedtime, care that works around your family’s routines.',
              },
              {
                icon: 'sun' as const,
                title: 'By the water.',
                text: 'Sandy toes and little discoveries, with activities agreed around your child’s needs.',
              },
              {
                icon: 'leaf' as const,
                title: 'Along for the adventure.',
                text: 'An extra pair of hands for days out, excursions and exploring somewhere new.',
              },
            ].map((item) => (
              <article key={item.title}>
                <span className={styles.icon}>
                  <CareIcon kind={item.icon} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </Reveal>
        </section>
        <section className={`${styles.section} ${styles.how}`} id="how">
          <Reveal className={styles.splitHeading}>
            <div>
              <p className={styles.eyebrow}>Made simple, from the start</p>
              <h2>
                A few plans.
                <br />
                <em>A lot to look forward to.</em>
              </h2>
            </div>
            <p>
              Your request is the beginning of a conversation. A booking is
              confirmed after a nanny is matched and both you and your nanny
              accept.
            </p>
          </Reveal>
          <Reveal className={styles.process}>
            {[
              [
                'Tell us about your trip',
                'Share your destination, dates and what your family needs.',
              ],
              [
                'Meet your match',
                'Explore your proposed nanny’s experience and profile, then accept the match.',
              ],
              [
                'Make it yours',
                'Pay securely through Paystack before care begins. Then enjoy your time away.',
              ],
            ].map(([title, text]) => (
              <article key={title}>
                <span className={styles.processDot} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </Reveal>
        </section>
        <section className={styles.section} id="nannies">
          <Reveal className={styles.splitHeading}>
            <div>
              <p className={styles.eyebrow}>People make the difference</p>
              <h2>
                A friendly face.
                <br />
                <em>A thoughtful pair of hands.</em>
              </h2>
            </div>
            <div>
              <p>
                Get to know the people behind the care. Explore their
                experience, languages and individual qualifications.
              </p>
              <Link href="/nannies" className={styles.textLink}>
                Meet our nannies →
              </Link>
            </div>
          </Reveal>
          <Reveal className="nannies-grid">
            {nannies.slice(0, 3).map((nanny) => (
              <NannyCard
                key={nanny.id}
                nanny={nanny}
                onBook={(n) =>
                  book({
                    nannyId: n.id,
                    nannyName: n.display_name,
                    destination: n.destinations[0],
                    tier: publicTier(n),
                    dailyRateKes: publicDailyRate(n, rates),
                  })
                }
              />
            ))}
          </Reveal>
          {!nannies.length && (
            <p className={styles.empty}>
              Our team can help you find care for your trip.{' '}
              <Link href="/contact">Get in touch →</Link>
            </p>
          )}
        </section>
        <section className={`${styles.section} ${styles.pricing}`} id="pricing">
          <Reveal className={styles.splitHeading}>
            <div>
              <p className={styles.eyebrow}>Care options & pricing</p>
              <h2>
                The right care.
                <br />
                <em>Clearly priced.</em>
              </h2>
            </div>
            <p>
              Published daily rates cover a standard{' '}
              {site.policies.standardShiftHours}-hour shift. Choose the
              experience that suits your family; your booking estimate includes
              selected dates and extras.
            </p>
          </Reveal>
          <Reveal className={styles.tiers}>
            {site.tiers.map((tier) => (
              <article
                key={tier.code}
                className={tier.code === 'silver' ? styles.featuredTier : ''}
              >
                <div className={styles.tierTop}>
                  <h3>{tier.cardTitle}</h3>
                  {tier.code === 'silver' && <span>A little extra care</span>}
                </div>
                <p>{tier.description}</p>
                <div className={styles.price}>
                  {formatKes(tier.dailyRateKes)} <small>/ day</small>
                </div>
                <p className={styles.period}>
                  {applyPolicyTokens(tier.period, site.policies)}
                </p>
                <ul>
                  {tier.features.map((feature, i) => (
                    <li key={i}>{applyPolicyTokens(feature, site.policies)}</li>
                  ))}
                </ul>
                <button
                  className={tier.code === 'silver' ? 'btn-coral' : 'btn-ghost'}
                  onClick={() => book({ tier: tier.code })}
                >
                  Choose {tier.cardTitle} <span aria-hidden="true">→</span>
                </button>
              </article>
            ))}
          </Reveal>
          {!site.tiers.length && (
            <p className={styles.empty}>
              Contact us for current rates and a personalised quote.
            </p>
          )}
          <Reveal className={styles.addons}>
            <h3>Make a little more room.</h3>
            <p>Extended hours and thoughtful extras, when you need them.</p>
            <dl>
              {site.care
                .filter((c) => c.code !== 'standard')
                .map((c) => (
                  <div key={c.code}>
                    <dt>{c.label}</dt>
                    <dd>{formatCareMultiplier(c.multiplier)}</dd>
                  </div>
                ))}
              {site.addons.map((a) => (
                <div key={a.id}>
                  <dt>{a.name}</dt>
                  <dd>
                    {a.pricingMode === 'custom' || a.amountKes == null
                      ? 'Quoted separately'
                      : formatKes(a.amountKes)}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>
        <section className={styles.section} id="specialist-care">
          <Reveal className={styles.splitHeading}>
            <div>
              <p className={styles.eyebrow}>
                Care, with a little more understanding
              </p>
              <h2>Specialist care services.</h2>
            </div>
            <p>
              Additional care for unique needs, from specialised childcare to
              adult support and professional nursing.
            </p>
          </Reveal>
          <p className={styles.specialistNote}>
            These services are priced separately from standard nanny tiers.
            Final pricing depends on the level of support, duration and provider
            qualifications.
          </p>
          <Reveal className={styles.specialists}>
            {specialistServices.map((service) => (
              <article key={service.title}>
                <span className={styles.icon}>
                  <CareIcon kind={service.icon} />
                </span>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
                <Link
                  className={styles.textLink}
                  href={`/contact?service=${encodeURIComponent(service.title)}`}
                >
                  Request a specialist care quote{' '}
                  <span aria-hidden="true">↗</span>
                </Link>
              </article>
            ))}
          </Reveal>
        </section>
        <DestinationExplorer destinations={destinations} />
        {reviews.length > 0 && (
          <section className={`${styles.section} ${styles.stories}`}>
            <p className={styles.eyebrow}>From one family to another</p>
            <h2>
              The moments that <em>matter.</em>
            </h2>
            <Reveal className={styles.quotes}>
              {reviews.slice(0, 3).map((review) => (
                <figure key={review.id}>
                  <blockquote>“{review.body}”</blockquote>
                  <figcaption>
                    {review.parent_name}
                    {review.trip_label ? ` · ${review.trip_label}` : ''}
                  </figcaption>
                </figure>
              ))}
            </Reveal>
          </section>
        )}
        <section className={`${styles.section} ${styles.faq}`} id="faq">
          <div>
            <p className={styles.eyebrow}>A little reassurance</p>
            <h2>
              Before you
              <br />
              <em>pack your bags.</em>
            </h2>
            <p>Have something else on your mind?</p>
            <Link href="/contact" className={styles.textLink}>
              Let&apos;s talk →
            </Link>
          </div>
          <div>
            {site.faqs.map((faq) => (
              <details key={faq.id}>
                <summary>
                  {faq.question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{applyPolicyTokens(faq.answer, site.policies)}</p>
              </details>
            ))}
          </div>
        </section>
        <section className={styles.join}>
          <Reveal>
            <p className={styles.eyebrow}>For people who care</p>
            <h2>
              Your next chapter
              <br />
              could make someone&apos;s <em>holiday.</em>
            </h2>
            <p>
              Bring your experience, warmth and love of childcare to VacayNanny.
            </p>
            <Link href="/become-a-nanny" className="btn-ghost">
              Become a nanny ↗
            </Link>
          </Reveal>
        </section>
        <section className={styles.lastWord}>
          <p className={styles.eyebrow}>Less organising. More living.</p>
          <h2>
            Let the holiday <em>begin.</em>
          </h2>
          <button className="btn-coral" onClick={() => book()}>
            Start a booking ↗
          </button>
          <p>Request care. Meet your match. Make some memories.</p>
        </section>
      </main>
      <Footer />
      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaults={defaults}
        destinations={destinationNames(destinations)}
      />
      <WAFloat />
    </>
  )
}
