import Link from 'next/link'
import MediaImage from '@/components/MediaImage'
import { formatKes, tierClass, tierLabel } from '@/lib/constants'
import { useSiteCatalog } from '@/components/SiteCatalogProvider'
import { tierLabels, tierRateMap } from '@/lib/catalog'
import { publicDailyRate, publicTier } from '@/lib/safeguarding'
import type { Nanny } from '@/lib/types'
import styles from './NannyCard.module.css'

export default function NannyCard({
  nanny,
  onBook,
}: {
  nanny: Nanny
  onBook?: (nanny: Nanny) => void
}) {
  const site = useSiteCatalog()
  const shownTier = publicTier(nanny)
  const rate = publicDailyRate(nanny, tierRateMap(site.tiers))
  const label = tierLabel(shownTier, tierLabels(site.tiers))
  const initials = nanny.display_name.split(/\s+/).filter(Boolean).slice(0, 2).map(name => name[0]).join('')
  const locations = [...new Set([nanny.town, ...nanny.destinations.slice(0, 2)].filter(Boolean))].join(' · ')
  return (
    <div className="nanny-card">
      <Link
        href={`/nannies/${nanny.slug}`}
        className="nc-photo"
        style={{ display: 'block', textDecoration: 'none' }}
      >
        {nanny.photo_url ? <MediaImage
          src={nanny.photo_url}
          alt={nanny.display_name}
          fill
          sizes="(max-width: 580px) 100vw, (max-width: 900px) 50vw, 400px"
        /> : <div className={styles.placeholder} aria-label="Profile photo not provided" role="img"><span>{initials}</span><p>A little introduction awaits</p></div>}
        <span className={`tier-pill ${tierClass(shownTier)}`}>{label}</span>
      </Link>
      <div className="nc-body">
        <Link
          href={`/nannies/${nanny.slug}`}
          className="nc-name"
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          {nanny.display_name}
        </Link>
        <div className="nc-loc">
          {locations}
        </div>
        {nanny.bio && <p className={styles.bio}>{nanny.bio}</p>}
        <div className="nc-stars">
          {nanny.review_count > 0 && nanny.rating_avg > 0 ? (
            <>
              <span aria-label={`${nanny.rating_avg.toFixed(1)} out of 5`}>
                {'★'.repeat(Math.round(nanny.rating_avg))}
              </span>{' '}
              ({nanny.review_count} reviews)
            </>
          ) : (
            'New to our community'
          )}
        </div>
        <div className="nc-tags">
          {(nanny.tags.length ? nanny.tags : nanny.languages)
            .slice(0, 4)
            .map((t) => (
              <span className="nc-tag" key={t}>
                {t}
              </span>
            ))}
        </div>
        <div className="nc-foot">
          <div className="nc-rate">
            {formatKes(rate)}
            <small>/day</small>
          </div>
          {onBook ? (
            <button className="book-btn" onClick={() => onBook(nanny)}>
              Request care
            </button>
          ) : (
            <Link
              href={`/nannies/${nanny.slug}`}
              className="book-btn"
              style={{ textDecoration: 'none' }}
            >
              View
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
