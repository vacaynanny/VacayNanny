import { TIER_RATES, formatKes, normalizeTier } from '@/lib/constants'
import type { BookingStatus, CareType } from '@/lib/types'

export const REPLACEMENT_SLA_MS = 2 * 60 * 60 * 1000

export const CARE_TYPES: {
  id: CareType
  label: string
  hours: number
  multiplier: number
  hint: string
}[] = [
  { id: 'standard', label: 'Standard (8 hours)', hours: 8, multiplier: 1, hint: 'Daytime shift included in the daily rate.' },
  { id: 'extended', label: 'Extended (12 hours)', hours: 12, multiplier: 1.5, hint: 'Four extra hours billed at 1.5× the daily rate.' },
  { id: 'overnight', label: 'Overnight care', hours: 16, multiplier: 2, hint: 'Overnight placement billed at 2× the daily rate.' },
]

export function parseCareType(value: unknown): CareType {
  const v = String(value || '').toLowerCase()
  if (v === 'extended' || v === '12' || v === '12h') return 'extended'
  if (v === 'overnight' || v === 'night') return 'overnight'
  return 'standard'
}

export function careTypeLabel(care: CareType): string {
  switch (care) {
    case 'standard':
      return 'Standard (8 hours)'
    case 'extended':
      return 'Extended (12 hours)'
    case 'overnight':
      return 'Overnight care'
    default: {
      const _never: never = care
      return _never
    }
  }
}

export function careTypeMultiplier(care: CareType): number {
  switch (care) {
    case 'standard':
      return 1
    case 'extended':
      return 1.5
    case 'overnight':
      return 2
    default: {
      const _never: never = care
      return _never
    }
  }
}

export function nannyCountFromNeeded(needed?: string | null): number {
  const n = parseInt(String(needed || '1'), 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, 3)
}

export function parseIsoDateUtc(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, (m || 1) - 1, d || 1)
}

export function addUtcDays(iso: string, days: number): string {
  return new Date(parseIsoDateUtc(iso) + days * 86400000).toISOString().slice(0, 10)
}

export function nightsOfCare(checkIn: string, checkOut: string): number {
  const days = Math.round((parseIsoDateUtc(checkOut) - parseIsoDateUtc(checkIn)) / 86400000)
  return Math.max(1, days || 1)
}

/** Exclusive end of the care range (same-day bookings cover that calendar day). */
export function careRangeEnd(checkIn: string, checkOut: string): string {
  const start = checkIn.slice(0, 10)
  const end = checkOut.slice(0, 10)
  if (end <= start) return addUtcDays(start, 1)
  return end
}

export function datesOverlap(
  aIn: string,
  aOut: string,
  bIn: string,
  bOut: string,
): boolean {
  return aIn.slice(0, 10) < careRangeEnd(bIn, bOut) && bIn.slice(0, 10) < careRangeEnd(aIn, aOut)
}

export function eachCareDate(checkIn: string, checkOut: string): string[] {
  const dates: string[] = []
  let cursor = checkIn.slice(0, 10)
  const end = careRangeEnd(checkIn, checkOut)
  while (cursor < end) {
    dates.push(cursor)
    cursor = addUtcDays(cursor, 1)
  }
  return dates
}

export function quoteBooking(opts: {
  checkIn: string
  checkOut: string
  careType: CareType
  tier?: string | null
  nanniesNeeded?: string | null
  dailyRateKes?: number | null
}): { nights: number; dailyRate: number; multiplier: number; nannyCount: number; total: number } {
  const nights = nightsOfCare(opts.checkIn, opts.checkOut)
  const dailyRate = opts.dailyRateKes && opts.dailyRateKes > 0
    ? opts.dailyRateKes
    : TIER_RATES[normalizeTier(opts.tier) || 'bronze']
  const multiplier = careTypeMultiplier(opts.careType)
  const nannyCount = nannyCountFromNeeded(opts.nanniesNeeded)
  const total = Math.round(dailyRate * nights * multiplier * nannyCount)
  return { nights, dailyRate, multiplier, nannyCount, total }
}

export function quoteSummary(quote: ReturnType<typeof quoteBooking>, careType: CareType): string {
  const days = quote.nights === 1 ? '1 day' : `${quote.nights} days`
  const nannies = quote.nannyCount === 1 ? '1 nanny' : `${quote.nannyCount} nannies`
  return `${formatKes(quote.total)} · ${days} · ${careTypeLabel(careType)} · ${nannies}`
}

export function hoursUntilCheckIn(checkIn: string, now = new Date()): number {
  const start = new Date(`${checkIn.slice(0, 10)}T00:00:00+03:00`)
  return (start.getTime() - now.getTime()) / 3_600_000
}

export function cancellationRefundPercent(checkIn: string, now = new Date()): number {
  const hours = hoursUntilCheckIn(checkIn, now)
  if (hours >= 48) return 100
  if (hours >= 24) return 50
  return 0
}

export function refundPolicyLabel(percent: number): string {
  switch (percent) {
    case 100:
      return 'Full refund (48+ hours before start)'
    case 50:
      return '50% refund (24–48 hours before start)'
    case 0:
      return 'No refund (under 24 hours)'
    default:
      return `${percent}% refund`
  }
}

export function bookingBlocksAvailability(
  status: BookingStatus,
  nannyResponse?: string | null,
): boolean {
  if (nannyResponse === 'declined') return false
  switch (status) {
    case 'matched':
    case 'confirmed':
    case 'in_progress':
      return true
    case 'pending':
    case 'completed':
    case 'cancelled':
      return false
    default: {
      const _never: never = status
      return _never
    }
  }
}

export function replacementDeadline(requestedAt: string): Date {
  return new Date(new Date(requestedAt).getTime() + REPLACEMENT_SLA_MS)
}

export function isReplacementOpen(booking: {
  replacement_requested_at?: string | null
  replacement_fulfilled_at?: string | null
  nanny_id?: string | null
}): boolean {
  return Boolean(booking.replacement_requested_at && !booking.replacement_fulfilled_at && !booking.nanny_id)
}

export function isReplacementOverdue(
  booking: {
    replacement_requested_at?: string | null
    replacement_fulfilled_at?: string | null
    nanny_id?: string | null
  },
  now = new Date(),
): boolean {
  if (!isReplacementOpen(booking) || !booking.replacement_requested_at) return false
  return now.getTime() >= replacementDeadline(booking.replacement_requested_at).getTime()
}

export function statusLabel(status: BookingStatus): string {
  switch (status) {
    case 'pending':
      return 'Awaiting match'
    case 'matched':
      return 'Nanny proposed'
    case 'confirmed':
      return 'Confirmed'
    case 'in_progress':
      return 'In progress'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    default: {
      const _never: never = status
      return _never
    }
  }
}

export function canLeaveReview(booking: {
  status: BookingStatus
  nanny_id?: string | null
  review?: { id: string } | null
}): boolean {
  return booking.status === 'completed' && Boolean(booking.nanny_id) && !booking.review
}

export function nannyResponseLabel(response?: string | null): string {
  switch (response) {
    case 'accepted':
      return 'Nanny accepted'
    case 'declined':
      return 'Nanny declined'
    case 'pending':
      return 'Waiting for nanny'
    default:
      return 'Not assigned'
  }
}
