import { bookingBlocksAvailability, datesOverlap, parseCareType } from '@/lib/booking'
import { DESTINATIONS, normalizeTier } from '@/lib/constants'
import type { Booking, BookingStatus, CareType, Nanny, NannyTier } from '@/lib/types'

export const CERTIFICATION_FILTERS = [
  { id: 'first-aid', label: 'First Aid' },
  { id: 'cpr', label: 'CPR' },
  { id: 'paediatric', label: 'Paediatric First Aid' },
  { id: 'ecd', label: 'ECD / Montessori' },
  { id: 'nursing', label: 'Nursing' },
] as const

export type CertificationFilterId = (typeof CERTIFICATION_FILTERS)[number]['id']

export type NannySearchFilters = {
  destination?: string
  tier?: string
  q?: string
  infant?: boolean
  cert?: string
  busyIds?: Iterable<string>
}

export type MatchRequest = {
  destination?: string | null
  checkIn?: string | null
  checkOut?: string | null
  tier?: string | null
  youngestAge?: string | null
  notes?: string | null
  careType?: CareType | string | null
  infantRequired?: boolean
  excludeBookingId?: string | null
  excludeNannyIds?: Array<string | null | undefined>
}

export type ClashRow = {
  id: string
  nanny_id?: string | null
  check_in: string
  check_out: string
  status: BookingStatus
  nanny_response?: string | null
  parent_name?: string | null
}

export type MatchResult = {
  nanny: Nanny
  score: number
  eligible: boolean
  reasons: string[]
  blockers: string[]
}

const KENYA_DESTINATIONS = new Set(
  DESTINATIONS.filter(d => d !== 'Zanzibar').map(d => d.toLowerCase()),
)

const INFANT_RE = /\b(infant|newborn|baby|0\s*[–-]\s*12|0\s*[–-]\s*3\s*month|under\s*1)\b/i
const TODDLER_RE = /\b(toddler|1\s*[–-]\s*2|1\s*[–-]\s*3)\b/i

function haystack(nanny: Nanny): string {
  return [
    nanny.display_name,
    nanny.bio,
    nanny.town,
    nanny.county,
    ...nanny.destinations,
    ...nanny.languages,
    ...nanny.age_groups,
    ...nanny.services,
    ...nanny.certifications,
    ...nanny.tags,
  ].filter(Boolean).join(' ').toLowerCase()
}

function blob(nanny: Nanny): string {
  return [
    ...nanny.certifications,
    ...nanny.tags,
    ...nanny.services,
    ...nanny.age_groups,
    nanny.bio || '',
  ].join(' ').toLowerCase()
}

export function hasInfantCare(nanny: Nanny): boolean {
  return INFANT_RE.test(blob(nanny)) || nanny.age_groups.some(g => INFANT_RE.test(g))
}

export function bookingNeedsInfant(request: Pick<MatchRequest, 'youngestAge' | 'notes' | 'infantRequired'>): boolean {
  if (request.infantRequired) return true
  const age = String(request.youngestAge || '')
  if (/under\s*1|0\s*[–-]\s*12|newborn|infant/i.test(age)) return true
  return INFANT_RE.test(String(request.notes || ''))
}

export function parseCertificationFilter(value?: string | null): CertificationFilterId | null {
  const id = String(value || '').toLowerCase()
  switch (id) {
    case 'first-aid':
    case 'cpr':
    case 'paediatric':
    case 'ecd':
    case 'nursing':
      return id
    case '':
      return null
    default:
      return null
  }
}

export function hasCertification(nanny: Nanny, cert: CertificationFilterId): boolean {
  const text = blob(nanny)
  switch (cert) {
    case 'first-aid':
      return /first\s*-?\s*aid|cpr/.test(text)
    case 'cpr':
      return /\bcpr\b/.test(text)
    case 'paediatric':
      return /paediatric|pediatric/.test(text)
        || ((nanny.tier === 'silver' || nanny.tier === 'gold') && /first\s*-?\s*aid/.test(text))
    case 'ecd':
      return /\becd\b|montessori|early\s*child/.test(text)
    case 'nursing':
      return /nurs/.test(text)
    default: {
      const _never: never = cert
      return _never
    }
  }
}

function coversDestination(nanny: Nanny, destination?: string | null): 'exact' | 'travel' | 'none' {
  const dest = String(destination || '').trim()
  if (!dest || dest.toLowerCase() === 'other' || dest.toLowerCase() === 'any') return 'exact'
  const needle = dest.toLowerCase()
  if (nanny.destinations.some(d => d.toLowerCase() === needle || d.toLowerCase().includes(needle) || needle.includes(d.toLowerCase()))) {
    return 'exact'
  }
  const travel = (nanny.willing_to_travel || '').toLowerCase()
  if (travel === 'international') return 'travel'
  if (travel === 'kenya' && KENYA_DESTINATIONS.has(needle)) return 'travel'
  return 'none'
}

function skillNeedles(request: MatchRequest): string[] {
  const notes = String(request.notes || '').toLowerCase()
  const care = parseCareType(request.careType)
  const found: string[] = []
  if (care === 'overnight' || /overnight|night/.test(notes)) found.push('overnight')
  if (/swim/.test(notes)) found.push('swim')
  if (/special\s*needs|autism|adhd/.test(notes)) found.push('special needs')
  if (/tutor|homework|school/.test(notes)) found.push('tutor')
  if (/travel|flight|safari/.test(notes)) found.push('travel')
  if (/cook|meal|allerg/.test(notes)) found.push('cook')
  if (TODDLER_RE.test(String(request.youngestAge || '')) || TODDLER_RE.test(notes)) found.push('toddler')
  return found
}

