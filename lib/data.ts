import { createClient } from '@supabase/supabase-js'
import { hasSupabaseConfig } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import type { Destination, Nanny, Review } from '@/lib/types'

/** Keep pages snappy when Supabase is paused/unreachable. */
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
    }
  )
}

export const FALLBACK_NANNIES: Nanny[] = [
  {
    id: 'fallback-amara',
    user_id: null,
    application_id: null,
    slug: 'amara-ochieng',
    display_name: 'Amara Ochieng',
    photo_url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&auto=format&fit=crop',
    bio: 'Warm, energetic Elite nanny with a decade of infant and toddler care along the south coast.',
    tier: 'gold',
    daily_rate_kes: 4500,
    county: 'Kwale',
    town: 'Diani Beach',
    destinations: ['Diani Beach', 'Mombasa'],
    languages: ['English', 'Swahili'],
    age_groups: ['Infants (0–12 months)', 'Toddlers (1–3 years)'],
    services: ['Daytime childcare', 'Overnight care', 'Travel nanny'],
    certifications: ['CPR', 'First Aid'],
    tags: ['Infant care', 'CPR/First Aid', 'Swahili/English', 'Swimming'],
    available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    willing_to_travel: 'kenya',
    is_active: true,
    rating_avg: 5,
    review_count: 48,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-faith',
    user_id: null,
    application_id: null,
    slug: 'faith-wanjiku',
    display_name: 'Faith Wanjiku',
    photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop',
    bio: 'Professional nanny who splits time between Nairobi and the coast.',
    tier: 'silver',
    daily_rate_kes: 3200,
    county: 'Nairobi',
    town: 'Westlands',
    destinations: ['Nairobi', 'Mombasa'],
    languages: ['English', 'Kikuyu'],
    age_groups: ['Toddlers (1–3 years)', 'School-age (6–12 years)'],
    services: ['Daytime childcare', 'Homework help'],
    certifications: ['First Aid'],
    tags: ['Ages 2–10', 'Arts & Crafts', 'English/Kikuyu', 'Tutoring'],
    available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    willing_to_travel: 'kenya',
    is_active: true,
    rating_avg: 5,
    review_count: 31,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-grace',
    user_id: null,
    application_id: null,
    slug: 'grace-atieno',
    display_name: 'Grace Atieno',
    photo_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&auto=format&fit=crop',
    bio: 'Elite travel nanny based in Malindi. Montessori-informed and comfortable with newborns.',
    tier: 'gold',
    daily_rate_kes: 4800,
    county: 'Kilifi',
    town: 'Malindi',
    destinations: ['Malindi', 'Watamu', 'Zanzibar'],
    languages: ['English', 'Swahili', 'French'],
    age_groups: ['Infants (0–12 months)', 'Toddlers (1–3 years)'],
    services: ['Travel nanny', 'Overnight care'],
    certifications: ['CPR', 'First Aid', 'ECD'],
    tags: ['Newborn', 'Montessori', 'French/Swahili', 'Travel nanny'],
    available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    willing_to_travel: 'international',
    is_active: true,
    rating_avg: 5,
    review_count: 62,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-mercy',
    user_id: null,
    application_id: null,
    slug: 'mercy-kamau',
    display_name: 'Mercy Kamau',
    photo_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&auto=format&fit=crop',
    bio: 'Calm Professional nanny covering Lamu and Malindi.',
    tier: 'silver',
    daily_rate_kes: 3000,
    county: 'Lamu',
    town: 'Lamu Town',
    destinations: ['Lamu', 'Malindi'],
    languages: ['English', 'Swahili'],
    age_groups: ['Preschool (3–5 years)', 'School-age (6–12 years)'],
    services: ['Daytime childcare', 'Meal preparation'],
    certifications: ['First Aid'],
    tags: ['Ages 3–12', 'Swimming', 'English/Swahili', 'Cooking'],
    available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    willing_to_travel: 'kenya',
    is_active: true,
    rating_avg: 4,
    review_count: 22,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-patience',
    user_id: null,
    application_id: null,
    slug: 'patience-njeri',
    display_name: 'Patience Njeri',
    photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&auto=format&fit=crop',
    bio: 'Nationwide Elite carer with special-needs experience and overnight placements.',
    tier: 'gold',
    daily_rate_kes: 5200,
    county: 'Nairobi',
    town: 'Karen',
    destinations: ['Nairobi', 'Masai Mara', 'Amboseli'],
    languages: ['English', 'Swahili'],
    age_groups: ['Infants (0–12 months)', 'School-age (6–12 years)'],
    services: ['Special needs support', 'Overnight care', 'Travel nanny'],
    certifications: ['CPR', 'First Aid', 'Nursing'],
    tags: ['Special needs', 'BSL basics', 'Fluent English', 'Overnight'],
    available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    willing_to_travel: 'international',
    is_active: true,
    rating_avg: 5,
    review_count: 55,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-rose',
    user_id: null,
    application_id: null,
    slug: 'rose-achieng',
    display_name: 'Rose Achieng',
    photo_url: 'https://images.unsplash.com/photo-1489424731084-a5d8b86c3b24?w=600&auto=format&fit=crop',
    bio: 'Friendly Basic-tier nanny in Mombasa and Diani.',
    tier: 'bronze',
    daily_rate_kes: 2200,
    county: 'Mombasa',
    town: 'Nyali',
    destinations: ['Mombasa', 'Diani Beach'],
    languages: ['English', 'Swahili'],
    age_groups: ['School-age (6–12 years)', 'Teens (13–17 years)'],
    services: ['Daytime childcare', 'Hotel / resort childcare'],
    certifications: [],
    tags: ['Ages 4–14', 'Outdoor play', 'Swahili/English', 'Arts'],
    available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    willing_to_travel: 'county',
    is_active: true,
    rating_avg: 4,
    review_count: 18,
    created_at: new Date().toISOString(),
  },
]

