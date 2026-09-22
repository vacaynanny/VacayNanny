import { formatKes } from '@/lib/constants'
import { statusLabel, summarizeNannyEarnings } from '@/lib/booking'
import type { Booking } from '@/lib/types'

export default function NannyEarnings({ bookings }: { bookings: Booking[] }) {
  const stats = summarizeNannyEarnings(bookings)
  const completed = bookings.filter(b => b.status === 'completed')

  return (
    <div className="form-card">
      <h3>Earnings</h3>
      <p className="field-hint" style={{ marginBottom: 16 }}>
        Quoted family totals for your placements. Payouts are processed by VacayNanny after a booking is completed — this is not a wallet balance.
      </p>
      <div className="earnings-grid">
        <div>
          <div className="stat-num">{formatKes(stats.completedKes)}</div>
          <div className="stat-lbl">{stats.completedCount} completed</div>
        </div>
        <div>
          <div className="stat-num">{formatKes(stats.upcomingKes)}</div>
          <div className="stat-lbl">{stats.upcomingCount} upcoming{stats.inProgressCount ? ` · ${stats.inProgressCount} in progress` : ''}</div>
        </div>
      </div>
      {completed.length === 0 && (
        <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>No completed placements yet.</p>
      )}
      {completed.map(b => (
        <div className="review-row" key={b.id}>
          <span className="review-key">
            {b.destination} · {b.check_in} → {b.check_out}
            <br />
            <small>{b.parent_name} · {statusLabel(b.status)}</small>
          </span>
          <span className="review-val">{b.total_amount_kes != null ? formatKes(b.total_amount_kes) : '—'}</span>
        </div>
      ))}
    </div>
  )
}
