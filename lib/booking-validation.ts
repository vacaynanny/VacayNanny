import { eachCareDate } from './booking'
import { publicTier } from './safeguarding'
import type { Nanny } from './types'

export function validIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function todayInNairobi(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
export function validateCareDates(
  checkIn: unknown,
  checkOut: unknown,
  allowPast = false,
): string | null {
  if (!validIsoDate(checkIn) || !validIsoDate(checkOut))
    return 'Choose valid check-in and check-out dates.'
  if (checkOut < checkIn) return 'Check-out must be on or after check-in.'
  if (!allowPast && checkIn < todayInNairobi())
    return 'Care dates must be today or later.'
  if ((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000 > 366)
    return 'Care requests can cover up to one year.'
  return null
}
export function nannyWorksDates(
  nanny: Pick<Nanny, 'available_days'>,
  checkIn: string,
  checkOut: string,
) {
  if (validateCareDates(checkIn, checkOut, true)) return false
  const days = new Set(nanny.available_days)
  return eachCareDate(checkIn, checkOut).every((date) =>
    days.has(
      new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(
        new Date(`${date}T12:00:00Z`),
      ),
    ),
  )
}
export function childCapacity(nanny: Pick<Nanny, 'tier' | 'safeguarding_completed_at'>) {
  const tier = publicTier(nanny)
  return tier === 'gold' ? 4 : tier === 'silver' ? 3 : 2
}
export function requiredCapacity(children: unknown, nannies: unknown) {
  const count = Number(children),
    carers = Number(nannies)
  return Number.isInteger(count) && count > 0 && Number.isInteger(carers) && carers > 0
    ? Math.ceil(count / carers)
    : null
}
