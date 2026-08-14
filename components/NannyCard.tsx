import Link from 'next/link'
import { formatKes, tierClass, tierLabel } from '@/lib/constants'
import type { Nanny } from '@/lib/types'

export default function NannyCard({
  nanny,
  onBook,
}: {
  nanny: Nanny
  onBook?: (nanny: Nanny) => void
}) {
  return (
    <div className="nanny-card">
      <Link href={`/nannies/${nanny.slug}`} className="nc-photo" style={{ display: 'block' }}>
        <img src={nanny.photo_url || '/images/top-right.png'} alt={nanny.display_name} />
        <span className={`tier-pill ${tierClass(nanny.tier)}`}>{tierLabel(nanny.tier)}</span>
      </Link>
      <div className="nc-body">
        <Link href={`/nannies/${nanny.slug}`} className="nc-name" style={{ color: 'inherit', textDecoration: 'none' }}>
          {nanny.display_name}
        </Link>
        <div className="nc-loc">📍 {[nanny.town, nanny.destinations.slice(0, 2).join(' · ')].filter(Boolean).join(' · ')}</div>
        <div className="nc-stars">
          <span>{'★'.repeat(Math.round(nanny.rating_avg || 5))}</span> ({nanny.review_count} reviews)
        </div>
        <div className="nc-tags">
          {(nanny.tags.length ? nanny.tags : nanny.languages).slice(0, 4).map(t => (
            <span className="nc-tag" key={t}>{t}</span>
          ))}
        </div>
        <div className="nc-foot">
          <div className="nc-rate">{formatKes(nanny.daily_rate_kes)}<small>/day</small></div>
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
