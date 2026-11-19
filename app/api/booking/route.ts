import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import { randomUUID } from 'node:crypto'
import { validateCareDates } from '@/lib/booking-validation'
import { sealWorkflow } from '@/lib/workflow-secrets'
import { createSupabaseServer } from '@/lib/supabase/server'
import { parseCareType, quoteBooking } from '@/lib/booking'
import {
  assertEligibleNanny,
  findNannyClashes,
  jsonFromBookingError,
  suggestMatch,
} from '@/lib/booking-ops'
import { parseAddonCodes, quoteRatesFromCatalog } from '@/lib/catalog'
import { loadQuoteCatalog } from '@/lib/catalog-data'
import { limitRoute } from '@/lib/rate-limit'
import { publicDailyRate, publicTier } from '@/lib/safeguarding'
import { createGuestAccess } from '@/lib/guest-access'
import { siteUrl, normalizeTier } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parentName = String(body.parentName || body.name || '').trim()
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    const destination = String(body.destination || '').trim()
    const checkIn = String(body.checkIn || '')
    const checkOut = String(body.checkOut || '')
    const phone = String(body.phone || '').trim()
    const childrenCount = String(body.childrenCount || body.children || '')
    const infantCare =
      body.infantCare === true || body.infantCare === 'true' || body.infantCare === '1'
    const youngestAge = infantCare
      ? 'Under 1 year'
      : String(body.youngestAge || body.childrenAges || '')
    const nanniesNeeded = String(body.nanniesNeeded || '1')
    const tier = String(body.tier || '')
    const notes = String(body.notes || body.message || '')
    const careType = parseCareType(body.careType)
    let nannyId =
      body.nannyId && !String(body.nannyId).startsWith('fallback-')
        ? String(body.nannyId)
        : null

    if (!parentName || !email || !destination || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: 'Name, email, destination and dates are required.' },
        { status: 400 },
      )
    }
    const dateError = validateCareDates(checkIn, checkOut)
    if (dateError) return NextResponse.json({ error: dateError }, { status: 400 })
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      parentName.length > 120 ||
      notes.length > 3000 ||
      !/^[1-3]$/.test(nanniesNeeded) ||
      !/^(?:[1-9]|1[0-2])$/.test(childrenCount)
    )
      return NextResponse.json(
        { error: 'Provide a valid email, 1–12 children and 1–3 nannies.' },
        { status: 400 },
      )

    if (/special[ -]?needs|autism|\badhd\b|nursing|dementia|post[ -]?surg/i.test(notes))
      return NextResponse.json(
        {
          error:
            'Please request a specialist care quote so our team can assess the support and provider qualifications before matching.',
        },
        { status: 400 },
      )
    let parentId: string | null = null
    try {
      const authClient = await createSupabaseServer()
      const {
        data: { user },
      } = await authClient.auth.getUser()
      parentId = user?.email?.toLowerCase() === email ? user.id : null
    } catch {}

    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Booking storage is not configured yet.' },
        { status: 503 },
      )
    }

    const supabase = createServerClient()
    const blocked = await limitRoute(request, supabase, 'booking', { email })
    if (blocked) return blocked

    const normalizedTier = normalizeTier(tier)
    const capacity = normalizedTier === 'bronze' ? 2 : normalizedTier === 'silver' ? 3 : 4
    if (Number(childrenCount) > capacity * Number(nanniesNeeded))
      return NextResponse.json(
        {
          error: 'Choose a higher care tier or more nannies for the number of children.',
        },
        { status: 400 },
      )
    let assignedTier: string | null = null
    let dailyRateKes: number | null = null
    if (!nannyId) {
      const suggested = await suggestMatch(supabase, {
        destination,
        childrenCount,
        nanniesNeeded,
        checkIn,
        checkOut,
        tier,
        youngestAge,
        notes,
        careType,
        infantRequired: infantCare,
      })
      if (suggested) nannyId = suggested.nanny.id
    }

    const quoteCatalog = await loadQuoteCatalog(supabase)
    const rates = quoteRatesFromCatalog(quoteCatalog)
    if (nannyId) {
      await assertEligibleNanny(supabase, nannyId, {
        id: '',
        destination,
        check_in: checkIn,
        check_out: checkOut,
        tier,
        youngest_age: youngestAge,
        notes,
        care_type: careType,
        children_count: childrenCount,
        nannies_needed: nanniesNeeded,
      })
      const { data } = await supabase
        .from('nannies')
        .select('tier, daily_rate_kes, safeguarding_completed_at')
        .eq('id', nannyId)
        .maybeSingle()
      if (data?.tier) {
        assignedTier = publicTier(data)
        dailyRateKes = publicDailyRate(
          {
            tier: data.tier,
            daily_rate_kes: data.daily_rate_kes,
            safeguarding_completed_at: data.safeguarding_completed_at,
          },
          rates.tierRates,
        )
      }
      const clashes = await findNannyClashes(supabase, nannyId, checkIn, checkOut)
      if (clashes.length) {
        return NextResponse.json(
          {
            error:
              'That nanny is already booked for overlapping dates. Pick different dates or another nanny.',
          },
          { status: 409 },
        )
      }
    }

    const knownCare = quoteCatalog.care.some((care) => care.code === careType)
    if (quoteCatalog.persisted && quoteCatalog.care.length > 0 && !knownCare) {
      return NextResponse.json(
        { error: 'That care package is not available.' },
        { status: 400 },
      )
    }
    const addonCodes = parseAddonCodes(body.addonCodes).filter((code) =>
      rates.addons.some((addon) => addon.code === code),
    )
    const quote = quoteBooking({
      checkIn,
      checkOut,
      careType,
      tier: tier || undefined,
      nanniesNeeded,
      dailyRateKes,
      rates,
      addonCodes,
      maxNannies: quoteCatalog.policies.maxNannies,
      strictRates: quoteCatalog.persisted,
    })
    if (quote.dailyRate <= 0 || quote.multiplier <= 0) {
      return NextResponse.json(
        { error: 'Pricing is not published for this booking yet.' },
        { status: 503 },
      )
    }
    const total = quote.total

    const assigned = Boolean(nannyId)
    const guestAccess = createGuestAccess()
    const id = randomUUID()
    const trackingPath = `/booking/${id}?token=${guestAccess.token}`
    const row = {
      id,
      guest_access_token_hash: guestAccess.hash,
      payment_status: 'unpaid',
      parent_id: parentId,
      nanny_id: nannyId,
      parent_name: parentName,
      email,
      phone,
      destination,
      check_in: checkIn,
      check_out: checkOut,
      children_count: childrenCount || null,
      youngest_age: youngestAge || null,
      nannies_needed: nanniesNeeded,
      tier: assignedTier || normalizedTier || null,
      notes: notes || null,
      status: assigned ? ('matched' as const) : ('pending' as const),
      nanny_response: assigned ? ('pending' as const) : null,
      care_type: careType,
      total_amount_kes: total,
      addon_codes: addonCodes,
    }
    const { error } = await supabase.rpc('save_booking_request', {
      p_row: row,
      p_notification: sealWorkflow({ trackingUrl: siteUrl(trackingPath) }),
    })
    if (error) {
      if (error.code === '23P01')
        return NextResponse.json(
          { error: 'That nanny is no longer available. Please choose another match.' },
          { status: 409 },
        )
      console.error('Could not save booking request:', error.code)
      return NextResponse.json(
        { error: 'Could not save your request. Please retry.' },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { success: true, total, careType, trackingPath },
      { status: 200 },
    )
  } catch (err) {
    return jsonFromBookingError(err)
  }
}