function nannyHasSkill(nanny: Nanny, skill: string): boolean {
  return haystack(nanny).includes(skill)
}

export function nannyClash(
  nannyId: string,
  checkIn: string,
  checkOut: string,
  bookings: ClashRow[],
  excludeBookingId?: string | null,
): ClashRow | undefined {
  return bookings.find(other =>
    other.nanny_id === nannyId
    && other.id !== excludeBookingId
    && bookingBlocksAvailability(other.status, other.nanny_response)
    && datesOverlap(checkIn, checkOut, other.check_in, other.check_out),
  )
}

export function filterNannies(list: Nanny[], filters: NannySearchFilters): Nanny[] {
  const dest = String(filters.destination || '').trim()
  const tier = normalizeTier(filters.tier || '') 
  const q = String(filters.q || '').trim().toLowerCase()
  const cert = parseCertificationFilter(filters.cert)
  const busy = filters.busyIds ? new Set(filters.busyIds) : null

  return list.filter(n => {
    if (dest && dest.toLowerCase() !== 'any' && coversDestination(n, dest) === 'none') return false
    if (tier && n.tier !== tier) return false
    if (filters.infant && !hasInfantCare(n)) return false
    if (cert && !hasCertification(n, cert)) return false
    if (busy?.has(n.id)) return false
    if (q && !haystack(n).includes(q)) return false
    return true
  })
}

export function scoreNannyMatch(nanny: Nanny, request: MatchRequest, bookings: ClashRow[]): MatchResult {
  const reasons: string[] = []
  const blockers: string[] = []
  let score = Math.round((nanny.rating_avg || 0) * 2)

  const destCover = coversDestination(nanny, request.destination)
  if (destCover === 'exact') {
    score += 40
    if (request.destination) reasons.push(String(request.destination))
  } else if (destCover === 'travel') {
    score += 12
    reasons.push('willing to travel')
  } else if (request.destination && request.destination.toLowerCase() !== 'other') {
    blockers.push(`Doesn't cover ${request.destination}`)
  }

  const checkIn = request.checkIn
  const checkOut = request.checkOut
  if (checkIn && checkOut) {
    const clash = nannyClash(nanny.id, checkIn, checkOut, bookings, request.excludeBookingId)
    if (clash) {
      blockers.push(clash.parent_name
        ? `Busy: ${clash.parent_name} (${clash.check_in} → ${clash.check_out})`
        : 'Busy on those dates')
    } else {
      score += 20
      reasons.push('free on dates')
    }
  }

  const infantNeeded = bookingNeedsInfant(request)
  if (infantNeeded) {
    if (hasInfantCare(nanny)) {
      score += 25
      reasons.push('infant care')
    } else {
      blockers.push('No infant / newborn experience')
    }
  }

  for (const skill of skillNeedles(request)) {
    if (nannyHasSkill(nanny, skill)) {
      score += 8
      reasons.push(skill)
    }
  }

  const wantedTier = normalizeTier(request.tier || '')
  if (wantedTier) {
    if (nanny.tier === wantedTier) {
      score += 10
      reasons.push(`${wantedTier} tier`)
    } else if (tierRank(nanny.tier) > tierRank(wantedTier)) {
      score += 4
    }
  }

  const excluded = new Set((request.excludeNannyIds || []).filter(Boolean) as string[])
  if (excluded.has(nanny.id)) blockers.push('Already replaced on this booking')

  if (!nanny.is_active) blockers.push('Profile hidden')

  return {
    nanny,
    score,
    eligible: blockers.length === 0,
    reasons,
    blockers,
  }
}

function tierRank(tier: NannyTier): number {
  switch (tier) {
    case 'bronze':
      return 1
    case 'silver':
      return 2
    case 'gold':
      return 3
    default: {
      const _never: never = tier
      return _never
    }
  }
}

export function rankNannyMatches(
  nannies: Nanny[],
  request: MatchRequest,
  bookings: ClashRow[],
): MatchResult[] {
  return nannies
    .map(nanny => scoreNannyMatch(nanny, request, bookings))
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
      return b.score - a.score
    })
}

export function bestAvailableMatch(
  nannies: Nanny[],
  request: MatchRequest,
  bookings: ClashRow[],
): MatchResult | null {
  return rankNannyMatches(nannies, request, bookings).find(r => r.eligible) ?? null
}

export function matchRequestFromBooking(booking: Pick<
  Booking,
  'destination' | 'check_in' | 'check_out' | 'tier' | 'youngest_age' | 'notes' | 'care_type' | 'id' | 'replaced_nanny_id'
>): MatchRequest {
  return {
    destination: booking.destination,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    tier: booking.tier,
    youngestAge: booking.youngest_age,
    notes: booking.notes,
    careType: parseCareType(booking.care_type),
    excludeBookingId: booking.id,
    excludeNannyIds: [booking.replaced_nanny_id],
  }
}

export function matchLabel(result: MatchResult): string {
  if (!result.eligible) {
    return `${result.nanny.display_name} (${result.nanny.tier}) — ${result.blockers[0] || 'not a match'}`
  }
  const extra = result.reasons.slice(0, 3).join(' · ')
  return extra
    ? `${result.nanny.display_name} (${result.nanny.tier}) — ${extra}`
    : `${result.nanny.display_name} (${result.nanny.tier})`
}
