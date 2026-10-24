import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_POLICIES,
  emptyCatalog,
  isMissingRelation,
  type BusinessPolicies,
  type CareOffering,
  type FaqEntry,
  type HomepageStep,
  type PricingAddon,
  type PricingTier,
  type SiteCatalog,
} from '@/lib/catalog'
import { hasSupabaseConfig } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import type { CareType, NannyTier } from '@/lib/types'

const DATA_MS = 2000

function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(DATA_MS) }),
      },
    },
  )
}

function num(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function mapTier(row: Record<string, unknown>): PricingTier {
  const code = String(row.code || '') as NannyTier
  return {
    code: code === 'silver' || code === 'gold' ? code : 'bronze',
    label: String(row.label || ''),
    cardTitle: String(row.card_title || row.label || ''),
    badge: String(row.badge || ''),
    description: String(row.description || ''),
    period: String(row.period || ''),
    dailyRateKes: num(row.daily_rate_kes),
    features: Array.isArray(row.features) ? row.features.map(item => String(item)) : [],
    cta: String(row.cta || 'Book'),
    sortOrder: num(row.sort_order),
    isActive: row.is_active !== false,
  }
}

function mapCare(row: Record<string, unknown>): CareOffering {
  const code = String(row.code || '') as CareType
  return {
    code: code === 'extended' || code === 'overnight' ? code : 'standard',
    label: String(row.label || ''),
    hours: num(row.hours, 8),
    multiplier: num(row.multiplier, 1),
    hint: String(row.hint || ''),
    sortOrder: num(row.sort_order),
    isActive: row.is_active !== false,
  }
}

function mapAddon(row: Record<string, unknown>): PricingAddon {
  const amount = row.amount_kes == null || row.amount_kes === '' ? null : num(row.amount_kes)
  return {
    id: String(row.id || ''),
    code: String(row.code || ''),
    name: String(row.name || ''),
    description: String(row.description || ''),
    amountKes: amount,
    pricingMode: row.pricing_mode === 'custom' || amount == null ? 'custom' : 'flat',
    sortOrder: num(row.sort_order),
    isActive: row.is_active !== false,
  }
}

function mapFaq(row: Record<string, unknown>): FaqEntry {
  return {
    id: String(row.id || ''),
    question: String(row.question || ''),
    answer: String(row.answer || ''),
    sortOrder: num(row.sort_order),
    isActive: row.is_active !== false,
  }
}

function mapStep(row: Record<string, unknown>): HomepageStep {
  return {
    id: String(row.id || ''),
    stepLabel: String(row.step_label || ''),
    title: String(row.title || ''),
    imageUrl: String(row.image_url || ''),
    imageAlt: String(row.image_alt || ''),
    sortOrder: num(row.sort_order),
    isActive: row.is_active !== false,
  }
}

export function mapPolicies(row: Record<string, unknown> | null | undefined): BusinessPolicies {
  if (!row) return DEFAULT_POLICIES
  return {
    replacementSlaHours: num(row.replacement_sla_hours, DEFAULT_POLICIES.replacementSlaHours),
    cancellationFullHours: num(row.cancellation_full_hours, DEFAULT_POLICIES.cancellationFullHours),
    cancellationPartialHours: num(row.cancellation_partial_hours, DEFAULT_POLICIES.cancellationPartialHours),
    cancellationPartialPercent: num(row.cancellation_partial_percent, DEFAULT_POLICIES.cancellationPartialPercent),
    standardShiftHours: num(row.standard_shift_hours, DEFAULT_POLICIES.standardShiftHours),
    recommendedLeadHours: num(row.recommended_lead_hours, DEFAULT_POLICIES.recommendedLeadHours),
    maxNannies: num(row.max_nannies, DEFAULT_POLICIES.maxNannies),
  }
}

/** Built-in copy used only when Supabase is not configured, or the catalog tables have not been created. */
export function demoCatalog(): SiteCatalog {
  return {
    source: 'demo',
    policies: DEFAULT_POLICIES,
    tiers: [
      {
        code: 'bronze',
        label: 'Standard',
        cardTitle: 'Bronze',
        badge: 'ENTRY',
        description: 'Reliable, caring nannies for straightforward childcare needs.',
        period: '{{standard_hours}}-hour shift · 1–2 children',
        dailyRateKes: 2200,
        features: [
          'Background-checked nanny',
          'Basic first-aid trained',
          'Ages 3–14 care',
          'Single-property coverage',
          'WhatsApp parent updates',
          '{{replacement_hours}}-hour replacement guarantee',
        ],
        cta: 'Get Started',
        sortOrder: 1,
        isActive: true,
      },
      {
        code: 'silver',
        label: 'Pro',
        cardTitle: 'Silver',
        badge: 'POPULAR',
        description: 'Enhanced care with certified skills for growing families.',
        period: '{{standard_hours}}-hour shift · Up to 3 children',
        dailyRateKes: 3200,
        features: [
          'Everything in Bronze',
          'Paediatric First Aid cert.',
          'Infant & toddler care',
          'Basic tutoring / homework',
          'Swimming supervision',
          'Bilingual (English + Swahili)',
        ],
        cta: 'Choose Silver',
        sortOrder: 2,
        isActive: true,
      },
      {
        code: 'gold',
        label: 'Elite',
        cardTitle: 'Gold',
        badge: 'ELITE',
        description: 'Premium international-standard care for discerning families.',
        period: '{{standard_hours}}-hour shift · Up to 4 children',
        dailyRateKes: 5200,
        features: [
          'Everything in Silver',
          'Newborn & special-needs care',
          'Passport-holder · Can travel abroad',
          'Montessori / early education',
          'Multilingual (3+ languages)',
          'Overnight care available',
        ],
        cta: 'Go Elite →',
        sortOrder: 3,
        isActive: true,
      },
    ],
    care: [
      { code: 'standard', label: 'Standard (8 hours)', hours: 8, multiplier: 1, hint: 'Daytime shift included in the daily rate.', sortOrder: 1, isActive: true },
      { code: 'extended', label: 'Extended shift (12 hrs)', hours: 12, multiplier: 1.5, hint: 'Four extra hours billed at 1.5× the daily rate.', sortOrder: 2, isActive: true },
      { code: 'overnight', label: 'Overnight care', hours: 16, multiplier: 2, hint: 'Overnight placement billed at 2× the daily rate.', sortOrder: 3, isActive: true },
    ],
    addons: [
      { id: 'demo-airport', code: 'airport-escort', name: 'Airport transfer escort', description: '', amountKes: 800, pricingMode: 'flat', sortOrder: 1, isActive: true },
      { id: 'demo-meals', code: 'meal-preparation', name: 'Meal preparation', description: '', amountKes: 500, pricingMode: 'flat', sortOrder: 2, isActive: true },
      { id: 'demo-tutoring', code: 'light-tutoring', name: 'Light tutoring session', description: '', amountKes: 600, pricingMode: 'flat', sortOrder: 3, isActive: true },
      { id: 'demo-activities', code: 'activity-coordination', name: 'Activity coordination', description: '', amountKes: 700, pricingMode: 'flat', sortOrder: 4, isActive: true },
      { id: 'demo-second', code: 'second-nanny', name: 'Second nanny (twin/triplet care)', description: '', amountKes: 3000, pricingMode: 'flat', sortOrder: 5, isActive: true },
      { id: 'demo-travel', code: 'international-travel', name: 'International travel', description: '', amountKes: null, pricingMode: 'custom', sortOrder: 6, isActive: true },
    ],
    faqs: DEMO_FAQS,
    steps: [
      { id: 'demo-step-1', stepLabel: 'Step 1', title: 'Search & Filter', imageUrl: '/images/step-1.png', imageAlt: 'Search on app', sortOrder: 1, isActive: true },
      { id: 'demo-step-2', stepLabel: 'Step 2', title: 'Choose Your Nanny', imageUrl: '/images/step-2.png', imageAlt: 'Choose nanny', sortOrder: 2, isActive: true },
      { id: 'demo-step-3', stepLabel: 'Step 3', title: 'Secure Booking', imageUrl: '/images/step-3.png', imageAlt: 'Book securely', sortOrder: 3, isActive: true },
      { id: 'demo-step-4', stepLabel: 'Step 4', title: 'Enjoy Your Holiday', imageUrl: '/images/step-4.png', imageAlt: 'Enjoy holiday', sortOrder: 4, isActive: true },
    ],
  }
}

const DEMO_FAQS: FaqEntry[] = [
  {
    id: 'demo-faq-1',
    sortOrder: 1,
    isActive: true,
    question: 'Are your nannies background-checked?',
    answer: 'Yes. Every nanny on VacayNanny undergoes a multi-layer vetting process including national ID verification, police clearance certificate (CoGC), reference checks, and an in-person or video interview. Gold-tier nannies also complete a safeguarding training module.',
  },
  {
    id: 'demo-faq-2',
    sortOrder: 2,
    isActive: true,
    question: 'How far in advance should I book?',
    answer: 'We recommend booking at least {{lead_hours}} hours ahead for standard placements. For peak season (December–January, Easter, August) please book 1–2 weeks in advance to guarantee your preferred tier.',
  },
  {
    id: 'demo-faq-3',
    sortOrder: 3,
    isActive: true,
    question: "What happens if my nanny can't make it on the day?",
    answer: 'We guarantee a replacement nanny within {{replacement_hours}} hours or your booking fee is fully refunded. Our coverage team monitors all active placements.',
  },
  {
    id: 'demo-faq-4',
    sortOrder: 4,
    isActive: true,
    question: 'Do nannies travel with us to other countries?',
    answer: "Yes. Gold-tier (Elite) nannies are passport-holders experienced in international travel. Travel arrangements (flights, accommodation) are at the client's expense. See our terms for details.",
  },
  {
    id: 'demo-faq-5',
    sortOrder: 5,
    isActive: true,
    question: 'What are the nanny working hours?',
    answer: 'Standard shifts are {{standard_hours}} hours. Extended shifts and overnight care are billed as a multiple of the daily rate, using the care packages on this page. Optional add-ons are charged at the published amount.',
  },
  {
    id: 'demo-faq-6',
    sortOrder: 6,
    isActive: true,
    question: 'Can I request the same nanny for multiple days?',
    answer: 'Yes. When you book recurring days, we prioritise continuity so your children have a consistent carer. Specify this preference in the booking notes.',
  },
  {
    id: 'demo-faq-7',
    sortOrder: 7,
    isActive: true,
    question: 'Are nannies trained in first aid?',
    answer: 'All Silver and Gold nannies hold a valid paediatric first-aid certificate. Bronze nannies have basic first-aid knowledge. You can filter by certification on the nanny search page.',
  },
  {
    id: 'demo-faq-8',
    sortOrder: 8,
    isActive: true,
    question: 'What is the cancellation policy?',
    answer: 'Full refund if cancelled {{cancel_full_hours}} or more hours before the start time. {{cancel_partial_percent}}% refund from {{cancel_partial_hours}} hours up to that point. No refund for cancellations under {{cancel_partial_hours}} hours except in cases of verified emergency.',
  },
  {
    id: 'demo-faq-9',
    sortOrder: 9,
    isActive: true,
    question: 'Can nannies handle infants?',
    answer: 'Yes. Indicate infant care as a required skill when booking and we will match you with a nanny who has newborn or infant experience. Infant care is available across tiers and is most experienced at Silver and above.',
  },
  {
    id: 'demo-faq-10',
    sortOrder: 10,
    isActive: true,
    question: 'How are nannies paid?',
    answer: "All payments go through VacayNanny. Families do not pay the nanny directly. This protects both parties and keeps the quality guarantee in force. Nannies are paid after each completed booking.",
  },
  {
    id: 'demo-faq-11',
    sortOrder: 11,
    isActive: true,
    question: 'Is VacayNanny available outside Kenya?',
    answer: "We currently operate in Kenya's major tourism corridors (Diani, Malindi, Watamu, Nairobi, Mombasa, Lamu, and the national parks). We are expanding to Zanzibar, Rwanda, and South Africa. Join the waitlist to hear when a new country opens.",
  },
]

type DbError = { code?: string; message?: string } | null

function rowsOf(result: { data: unknown; error: DbError }): Record<string, unknown>[] {
  if (result.error || !Array.isArray(result.data)) return []
  return result.data as Record<string, unknown>[]
}

function listed(supabase: SupabaseClient, table: string, activeOnly: boolean) {
  const query = supabase.from(table).select('*')
  return activeOnly ? query.eq('is_active', true).order('sort_order') : query.order('sort_order')
}

async function readCatalog(supabase: SupabaseClient, activeOnly: boolean): Promise<SiteCatalog | 'missing'> {
  const [tierRes, careRes, addonRes, faqRes, stepRes, policyRes] = await Promise.all([
    listed(supabase, 'pricing_tiers', activeOnly),
    listed(supabase, 'care_offerings', activeOnly),
    listed(supabase, 'pricing_addons', activeOnly),
    listed(supabase, 'faqs', activeOnly),
    listed(supabase, 'homepage_steps', activeOnly),
    supabase.from('business_policies').select('*').eq('id', 1).maybeSingle(),
  ])
  if (
    isMissingRelation(tierRes.error)
    || isMissingRelation(careRes.error)
    || isMissingRelation(faqRes.error)
    || isMissingRelation(stepRes.error)
  ) {
    return 'missing'
  }
  return {
    source: 'database',
    tiers: rowsOf(tierRes).map(mapTier),
    care: rowsOf(careRes).map(mapCare),
    addons: rowsOf(addonRes).map(mapAddon),
    faqs: rowsOf(faqRes).map(mapFaq),
    steps: rowsOf(stepRes).map(mapStep),
    policies: policyRes.error ? DEFAULT_POLICIES : mapPolicies(policyRes.data as Record<string, unknown> | null),
  }
}

/** Public catalog. Demo copy is used only without Supabase, or before the catalog tables exist. */
export async function getSiteCatalog(): Promise<SiteCatalog> {
  if (!hasSupabaseConfig()) return demoCatalog()
  return withTimeout((async () => {
    try {
      const catalog = await readCatalog(publicClient(), true)
      if (catalog === 'missing') return demoCatalog()
      return catalog
    } catch {
      return emptyCatalog()
    }
  })(), DATA_MS, emptyCatalog())
}

export type QuoteCatalog = {
  persisted: boolean
  tiers: PricingTier[]
  care: CareOffering[]
  addons: PricingAddon[]
  policies: BusinessPolicies
}

/** Rates and policies for a booking write. Uses the same rows as the public site. */
export async function loadQuoteCatalog(supabase: SupabaseClient): Promise<QuoteCatalog> {
  try {
    const catalog = await readCatalog(supabase, true)
    if (catalog === 'missing') {
      const demo = demoCatalog()
      return { persisted: false, tiers: demo.tiers, care: demo.care, addons: demo.addons, policies: demo.policies }
    }
    return {
      persisted: true,
      tiers: catalog.tiers,
      care: catalog.care,
      addons: catalog.addons,
      policies: catalog.policies,
    }
  } catch {
    const demo = demoCatalog()
    return { persisted: false, tiers: demo.tiers, care: demo.care, addons: demo.addons, policies: demo.policies }
  }
}

export async function tierDailyRate(supabase: SupabaseClient, code: NannyTier): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('pricing_tiers')
      .select('daily_rate_kes')
      .eq('code', code)
      .maybeSingle()
    if (!error && data && num(data.daily_rate_kes) > 0) return num(data.daily_rate_kes)
  } catch {
    // Fall through to the built-in rate when the catalog table is not installed.
  }
  const demo = demoCatalog().tiers.find(tier => tier.code === code)
  return demo?.dailyRateKes || 0
}

/** Admin editor payload, including hidden rows. Null when the tables are not installed. */
export async function getAdminCatalog(supabase: SupabaseClient): Promise<SiteCatalog | null> {
  try {
    const catalog = await readCatalog(supabase, false)
    if (catalog === 'missing') return null
    return catalog
  } catch {
    return null
  }
}
