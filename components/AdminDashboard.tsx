'use client'

import { statusLabel } from '@/lib/booking'
import type { ApplicationStatus, Booking, BookingStatus, NannyApplication, RegisteredAccount, UserRole } from '@/lib/types'

type Desk = 'applications' | 'bookings' | 'team'

const ACCOUNT_SLICES: Array<{ role: UserRole; label: string; color: string }> = [
  { role: 'parent', label: 'Families', color: '#E8714A' },
  { role: 'nanny', label: 'Nannies', color: '#5ec9b6' },
  { role: 'admin', label: 'Admins', color: '#C9963A' },
]

const BOOKING_COLORS: Record<BookingStatus, string> = {
  pending: '#C9963A',
  matched: '#E8714A',
  confirmed: '#5ec9b6',
  in_progress: '#7eb6ff',
  completed: '#c5d0d8',
  cancelled: '#e07a7a',
}

const APPLICATION_COLORS: Record<ApplicationStatus, string> = {
  pending: '#C9963A',
  reviewing: '#E8714A',
  interview: '#7eb6ff',
  approved: '#5ec9b6',
  rejected: '#e07a7a',
}

function countRole(accounts: RegisteredAccount[], role: UserRole) {
  return accounts.filter(account => account.role === role).length
}

function recentMonths(total: number) {
  const now = new Date()
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (total - 1 - index), 1)
    return date
  })
}

function inMonth(iso: string, month: Date) {
  const date = new Date(iso)
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
}

function Donut({ parts }: { parts: Array<{ label: string; value: number; color: string }> }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  const radius = 46
  const circumference = 2 * Math.PI * radius
  let cursor = 0
  const summary = parts.map(part => `${part.label} ${part.value}`).join(', ')

  return (
    <div className="dash-donut">
      <svg viewBox="0 0 120 120" role="img" aria-label={summary || 'No accounts'}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        {total > 0 && parts.map(part => {
          const length = (part.value / total) * circumference
          const ring = (
            <circle
              key={part.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={part.color}
              strokeWidth="12"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-cursor}
              transform="rotate(-90 60 60)"
            />
          )
          cursor += length
          return ring
        })}
        <text x="60" y="58" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700">{total}</text>
        <text x="60" y="74" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9">accounts</text>
      </svg>
      <ul className="dash-legend">
        {parts.map(part => (
          <li key={part.label}>
            <i style={{ background: part.color }} />
            <span>{part.label}</span>
            <strong>{part.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Bars({ rows }: { rows: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(1, ...rows.map(row => row.value))
  return (
    <ul className="dash-bars">
      {rows.map(row => (
        <li key={row.label}>
          <span>{row.label}</span>
          <span className="dash-bar-track" aria-hidden="true">
            <span style={{ width: `${(row.value / max) * 100}%`, background: row.color }} />
          </span>
          <strong>{row.value}</strong>
        </li>
      ))}
    </ul>
  )
}

export default function AdminDashboard({
  accounts,
  applications,
  bookings,
  onOpen,
}: {
  accounts: RegisteredAccount[]
  applications: NannyApplication[]
  bookings: Booking[]
  onOpen: (desk: Desk) => void
}) {
  const months = recentMonths(6)
  const signups = months.map(month => ({
    label: month.toLocaleDateString('en-GB', { month: 'short' }),
    value: accounts.filter(account => inMonth(account.registeredAt, month)).length,
  }))
  const signupMax = Math.max(1, ...signups.map(month => month.value))
  const bookingRows = (Object.keys(BOOKING_COLORS) as BookingStatus[]).map(status => ({
    label: statusLabel(status),
    value: bookings.filter(booking => booking.status === status).length,
    color: BOOKING_COLORS[status],
  }))
  const applicationRows = (Object.keys(APPLICATION_COLORS) as ApplicationStatus[]).map(status => ({
    label: status.charAt(0).toUpperCase() + status.slice(1),
    value: applications.filter(application => application.status === status).length,
    color: APPLICATION_COLORS[status],
  }))

  return (
    <div className="dash-board">
      <section className="ops-panel">
        <button type="button" className="dash-title" onClick={() => onOpen('team')}>Accounts</button>
        <Donut parts={ACCOUNT_SLICES.map(slice => ({
          label: slice.label,
          value: countRole(accounts, slice.role),
          color: slice.color,
        }))} />
      </section>

      <section className="ops-panel">
        <button type="button" className="dash-title" onClick={() => onOpen('team')}>Registrations</button>
        <p className="ops-note">New accounts over the last six months.</p>
        <div className="dash-cols" aria-label="Registrations by month">
          {signups.map(month => (
            <div className="dash-col-wrap" key={month.label}>
              <strong>{month.value}</strong>
              <div className="dash-col-track">
                <div className="dash-col" style={{ height: `${(month.value / signupMax) * 100}%` }} />
              </div>
              <small>{month.label}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="ops-panel">
        <button type="button" className="dash-title" onClick={() => onOpen('bookings')}>Bookings</button>
        <Bars rows={bookingRows} />
      </section>

      <section className="ops-panel">
        <button type="button" className="dash-title" onClick={() => onOpen('applications')}>Applications</button>
        <Bars rows={applicationRows} />
      </section>
    </div>
  )
}
