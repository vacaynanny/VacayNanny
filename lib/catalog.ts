import type { TierId } from '@/lib/constants'
import type { CareType, NannyTier } from '@/lib/types'

/** Published tier. Codes stay aligned with the nanny_tier enum; labels, copy, and rates are editable. */
export type PricingTier = {
  code: TierId
  label: string
  cardTitle: string
  badge: string
  description: string
  period: string
  dailyRateKes: number
  features: string[]
  cta: string
  sortOrder: number
  isActive: boolean
}

/** Shift length billed as a multiple of the daily rate. The booking quote uses `multiplier`. */
export type CareOffering = {
  code: CareType
  label: string
  hours: number
  multiplier: number
  hint: string
  sortOrder: number
  isActive: boolean
}

/** Optional extras. Flat rows add `amountKes` once. Custom rows are quoted by hand. */
export type PricingAddon = {
  id: string
  code: string
  name: string
  description: string
  amountKes: number | null
  pricingMode: 'flat' | 'custom'
  sortOrder: number
  isActive: boolean
}

export type FaqEntry = {
  id: string
  question: string
  answer: string
  sortOrder: number
  isActive: boolean
}

export type HomepageStep = {
  id: string
  stepLabel: string
  title: string
  imageUrl: string
  imageAlt: string
  sortOrder: number
  isActive: boolean
}

export type BusinessPolicies = {
  replacementSlaHours: number
  cancellationFullHours: number
  cancellationPartialHours: number
  cancellationPartialPercent: number
  standardShiftHours: number
  recommendedLeadHours: number
  maxNannies: number
}

export type SiteCatalog = {
  /** `demo` is the built-in copy used only when Supabase is not configured or the catalog tables are not installed yet. */
  source: 'database' | 'demo'
  tiers: PricingTier[]
  care: CareOffering[]
  addons: PricingAddon[]
  faqs: FaqEntry[]
  steps: HomepageStep[]
  policies: BusinessPolicies
}

export type QuoteRates = {
  tierRates: Partial<Record<NannyTier, number>>
  careMultipliers: Partial<Record<CareType, number>>
  addons: { code: string; amountKes: number }[]
}

export const DEFAULT_POLICIES: BusinessPolicies = {
  replacementSlaHours: 2,
  cancellationFullHours: 48,
  cancellationPartialHours: 24,
  cancellationPartialPercent: 50,
  standardShiftHours: 8,
  recommendedLeadHours: 72,
  maxNannies: 3,
}

export function emptyCatalog(): SiteCatalog {
  return {
    source: 'database',
    tiers: [],
    care: [],
    addons: [],
    faqs: [],
    steps: [],
    policies: DEFAULT_POLICIES,
  }
}

export function quoteRatesFromCatalog(catalog: Pick<SiteCatalog, 'tiers' | 'care' | 'addons'>): QuoteRates {
  const tierRates: QuoteRates['tierRates'] = {}
  for (const tier of catalog.tiers) {
    if (tier.isActive && tier.dailyRateKes > 0) tierRates[tier.code] = tier.dailyRateKes
  }
  const careMultipliers: QuoteRates['careMultipliers'] = {}
  for (const care of catalog.care) {
    if (care.isActive && care.multiplier > 0) careMultipliers[care.code] = care.multiplier
  }
  const addons = catalog.addons
    .filter(addon => addon.isActive && addon.pricingMode === 'flat' && addon.amountKes && addon.amountKes > 0)
    .map(addon => ({ code: addon.code, amountKes: addon.amountKes as number }))
  return { tierRates, careMultipliers, addons }
}

export function tierLabels(tiers: PricingTier[]): Partial<Record<TierId, string>> {
  const labels: Partial<Record<TierId, string>> = {}
  for (const tier of tiers) {
    if (tier.isActive && tier.label) labels[tier.code] = tier.label
  }
  return labels
}

export function tierRateMap(tiers: PricingTier[]): Partial<Record<NannyTier, number>> {
  return quoteRatesFromCatalog({ tiers, care: [], addons: [] }).tierRates
}

export function tierOptionLabel(tier: PricingTier): string {
  if (!tier.label || tier.label.toLowerCase() === tier.cardTitle.toLowerCase()) return tier.cardTitle
  return `${tier.cardTitle} (${tier.label})`
}

export function applyPolicyTokens(text: string, policies: BusinessPolicies): string {
  return text
    .replaceAll('{{replacement_hours}}', String(policies.replacementSlaHours))
    .replaceAll('{{cancel_full_hours}}', String(policies.cancellationFullHours))
    .replaceAll('{{cancel_partial_hours}}', String(policies.cancellationPartialHours))
    .replaceAll('{{cancel_partial_percent}}', String(policies.cancellationPartialPercent))
    .replaceAll('{{standard_hours}}', String(policies.standardShiftHours))
    .replaceAll('{{lead_hours}}', String(policies.recommendedLeadHours))
}

export function formatCareMultiplier(multiplier: number): string {
  const value = Number(multiplier)
  const text = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
  return `${text}× daily rate`
}

export function parseAddonCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const codes: string[] = []
  for (const item of raw) {
    const code = String(item || '').trim()
    if (!code || codes.includes(code) || codes.length >= 12) continue
    codes.push(code)
  }
  return codes
}

export function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /does not exist|schema cache|could not find the table/i.test(error.message || '')
}
