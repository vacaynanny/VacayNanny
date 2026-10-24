import Link from 'next/link'
import MediaImage from '@/components/MediaImage'
import { formatKes, tierClass, tierLabel } from '@/lib/constants'
import { useSiteCatalog } from '@/components/SiteCatalogProvider'
import { tierLabels, tierRateMap } from '@/lib/catalog'
import { publicDailyRate, publicTier } from '@/lib/safeguarding'
import type { Nanny } from '@/lib/types'

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
  return (
    <div className="nanny-card">
      <Link href={`/nannies/${nanny.slug}`} className="nc-photo" style={{ display: 'block' }}>
        <MediaImage src={nanny.photo_url || '/images/top-right.png'} alt={nanny.display_name} fill sizes="(max-width: 700px) 100vw, 320px" />
        <span className={`tier-pill ${tierClass(shownTier)}`}>{label}</span>
      </Link>
      <div className="nc-body">
        <Link href={`/nannies/${nanny.slug}`} className="nc-name" style={{ color: 'inherit', textDecoration: 'none' }}>
          {nanny.display_name}
        </Link>
        <div className="nc-loc">{[nanny.town, nanny.destinations.slice(0, 2).join(' · ')].filter(Boolean).join(' · ')}</div>
        <div className="nc-stars">
          <span>{'★'.repeat(Math.round(nanny.rating_avg || 5))}</span> ({nanny.review_count} reviews)
        </div>
        <div className="nc-tags">
          {(nanny.tags.length ? nanny.tags : nanny.languages).slice(0, 4).map(t => (
            <span className="nc-tag" key={t}>{t}</span>
          ))}
        </div>
        <div className="nc-foot">
          <div className="nc-rate">{formatKes(rate)}<small>/day</small></div>
          {onBook ? (
            <button className="book-btn" onClick={() => onBook(nanny)}>Book Now</button>
          ) : (
            <Link href={`/nannies/${nanny.slug}`} className="book-btn" style={{ textDecoration: 'none' }}>View</Link>
          )}
        </div>
      </div>
    </div>
  )
}
