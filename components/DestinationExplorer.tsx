import Link from 'next/link'
import type { Destination } from '@/lib/types'
import MediaImage from './MediaImage'
import Reveal from './Reveal'
import CareIcon from './CareIcon'
import styles from './DestinationExplorer.module.css'

const stories = [
  {
    name: 'Diani Beach',
    aliases: ['diani', 'dianibeach'],
    mood: 'Barefoot & unhurried',
    description: 'Salty hair, sandy toes and nowhere you need to be.',
    image: '/images/destinations/diani.webp',
    alt: 'AI-generated scene of a palm-lined Kenyan beach and turquoise sea',
  },
  {
    name: 'Watamu',
    aliases: ['watamu'],
    mood: 'A slower kind of day',
    description: 'Quiet creeks, little discoveries and one more sunset.',
    image: '/images/destinations/watamu.webp',
    alt: 'AI-generated scene of a wooden dhow on a quiet Kenyan coastal creek',
  },
  {
    name: 'Nairobi',
    aliases: ['nairobi'],
    mood: 'Room for a city break',
    description: 'Leafy afternoons and a little time for yourselves.',
    image: '/images/destinations/nairobi.webp',
    alt: 'AI-generated scene of a leafy Nairobi-inspired garden',
  },
  {
    name: 'Maasai Mara',
    aliases: ['masaimara', 'maasaimara'],
    mood: 'A little more adventure',
    description: 'Big skies, open plains and stories to take home.',
    image: '/images/destinations/mara.webp',
    alt: 'AI-generated scene of acacia trees and golden Kenyan savannah',
  },
]

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, '')
}

export default function DestinationExplorer({ destinations }: { destinations: Destination[] }) {
  const active = destinations.filter((destination) => destination.is_active)
  const extra = active.filter((destination) => !stories.some((story) =>
    story.aliases.includes(normalise(destination.slug)) || story.aliases.includes(normalise(destination.name)),
  ))

  return (
    <section className={styles.section} id="destinations" aria-labelledby="destinations-title">
      <Reveal className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Find your somewhere</p>
          <h2 id="destinations-title">Good days begin <em>here.</em></h2>
        </div>
        <p>Ocean air or open skies. A weekend away or a longer pause. Find a little inspiration, and let&apos;s plan the care around your kind of holiday.</p>
      </Reveal>
      <Reveal className={styles.gallery}>
        {stories.map((story) => {
          const destination = active.find((row) => story.aliases.includes(normalise(row.slug)) || story.aliases.includes(normalise(row.name)))
          const name = destination?.name || story.name
          const image = destination?.image_url || story.image
          return (
            <Link
              key={story.name}
              className={styles.card}
              href={destination ? `/nannies?destination=${encodeURIComponent(name)}` : `/contact?destination=${encodeURIComponent(story.name)}`}
              aria-label={destination ? `Explore nannies in ${name}` : `Enquire about care in ${name}`}
            >
              <MediaImage src={image} alt={destination?.image_url ? name : story.alt} fill sizes="(max-width: 620px) 100vw, (max-width: 1000px) 50vw, 45vw" />
              <div className={styles.shade} />
              <div className={styles.cardCopy}>
                <span className={styles.mood}>{story.mood}</span>
                <h3>{name}</h3>
                <p>{destination?.description || story.description}</p>
                <span className={styles.cardLink}>{destination ? 'Explore nannies' : 'Enquire about care'} <span aria-hidden="true">↗</span></span>
              </div>
            </Link>
          )
        })}
      </Reveal>
      {extra.length > 0 && (
        <div className={styles.more}>
          <span>More places to make memories</span>
          {extra.map((destination) => <Link key={destination.id} href={`/nannies?destination=${encodeURIComponent(destination.name)}`}>{destination.name} <span aria-hidden="true">↗</span></Link>)}
        </div>
      )}
      <div className={styles.tail}>
        <div className={styles.invitation}>
          <CareIcon kind="sun" />
          <div><h3>Somewhere else in mind?</h3><p>Tell us where you&apos;re headed. We&apos;ll confirm care for your destination and dates.</p></div>
        </div>
        <Link className={styles.textLink} href="/contact">Let&apos;s talk about your trip <span aria-hidden="true">→</span></Link>
      </div>
      <p className={styles.credit}>AI-generated destination scenes are used where a destination photo hasn&apos;t been added.</p>
    </section>
  )
}
