export const WHATSAPP_NUMBER = '254796930612'
export const WHATSAPP_DISPLAY = '+254 796 930 612'
export const SUPPORT_EMAIL = 'hello@vacaynanny.net'
export const ADMIN_EMAIL = 'hello@vacaynanny.net'
export const SITE_HOST = 'www.vacaynanny.net'
export const SITE_URL = `https://${SITE_HOST}`

export function siteUrl(path = '') {
  const suffix = !path ? '' : path.startsWith('/') ? path : `/${path}`
  return `${SITE_URL}${suffix}`
}

export const DESTINATIONS = [
  'Diani Beach',
  'Malindi',
  'Watamu',
  'Nairobi',
  'Mombasa',
  'Lamu',
  'Masai Mara',
  'Amboseli',
  'Zanzibar',
] as const

export const TIERS = [
  { id: 'bronze', label: 'Bronze', alias: 'Basic', rate: 2200 },
  { id: 'silver', label: 'Silver', alias: 'Professional', rate: 3200 },
  { id: 'gold', label: 'Gold', alias: 'Elite', rate: 5200 },
] as const

export type TierId = (typeof TIERS)[number]['id']

export const TIER_RATES: Record<TierId, number> = {
  bronze: 2200,
  silver: 3200,
  gold: 5200,
}

export function tierLabel(tier?: string | null) {
  const t = (tier || '').toLowerCase()
  if (t === 'gold' || t === 'elite') return 'Elite'
  if (t === 'silver' || t === 'pro' || t === 'professional') return 'Pro'
  if (t === 'bronze' || t === 'basic' || t === 'standard') return 'Standard'
  return tier || 'Any'
}

export function tierClass(tier?: string | null) {
  const t = (tier || '').toLowerCase()
  if (t === 'gold' || t === 'elite') return 't-elite'
  if (t === 'silver' || t === 'pro' || t === 'professional') return 't-pro'
  return 't-basic'
}

export function normalizeTier(tier?: string | null): TierId | null {
  const t = (tier || '').toLowerCase()
  if (t === 'gold' || t === 'elite') return 'gold'
  if (t === 'silver' || t === 'pro' || t === 'professional') return 'silver'
  if (t === 'bronze' || t === 'basic' || t === 'standard') return 'bronze'
  return null
}

export function waLink(text = "Hi VacayNanny! I'd like to book a nanny.") {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
}

/** Normalize a phone into digits for wa.me (Kenya 0… → 254…). */
export function waDigits(phone?: string | null, countryCode?: string | null) {
  const local = (phone || '').replace(/\D/g, '')
  if (!local) return ''
  const cc = (countryCode || '').replace(/\D/g, '')
  if (local.startsWith('0') && cc) return `${cc}${local.slice(1)}`
  if (local.startsWith('0')) return `254${local.slice(1)}`
  if (cc && !local.startsWith(cc) && local.length <= 9) return `${cc}${local}`
  return local
}

export function waLinkTo(phone: string, text: string, countryCode?: string | null) {
  const digits = waDigits(phone, countryCode)
  if (!digits) return ''
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export function nannyAssignmentMessage(opts: {
  nannyName: string
  destination: string
  checkIn: string
  checkOut: string
}) {
  return `Hi ${opts.nannyName}, VacayNanny has a placement for you in ${opts.destination} (${opts.checkIn} → ${opts.checkOut}). Please accept or decline here: ${siteUrl('/nanny')}`
}

export function nannyAssignmentWaHref(
  phone: string | null | undefined,
  countryCode: string | null | undefined,
  opts: { nannyName: string; destination: string; checkIn: string; checkOut: string },
) {
  return waLinkTo(phone || '', nannyAssignmentMessage(opts), countryCode) || null
}

export function formatKes(amount: number) {
  return `KES ${amount.toLocaleString('en-KE')}`
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}
