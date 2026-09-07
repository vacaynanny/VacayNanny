'use client'

import { useMemo, useState } from 'react'
import { addUtcDays, bookingBlocksAvailability, eachCareDate } from '@/lib/booking'
import type { Booking } from '@/lib/types'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfMonth(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toLocaleString('en-KE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export default function BookingCalendar({ bookings }: { bookings: Booking[] }) {
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })

  const busy = useMemo(() => {
    const map = new Map<string, Booking[]>()
    for (const booking of bookings) {
      if (!bookingBlocksAvailability(booking.status, booking.nanny_response)) continue
      for (const day of eachCareDate(booking.check_in, booking.check_out)) {
        const list = map.get(day) || []
        list.push(booking)
        map.set(day, list)
      }
    }
    return map
  }, [bookings])

  const first = startOfMonth(cursor.year, cursor.month)
  const nextMonth = cursor.month === 11 ? { year: cursor.year + 1, month: 0 } : { year: cursor.year, month: cursor.month + 1 }
  const last = startOfMonth(nextMonth.year, nextMonth.month)
  const startWeekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
  const days: (string | null)[] = []
  for (let i = 0; i < startWeekday; i++) days.push(null)
  for (let d = first; d < last; d = addUtcDays(d, 1)) days.push(d)

  const [selected, setSelected] = useState<string | null>(null)
  const selectedBookings = selected ? busy.get(selected) || [] : []

  return (
    <div className="cal">
      <div className="cal-nav">
        <button type="button" className="btn-ghost cal-nav-btn" onClick={() => setCursor(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 })}>←</button>
        <strong>{monthLabel(cursor.year, cursor.month)}</strong>
        <button type="button" className="btn-ghost cal-nav-btn" onClick={() => setCursor(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 })}>→</button>
      </div>
      <div className="cal-weekdays">
        {WEEKDAYS.map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="cal-grid">
        {days.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="cal-day empty" />
          const hits = busy.get(day) || []
          const inProgress = hits.some(b => b.status === 'in_progress')
          return (
            <button
              type="button"
              key={day}
              className={`cal-day${hits.length ? ' busy' : ''}${inProgress ? ' live' : ''}${selected === day ? ' on' : ''}`}
              onClick={() => setSelected(day)}
            >
              <span>{Number(day.slice(8))}</span>
              {hits.length > 0 && <i />}
            </button>
          )
        })}
      </div>
      {selected && (
        <div className="cal-detail">
          <p>{selected}</p>
          {selectedBookings.length === 0 && <p className="cal-muted">No placement this day.</p>}
          {selectedBookings.map(b => (
            <p key={b.id}>{b.destination} · {b.parent_name} · {b.status}</p>
          ))}
        </div>
      )}
    </div>
  )
}