export const FALLBACK_DESTINATIONS: Destination[] = [
  { id: 'd1', slug: 'diani-beach', name: 'Diani Beach', country: 'Kenya', image_url: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&auto=format&fit=crop', description: null, is_active: true, sort_order: 1 },
  { id: 'd2', slug: 'malindi', name: 'Malindi', country: 'Kenya', image_url: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', description: null, is_active: true, sort_order: 2 },
  { id: 'd3', slug: 'watamu', name: 'Watamu', country: 'Kenya', image_url: 'https://images.unsplash.com/photo-1605640840605-14ac1855827b?w=800&auto=format&fit=crop', description: null, is_active: true, sort_order: 3 },
  { id: 'd4', slug: 'nairobi', name: 'Nairobi', country: 'Kenya', image_url: 'https://images.unsplash.com/photo-1611348524140-53c9a25263d6?w=800&auto=format&fit=crop', description: null, is_active: true, sort_order: 4 },
  { id: 'd5', slug: 'mombasa', name: 'Mombasa', country: 'Kenya', image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop', description: null, is_active: true, sort_order: 5 },
  { id: 'd6', slug: 'lamu', name: 'Lamu', country: 'Kenya', image_url: 'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800&auto=format&fit=crop', description: null, is_active: true, sort_order: 6 },
  { id: 'd7', slug: 'masai-mara', name: 'Masai Mara', country: 'Kenya', image_url: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800&auto=format&fit=crop', description: null, is_active: true, sort_order: 7 },
  { id: 'd8', slug: 'amboseli', name: 'Amboseli', country: 'Kenya', image_url: 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&auto=format&fit=crop', description: null, is_active: true, sort_order: 8 },
  { id: 'd9', slug: 'zanzibar', name: 'Zanzibar', country: 'Tanzania', image_url: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=800&auto=format&fit=crop', description: null, is_active: true, sort_order: 9 },
]

export const FALLBACK_REVIEWS: Review[] = [
  {
    id: 'r1',
    nanny_id: 'fallback-grace',
    parent_name: 'Sarah M.',
    trip_label: 'Diani Beach, December 2024',
    rating: 5,
    body: 'We hired Grace for 5 days in Diani. She was incredible with our 2-year-old and 4-year-old. My husband and I finally had real couple time on a holiday for the first time in years. We\'ll never travel without VacayNanny again.',
    avatar_url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&auto=format&fit=crop',
    created_at: '2024-12-20',
    is_published: true,
  },
  {
    id: 'r2',
    nanny_id: 'fallback-faith',
    parent_name: 'David & Priya K.',
    trip_label: 'Masai Mara, August 2024',
    rating: 5,
    body: 'Faith joined us on safari in the Mara. She kept our kids engaged, did educational activities about wildlife, and managed mealtime like a pro. Worth every shilling. Absolute peace of mind.',
    avatar_url: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&auto=format&fit=crop',
    created_at: '2024-08-12',
    is_published: true,
  },
  {
    id: 'r3',
    nanny_id: 'fallback-amara',
    parent_name: 'Christine O.',
    trip_label: 'Watamu, April 2025',
    rating: 5,
    body: 'As a solo mum travelling with 3 kids, I was nervous. Amara was a godsend — professional, warm, and my kids adored her. The booking process was seamless and customer support was always available.',
    avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&auto=format&fit=crop',
    created_at: '2025-04-04',
    is_published: true,
  },
]

export type NannyFilters = {
  destination?: string
  tier?: string
  q?: string
}

export async function getNannies(filters: NannyFilters = {}): Promise<Nanny[]> {
  const local = filterLocal(FALLBACK_NANNIES, filters)
  if (!hasSupabaseConfig()) return local
  return withTimeout(
    (async () => {
      try {
        const supabase = publicClient()
        const { data, error } = await supabase
          .from('nannies')
          .select('*')
          .eq('is_active', true)
          .order('rating_avg', { ascending: false })
        if (error || !data?.length) return local
        return filterLocal(data as Nanny[], filters)
      } catch {
        return local
      }
    })(),
    DATA_MS,
    local,
  )
}

function filterLocal(list: Nanny[], filters: NannyFilters) {
  return list.filter(n => {
    if (filters.destination && filters.destination !== 'any') {
      const dest = filters.destination.toLowerCase()
      if (!n.destinations.some(d => d.toLowerCase().includes(dest))) return false
    }
    if (filters.tier && filters.tier !== 'any') {
      const t = filters.tier.toLowerCase()
      const map: Record<string, string> = { elite: 'gold', gold: 'gold', professional: 'silver', silver: 'silver', pro: 'silver', bronze: 'bronze', basic: 'bronze', standard: 'bronze' }
      if (n.tier !== (map[t] || t)) return false
    }
    if (filters.q) {
      const q = filters.q.toLowerCase()
      const hay = [n.display_name, n.bio, n.town, n.county, ...n.tags, ...n.languages].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export async function getNannyBySlug(slug: string): Promise<Nanny | null> {
  const all = await getNannies()
  return all.find(n => n.slug === slug) ?? null
}

export async function getDestinations(): Promise<Destination[]> {
  if (!hasSupabaseConfig()) return FALLBACK_DESTINATIONS
  return withTimeout(
    (async () => {
      try {
        const supabase = publicClient()
        const { data, error } = await supabase
          .from('destinations')
          .select('*')
          .eq('is_active', true)
          .order('sort_order')
        if (error || !data?.length) return FALLBACK_DESTINATIONS
        return data as Destination[]
      } catch {
        return FALLBACK_DESTINATIONS
      }
    })(),
    DATA_MS,
    FALLBACK_DESTINATIONS,
  )
}

export async function getReviews(limit = 6): Promise<Review[]> {
  if (!hasSupabaseConfig()) return FALLBACK_REVIEWS
  return withTimeout(
    (async () => {
      try {
        const supabase = publicClient()
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (error || !data?.length) return FALLBACK_REVIEWS
        return data as Review[]
      } catch {
        return FALLBACK_REVIEWS
      }
    })(),
    DATA_MS,
    FALLBACK_REVIEWS,
  )
}

export async function getReviewsForNanny(nannyId: string): Promise<Review[]> {
  if (nannyId.startsWith('fallback-')) {
    return FALLBACK_REVIEWS.filter(r => r.nanny_id === nannyId)
  }
  if (!hasSupabaseConfig()) {
    return FALLBACK_REVIEWS.filter(r => r.nanny_id === nannyId)
  }
  return withTimeout(
    (async () => {
      try {
        const supabase = publicClient()
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .eq('nanny_id', nannyId)
          .eq('is_published', true)
          .order('created_at', { ascending: false })
        if (error) return []
        return (data || []) as Review[]
      } catch {
        return []
      }
    })(),
    DATA_MS,
    [],
  )
}

export function destinationNannyCount(nannies: Nanny[], name: string) {
  return nannies.filter(n => n.destinations.some(d => d.toLowerCase() === name.toLowerCase())).length
}
