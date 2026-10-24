import type { BusinessPolicies, QuoteRates } from '@/lib/catalog'
import { TIER_RATES, formatKes, normalizeTier } from '@/lib/constants'
import type { Booking, BookingStatus, CareType } from '@/lib/types'

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

export function careTypeLabel(care: CareType, custom?: string | null): string {
  if (custom) return custom
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

export function nannyCountFromNeeded(needed?: string | null, maxNannies = 3): number {
  const cap = Number.isFinite(maxNannies) && maxNannies > 0 ? Math.min(maxNannies, 10) : 3
  const n = parseInt(String(needed || '1'), 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, cap)
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

function positiveRate(value?: number | null): number | null {
  return value && value > 0 ? value : null
}

export function quoteBooking(opts: {
  checkIn: string
  checkOut: string
  careType: CareType
  tier?: string | null
  nanniesNeeded?: string | null
  dailyRateKes?: number | null
  rates?: QuoteRates
  addonCodes?: string[]
  maxNannies?: number
  /** When true, a missing catalog rate stays unset instead of using the built-in tier table. */
  strictRates?: boolean
}): { nights: number; dailyRate: number; multiplier: number; nannyCount: number; addonTotal: number; total: number } {
  const nights = nightsOfCare(opts.checkIn, opts.checkOut)
  const tier = normalizeTier(opts.tier) || 'bronze'
  const dailyRate = positiveRate(opts.dailyRateKes)
    ?? positiveRate(opts.rates?.tierRates?.[tier])
    ?? (opts.strictRates ? 0 : TIER_RATES[tier])
  const listedMultiplier = opts.rates?.careMultipliers?.[opts.careType]
  const multiplier = listedMultiplier && listedMultiplier > 0
    ? listedMultiplier
    : (opts.strictRates ? (opts.careType === 'standard' ? 1 : 0) : careTypeMultiplier(opts.careType))
  const nannyCount = nannyCountFromNeeded(opts.nanniesNeeded, opts.maxNannies)
  const selected = new Set(opts.addonCodes || [])
  const addonTotal = (opts.rates?.addons || [])
    .filter(addon => selected.has(addon.code))
    .reduce((sum, addon) => sum + addon.amountKes, 0)
  const total = dailyRate > 0 && multiplier > 0
    ? Math.round(dailyRate * nights * multiplier * nannyCount) + addonTotal
    : 0
  return { nights, dailyRate, multiplier, nannyCount, addonTotal, total }
}

export function quoteSummary(quote: ReturnType<typeof quoteBooking>, careType: CareType, careLabel?: string | null): string {
  if (quote.dailyRate <= 0 || quote.multiplier <= 0) return 'Published rates are not available for this request yet.'
  const days = quote.nights === 1 ? '1 day' : `${quote.nights} days`
  const nannies = quote.nannyCount === 1 ? '1 nanny' : `${quote.nannyCount} nannies`
  const base = `${formatKes(quote.total)} · ${days} · ${careTypeLabel(careType, careLabel)} · ${nannies}`
  if (quote.addonTotal > 0) return `${base} · includes ${formatKes(quote.addonTotal)} in add-ons`
  return base
}

export function hoursUntilCheckIn(checkIn: string, now = new Date()): number {
  return (placementStartAt(checkIn).getTime() - now.getTime()) / 3_600_000
}

/** Midnight East Africa Time on the check-in date. */
export function placementStartAt(checkIn: string): Date {
  return new Date(`${checkIn.slice(0, 10)}T00:00:00+03:00`)
}

/** Midnight East Africa Time on the exclusive care end (checkout day, or next day for same-day). */
export function placementEndAt(checkIn: string, checkOut: string): Date {
  return new Date(`${careRangeEnd(checkIn, checkOut)}T00:00:00+03:00`)
}

/** Next status if check-in/out has elapsed. Never moves a booking backwards. */
export function dueBookingStatus(
  booking: { status: BookingStatus; check_in: string; check_out: string },
  now = new Date(),
): BookingStatus | null {
  switch (booking.status) {
    case 'confirmed': {
      if (now.getTime() >= placementEndAt(booking.check_in, booking.check_out).getTime()) return 'completed'
      if (now.getTime() >= placementStartAt(booking.check_in).getTime()) return 'in_progress'
      return null
    }
    case 'in_progress': {
      if (now.getTime() >= placementEndAt(booking.check_in, booking.check_out).getTime()) return 'completed'
      return null
    }
    case 'pending':
    case 'matched':
    case 'completed':
    case 'cancelled':
      return null
    default: {
      const _never: never = booking.status
      return _never
    }
  }
}

export function bookingHasThread(booking: { nanny_id?: string | null; status: BookingStatus }): boolean {
  if (!booking.nanny_id) return false
  switch (booking.status) {
    case 'matched':
    case 'confirmed':
    case 'in_progress':
    case 'completed':
      return true
    case 'pending':
    case 'cancelled':
      return false
    default: {
      const _never: never = booking.status
      return _never
    }
  }
}

export function cancellationRefundPercent(
  checkIn: string,
  now = new Date(),
  policy?: Pick<BusinessPolicies, 'cancellationFullHours' | 'cancellationPartialHours' | 'cancellationPartialPercent'>,
): number {
  const hours = hoursUntilCheckIn(checkIn, now)
  const full = policy?.cancellationFullHours ?? 48
  const partial = policy?.cancellationPartialHours ?? 24
  const partialPercent = policy?.cancellationPartialPercent ?? 50
  if (hours >= full) return 100
  if (hours >= partial) return partialPercent
  return 0
}

export function refundPolicyLabel(
  percent: number,
  policy?: Pick<BusinessPolicies, 'cancellationFullHours' | 'cancellationPartialHours' | 'cancellationPartialPercent'>,
): string {
  const full = policy?.cancellationFullHours ?? 48
  const partial = policy?.cancellationPartialHours ?? 24
  const partialPercent = policy?.cancellationPartialPercent ?? 50
  if (percent === 100) return `Full refund (${full}+ hours before start)`
  if (percent === partialPercent) return `${percent}% refund (${partial}–${full} hours before start)`
  if (percent === 0) return `No refund (under ${partial} hours)`
  return `${percent}% refund`
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

export function replacementSlaMs(hours?: number): number {
  const value = Number(hours)
  if (!Number.isFinite(value) || value <= 0) return REPLACEMENT_SLA_MS
  return value * 60 * 60 * 1000
}

export function replacementDeadline(requestedAt: string, slaMs = REPLACEMENT_SLA_MS): Date {
  return new Date(new Date(requestedAt).getTime() + slaMs)
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
  slaMs = REPLACEMENT_SLA_MS,
): boolean {
  if (!isReplacementOpen(booking) || !booking.replacement_requested_at) return false
  return now.getTime() >= replacementDeadline(booking.replacement_requested_at, slaMs).getTime()
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

export type NannyEarnings = {
  completedCount: number
  completedKes: number
  upcomingCount: number
  upcomingKes: number
  inProgressCount: number
}

export function summarizeNannyEarnings(bookings: Booking[]): NannyEarnings {
  let completedCount = 0
  let completedKes = 0
  let upcomingCount = 0
  let upcomingKes = 0
  let inProgressCount = 0
  for (const booking of bookings) {
    const amount = booking.total_amount_kes || 0
    switch (booking.status) {
      case 'completed':
        completedCount += 1
        completedKes += amount
        break
      case 'confirmed':
        upcomingCount += 1
        upcomingKes += amount
        break
      case 'in_progress':
        inProgressCount += 1
        upcomingCount += 1
        upcomingKes += amount
        break
      case 'pending':
      case 'matched':
      case 'cancelled':
        break
      default: {
        const _never: never = booking.status
        void _never
      }
    }
  }
  return { completedCount, completedKes, upcomingCount, upcomingKes, inProgressCount }
}
