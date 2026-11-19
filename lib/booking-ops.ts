import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  bookingHasThread,
  cancellationRefundPercent,
  dueBookingStatus,
  isReplacementOpen,
  parseCareType,
  quoteBooking,
  careTypeLabel,
} from '@/lib/booking'
import { notifyBookingEvent, type BookingEmailEvent } from '@/lib/email'
import { validateCareDates } from '@/lib/booking-validation'
import { profileOwnsBooking } from '@/lib/booking-ownership'
import { waDigits } from '@/lib/constants'
import { loadQuoteCatalog, type QuoteCatalog } from '@/lib/catalog-data'
import { quoteRatesFromCatalog } from '@/lib/catalog'
import { publicDailyRate, publicTier } from '@/lib/safeguarding'
import {
  bestAvailableMatch,
  scoreNannyMatch,
  matchRequestFromBooking,
  type ClashRow,
} from '@/lib/match'
import type {
  Booking,
  BookingMessageRole,
  BookingStatus,
  CareType,
  Nanny,
  Profile,
} from '@/lib/types'

export type BookingClash = {
  id: string
  check_in: string
  check_out: string
  parent_name: string
  status: BookingStatus
}

export class BookingConflictError extends Error {
  clashes: BookingClash[]
  constructor(clashes: BookingClash[]) {
    super('That nanny is already booked for overlapping dates.')
    this.name = 'BookingConflictError'
    this.clashes = clashes
  }
}

export class BookingActionError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'BookingActionError'
    this.status = status
  }
}

export function jsonFromBookingError(err: unknown) {
  if (err instanceof BookingConflictError) {
    return NextResponse.json({ error: err.message }, { status: 409 })
  }
  if (err instanceof BookingActionError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error('Booking mutation failed:', err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export type BookingMutation =
  | { action: 'confirm' }
  | { action: 'cancel'; reason?: string }
  | { action: 'reschedule'; checkIn: string; checkOut: string }
  | { action: 'accept' }
  | { action: 'decline'; reason?: string }
  | { action: 'assign'; nannyId: string | null; force?: boolean; slot?: number }
  | { action: 'set_status'; status: BookingStatus }
  | { action: 'replace'; reason?: string; slot?: number }
  | { action: 'refund_replacement' }
  | { action: 'auto_match' }

const NANNY_EMBED =
  'nannies!bookings_nanny_id_fkey(id, display_name, slug, photo_url, tier, daily_rate_kes, safeguarding_completed_at), booking_assignments(slot,nanny_id,response,responded_at,nannies(id,display_name,slug,photo_url,tier))'

export async function loadBooking(
  supabase: SupabaseClient,
  id: string,
): Promise<Booking> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`*, ${NANNY_EMBED}`)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) throw new BookingActionError('Booking not found.', 404)
  return normalizeBooking(data)
}

function normalizeBooking(row: Record<string, unknown>): Booking {
  return {
    ...(row as unknown as Booking),
    care_type: parseCareType(row.care_type),
    nannies: (row.nannies as Booking['nannies']) ?? null,
  }
}

export async function suggestMatch(
  supabase: SupabaseClient,
  request: Parameters<typeof bestAvailableMatch>[1],
) {
  const [
    { data: nannies, error: nannyErr },
    { data: rows, error: bookErr },
    { data: destRows, error: destErr },
  ] = await Promise.all([
    supabase.from('nannies').select('*').eq('is_active', true),
    supabase
      .from('bookings')
      .select(
        'id, nanny_id, check_in, check_out, status, nanny_response, booking_assignments(nanny_id)',
      ),
    supabase.from('destinations').select('name, country').eq('is_active', true),
  ])
  if (nannyErr) throw new BookingActionError(nannyErr.message, 500)
  if (bookErr) throw new BookingActionError(bookErr.message, 500)
  const kenyaDestinations = destErr
    ? []
    : ((destRows || []) as { name?: string; country?: string }[])
        .filter((row) => String(row.country || '').toLowerCase() === 'kenya')
        .map((row) => String(row.name || '').trim())
        .filter(Boolean)
  return bestAvailableMatch(
    (nannies || []) as Nanny[],
    { ...request, kenyaDestinations },
    (rows || []) as ClashRow[],
  )
}

async function pickAutoMatch(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<string> {
  const booking = await loadBooking(supabase, bookingId)
  const best = await suggestMatch(supabase, matchRequestFromBooking(booking))
  if (!best) {
    throw new BookingActionError(
      'No available nanny matches destination, dates, infant care, and skills.',
      409,
    )
  }
  return best.nanny.id
}

export async function findNannyClashes(
  supabase: SupabaseClient,
  nannyId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string,
): Promise<BookingClash[]> {
  const { data, error } = await supabase
    .from('booking_care_slots')
    .select('booking_id,care_date')
    .eq('nanny_id', nannyId)
    .gte('care_date', checkIn)
    .lt(
      'care_date',
      checkOut > checkIn
        ? checkOut
        : new Date(Date.parse(checkIn) + 86400000).toISOString().slice(0, 10),
    )
  if (error) throw new BookingActionError('Could not check nanny availability.', 503)
  return (data || [])
    .filter((row) => row.booking_id !== excludeBookingId)
    .map((row) => ({
      id: row.booking_id,
      check_in: row.care_date,
      check_out: row.care_date,
      parent_name: '',
      status: 'matched' as BookingStatus,
    }))
}

export type NannyContact = {
  name: string | null
  email: string | null
  phone: string | null
}

export async function nannyContact(
  supabase: SupabaseClient,
  nannyId: string | null,
): Promise<NannyContact> {
  if (!nannyId) return { name: null, email: null, phone: null }
  const { data: nanny, error: nannyError } = await supabase
    .from('nannies')
    .select('display_name, user_id, application_id')
    .eq('id', nannyId)
    .maybeSingle()
  if (nannyError)
    throw new BookingActionError(
      'Nanny contact details are temporarily unavailable.',
      503,
    )
  if (!nanny) return { name: null, email: null, phone: null }

  let email: string | null = null
  let phone: string | null = null

  if (nanny.user_id) {
    const [
      { data: identity, error: identityError },
      { data: profile, error: profileError },
    ] = await Promise.all([
      supabase.auth.admin.getUserById(nanny.user_id),
      supabase.from('profiles').select('phone').eq('id', nanny.user_id).maybeSingle(),
    ])
    if (identityError || profileError)
      throw new BookingActionError(
        'Nanny contact details are temporarily unavailable.',
        503,
      )
    email = identity.user?.email || null
    phone = profile?.phone || null
  }

  if ((!email || !phone) && nanny.application_id) {
    const { data: application } = await supabase
      .from('nanny_applications')
      .select('email, phone, country_code')
      .eq('id', nanny.application_id)
      .maybeSingle()
    if (application) {
      email = email || application.email || null
      if (!phone && application.phone) {
        phone = waDigits(application.phone, application.country_code) || application.phone
      }
    }
  }

  return { name: nanny.display_name as string, email, phone }
}

async function quoteFor(
  supabase: SupabaseClient,
  booking: Booking,
  checkIn: string,
  checkOut: string,
  careType: CareType,
  catalog: QuoteCatalog,
) {
  let nanny = booking.nannies
  if (booking.nanny_id && !nanny?.daily_rate_kes) {
    const { data } = await supabase
      .from('nannies')
      .select('tier, daily_rate_kes, safeguarding_completed_at')
      .eq('id', booking.nanny_id)
      .maybeSingle()
    if (data) nanny = { ...nanny, ...data } as Booking['nannies']
  }
  const rates = quoteRatesFromCatalog(catalog)
  const dailyRateKes = nanny?.tier
    ? publicDailyRate(
        {
          tier: nanny.tier,
          daily_rate_kes: nanny.daily_rate_kes,
          safeguarding_completed_at: nanny.safeguarding_completed_at ?? null,
        },
        rates.tierRates,
      )
    : null
  return quoteBooking({
    checkIn,
    checkOut,
    careType,
    tier: booking.tier,
    nanniesNeeded: booking.nannies_needed,
    dailyRateKes,
    rates,
    addonCodes: booking.addon_codes,
    maxNannies: catalog.policies.maxNannies,
    strictRates: catalog.persisted,
  })
}

export async function fireEvent(
  supabase: SupabaseClient,
  event: BookingEmailEvent,
  booking: Booking,
  extra?: {
    nannyId?: string | null
    note?: string | null
    extraNannyId?: string | null
  },
) {
  const nannyId = extra?.nannyId === undefined ? booking.nanny_id : extra.nannyId
  const [assigned, extraNanny] = await Promise.all([
    nannyContact(supabase, nannyId ?? null),
    extra?.extraNannyId
      ? nannyContact(supabase, extra.extraNannyId)
      : Promise.resolve({ name: null, email: null, phone: null }),
  ])
  const otherNannies = (booking.booking_assignments || [])
    .map((a) => a.nanny_id)
    .filter((id) => id !== nannyId)
  const otherContacts = await Promise.all(
    otherNannies.map((id) => nannyContact(supabase, id)),
  )
  await notifyBookingEvent(event, {
    parentName: booking.parent_name,
    parentEmail: booking.email,
    nannyName: assigned.name,
    nannyEmail: assigned.email,
    nannyPhone: assigned.phone,
    extraNannyName: extraNanny.name,
    extraNannyEmail: extraNanny.email,
    destination: booking.destination,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    careType: careTypeLabel(booking.care_type),
    status: booking.status,
    totalKes: booking.total_amount_kes,
    refundPercent: booking.refund_percent,
    note: extra?.note || booking.cancellation_reason,
    additionalNannies: otherContacts
      .filter((c) => c.email)
      .map((c) => ({ name: c.name || 'Your nanny', email: c.email! })),
  })
}

type BookingActor = {
  id: string | null
  verifiedEmail?: string | null
  guestHash?: string | null
}

export async function applyBookingMutation(
  supabase: SupabaseClient,
  bookingId: string,
  mutation: BookingMutation,
  actor: BookingActor,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await applyBookingMutationOnce(supabase, bookingId, mutation, actor)
    } catch (error) {
      if (!(error instanceof BookingRetryError) || attempt === 3) throw error
    }
  }
  throw new BookingActionError('This booking changed. Refresh and retry.', 409)
}
class BookingRetryError extends BookingActionError {
  constructor() {
    super('This booking changed. Refresh and retry.', 409)
  }
}

async function applyBookingMutationOnce(
  supabase: SupabaseClient,
  bookingId: string,
  mutation: BookingMutation,
  actor: BookingActor,
): Promise<{ booking: Booking; event: BookingEmailEvent }> {
  const resolved: Exclude<BookingMutation, { action: 'auto_match' }> =
    mutation.action === 'auto_match'
      ? { action: 'assign', nannyId: await pickAutoMatch(supabase, bookingId) }
      : mutation
  const booking = await loadBooking(supabase, bookingId)
  const catalog = await loadQuoteCatalog(supabase)
  const updates: Record<string, unknown> = {}
  let event: BookingEmailEvent
  let note: string | null | undefined =
    resolved.action === 'cancel' ||
    resolved.action === 'decline' ||
    resolved.action === 'replace'
      ? 'reason' in resolved
        ? resolved.reason
        : undefined
      : undefined

  switch (resolved.action) {
    case 'confirm': {
      if (booking.status === 'cancelled' || booking.status === 'completed') {
        throw new BookingActionError('This booking can no longer be confirmed.')
      }
      if (booking.status === 'confirmed' && booking.parent_confirmed_at) {
        throw new BookingActionError('This booking is already confirmed.')
      }
      if (booking.status !== 'matched') {
        throw new BookingActionError('Confirm is available after we propose a nanny.')
      }
      if (!booking.nanny_id) throw new BookingActionError('No nanny is assigned yet.')
      updates.parent_confirmed_at = new Date().toISOString()
      if (booking.nanny_response === 'accepted') {
        updates.status = 'confirmed'
        event = 'confirmed'
      } else {
        event = 'parent_confirmed'
      }
      break
    }
    case 'cancel': {
      if (booking.status === 'cancelled')
        throw new BookingActionError('This booking is already cancelled.')
      if (booking.status === 'completed')
        throw new BookingActionError('Completed bookings cannot be cancelled.')
      if (booking.status === 'in_progress') {
        throw new BookingActionError(
          'An in-progress placement has to be cancelled by VacayNanny ops.',
        )
      }
      const refund = cancellationRefundPercent(
        booking.check_in,
        new Date(),
        catalog.policies,
      )
      updates.status = 'cancelled'
      updates.cancelled_at = new Date().toISOString()
      updates.cancellation_reason =
        resolved.action === 'cancel'
          ? resolved.reason?.trim() || 'Cancelled by family'
          : 'Cancelled by family'
      updates.refund_percent = refund
      event = 'cancelled'
      note = updates.cancellation_reason as string
      break
    }
    case 'reschedule': {
      if (!['pending', 'matched', 'confirmed'].includes(booking.status)) {
        throw new BookingActionError('This booking cannot be rescheduled.')
      }
      if (resolved.action !== 'reschedule')
        throw new BookingActionError('Invalid reschedule payload.')
      const dateError = validateCareDates(resolved.checkIn, resolved.checkOut)
      if (dateError) throw new BookingActionError(dateError)
      for (const assignment of booking.booking_assignments || []) {
        await assertEligibleNanny(supabase, assignment.nanny_id, {
          ...booking,
          check_in: resolved.checkIn,
          check_out: resolved.checkOut,
        })
      }
      if (booking.nanny_id) {
        const clashes = await findNannyClashes(
          supabase,
          booking.nanny_id,
          resolved.checkIn,
          resolved.checkOut,
          booking.id,
        )
        if (clashes.length) throw new BookingConflictError(clashes)
      }
      const quote = await quoteFor(
        supabase,
        booking,
        resolved.checkIn,
        resolved.checkOut,
        booking.care_type,
        catalog,
      )
      updates.check_in = resolved.checkIn
      updates.check_out = resolved.checkOut
      updates.parent_confirmed_at = null
      updates.nanny_response = 'pending'
      updates.nanny_responded_at = null
      updates.status = booking.nanny_id ? 'matched' : 'pending'
      updates.total_amount_kes = quote.total
      event = 'rescheduled'
      note = `New dates: ${resolved.checkIn} → ${resolved.checkOut}`
      break
    }
    case 'accept': {
      if (!(booking.booking_assignments?.length || booking.nanny_id))
        throw new BookingActionError('This booking is not assigned to a nanny.')
      if (booking.status === 'cancelled' || booking.status === 'completed') {
        throw new BookingActionError('This booking is no longer active.')
      }
      updates.nanny_response = 'accepted'
      updates.nanny_responded_at = new Date().toISOString()
      if (booking.status === 'pending') updates.status = 'matched'
      if (booking.parent_confirmed_at) {
        updates.status = 'confirmed'
        event = 'confirmed'
      } else {
        event = 'nanny_accepted'
      }
      break
    }
    case 'decline': {
      if (!(booking.booking_assignments?.length || booking.nanny_id))
        throw new BookingActionError('This booking is not assigned to a nanny.')

      const needsReplacement =
        booking.status === 'confirmed' ||
        booking.status === 'in_progress' ||
        Boolean(booking.parent_confirmed_at)
      updates.nanny_response = 'declined'
      updates.nanny_responded_at = new Date().toISOString()
      if (needsReplacement) {
        updates.replaced_nanny_id = booking.nanny_id
        updates.nanny_id = null
        updates.parent_confirmed_at = null
        updates.replacement_requested_at = new Date().toISOString()
        updates.replacement_fulfilled_at = null
        updates.status = 'matched'
        updates.nanny_response = null
        event = 'replacement_started'

        note =
          (resolved.action === 'decline' ? resolved.reason?.trim() : undefined) ||
          'Nanny declined a confirmed placement'
      } else {
        updates.nanny_id = null
        updates.status = 'pending'
        updates.nanny_response = null
        updates.parent_confirmed_at = null
        event = 'nanny_declined'

        note =
          (resolved.action === 'decline' ? resolved.reason?.trim() : undefined) ||
          'Nanny declined the assignment'
      }
      break
    }
    case 'assign': {
      const nannyId = resolved.nannyId || null
      if (resolved.force)
        throw new BookingActionError('Scheduling conflicts cannot be overridden.', 409)
      if (nannyId) {
        const selected = await assertEligibleNanny(supabase, nannyId, booking)
        if ((resolved.slot || 1) === 1) {
          updates.tier = publicTier(selected)
          updates.total_amount_kes = (
            await quoteFor(
              supabase,
              {
                ...booking,
                nanny_id: nannyId,
                nannies: null,
                tier: publicTier(selected),
              },
              booking.check_in,
              booking.check_out,
              booking.care_type,
              catalog,
            )
          ).total
        }
      }
      if (nannyId) {
        if (!resolved.force) {
          const clashes = await findNannyClashes(
            supabase,
            nannyId,
            booking.check_in,
            booking.check_out,
            booking.id,
          )
          if (clashes.length) throw new BookingConflictError(clashes)
        }
        updates.nanny_id = nannyId
        updates.nanny_response = 'pending'
        updates.nanny_responded_at = null
        updates.parent_confirmed_at = null
        if (
          booking.status === 'pending' ||
          isReplacementOpen(booking) ||
          booking.status === 'matched'
        ) {
          updates.status = 'matched'
        }
        if (isReplacementOpen(booking)) {
          updates.replacement_fulfilled_at = new Date().toISOString()
          event = 'replacement_assigned'
        } else {
          event = 'matched'
        }
      } else {
        updates.nanny_id = null
        updates.nanny_response = null
        updates.nanny_responded_at = null
        if (booking.status === 'matched' || booking.status === 'confirmed')
          updates.status = 'pending'
        event = 'nanny_declined'

        note = 'Assignment cleared by ops'
      }
      break
    }
    case 'set_status': {
      updates.status = resolved.status
      switch (resolved.status) {
        case 'cancelled': {
          updates.cancelled_at = booking.cancelled_at || new Date().toISOString()
          updates.refund_percent =
            booking.refund_percent ??
            cancellationRefundPercent(booking.check_in, new Date(), catalog.policies)
          updates.cancellation_reason =
            booking.cancellation_reason || 'Cancelled by VacayNanny'
          event = 'cancelled'
          break
        }
        case 'confirmed': {
          if (
            !booking.parent_confirmed_at ||
            !booking.nanny_id ||
            booking.nanny_response !== 'accepted'
          )
            throw new BookingActionError(
              'The family and nanny must accept the match before confirmation.',
            )
          event = 'confirmed'
          break
        }
        case 'matched':
          event = 'matched'
          break
        case 'in_progress':
          event = 'in_progress'
          break
        case 'completed':
          event = 'completed'
          break
        case 'pending':
          event = 'rescheduled'
          note = 'Returned to pending by ops'
          break
        default: {
          const _never: never = resolved.status
          throw new BookingActionError(`Unhandled status: ${_never}`)
        }
      }
      break
    }
    case 'replace': {
      if (!booking.nanny_id && !isReplacementOpen(booking)) {
        throw new BookingActionError('Assign a nanny before starting a replacement.')
      }

      updates.replaced_nanny_id = booking.nanny_id || booking.replaced_nanny_id
      updates.nanny_id = null
      updates.nanny_response = null
      updates.nanny_responded_at = null
      updates.parent_confirmed_at = null
      updates.replacement_requested_at = new Date().toISOString()
      updates.replacement_fulfilled_at = null
      updates.status = 'matched'
      event = 'replacement_started'

      note =
        (resolved.action === 'replace' ? resolved.reason?.trim() : undefined) ||
        'Replacement requested (no-show / cannot attend)'
      break
    }
    case 'refund_replacement': {
      if (!isReplacementOpen(booking) && !booking.replacement_requested_at) {
        throw new BookingActionError('No open replacement on this booking.')
      }
      updates.status = 'cancelled'
      updates.cancelled_at = new Date().toISOString()
      updates.refund_percent = 100
      updates.cancellation_reason = 'Replacement guarantee — refund review requested'
      updates.nanny_id = null
      event = 'replacement_refunded'

      note = `${catalog.policies.replacementSlaHours}-hour replacement guarantee: refund review requested; no automatic transfer has been made`
      break
    }
    default: {
      const _never: never = resolved
      throw new BookingActionError(`Unhandled action: ${JSON.stringify(_never)}`)
    }
  }

  const { data: committed, error } = await supabase.rpc('commit_booking_mutation', {
    p_id: bookingId,
    p_version: booking.version ?? 0,
    p_action: resolved.action,
    p_updates: updates,
    p_actor: actor.id,
    p_verified_email: actor.verifiedEmail || null,
    p_guest_hash: actor.guestHash || null,
    p_slot: 'slot' in resolved ? resolved.slot || 1 : 1,
    p_nanny: resolved.action === 'assign' ? resolved.nannyId : null,
    p_event: event,
    p_note: note || null,
  })
  if (error?.code === '40001') throw new BookingRetryError()
  if (error)
    throw new BookingActionError(
      error.code === '23P01'
        ? 'A selected nanny is unavailable on these dates.'
        : error.code === '23505'
          ? 'A nanny cannot fill more than one assignment slot.'
          : error.code === '23503'
            ? 'That selection is no longer available. Refresh and choose again.'
            : error.code === 'P0001'
              ? error.message
              : 'Could not update this booking. Refresh and retry.',
      error.code === '42501' ? 403 : 409,
    )
  const next = await loadBooking(supabase, bookingId)
  return { booking: next, event: (committed?.event || event) as BookingEmailEvent }
}

export async function resolveBookingAccess(
  supabase: SupabaseClient,
  profile: Profile & { emailConfirmed: boolean },
  booking: Booking,
): Promise<{
  isParent: boolean
  isAssignedNanny: boolean
  isAdmin: boolean
  senderRole: BookingMessageRole | null
}> {
  const isParent = profileOwnsBooking(profile, booking)
  const { data: nannyRow } = await supabase
    .from('nannies')
    .select('id')
    .eq('user_id', profile.id)
    .maybeSingle()
  const isAssignedNanny = Boolean(
    nannyRow &&
      (booking.nanny_id === nannyRow.id ||
        booking.booking_assignments?.some((a) => a.nanny_id === nannyRow.id)),
  )
  const isAdmin = profile.role === 'admin'
  let senderRole: BookingMessageRole | null = null
  if (isAdmin) senderRole = 'admin'
  else if (isAssignedNanny) senderRole = 'nanny'
  else if (isParent) senderRole = 'parent'
  return { isParent, isAssignedNanny, isAdmin, senderRole }
}

export async function advanceDueBookings(
  supabase: SupabaseClient,
  options: { strict?: boolean } = {},
): Promise<number> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`*, ${NANNY_EMBED}`)
    .in('status', ['confirmed', 'in_progress'])
  if (error) {
    console.error('advanceDueBookings load failed:', error)
    if (options.strict) throw new Error('Could not load due bookings.')
    return 0
  }

  let changed = 0
  let failed = false
  for (const row of data || []) {
    const booking = normalizeBooking(row as Record<string, unknown>)
    if (
      booking.payment_status &&
      !['paid', 'not_required'].includes(booking.payment_status) &&
      booking.status === 'confirmed'
    )
      continue
    const nextStatus = dueBookingStatus(booking)
    if (!nextStatus || nextStatus === booking.status) continue
    const { data: updated, error: updErr } = await supabase
      .from('bookings')
      .update({ status: nextStatus })
      .eq('id', booking.id)
      .eq('status', booking.status)
      .select('id')
      .maybeSingle()
    if (updErr) {
      console.error('advanceDueBookings update failed:', updErr)
      failed = true
      continue
    }
    if (!updated) continue
    // The database status trigger queues this event atomically.
    changed += 1
  }
  if (failed && options.strict) throw new Error('Some due bookings could not be updated.')
  return changed
}

export function assertBookingThread(booking: Booking) {
  if (!bookingHasThread(booking)) {
    throw new BookingActionError('Chat opens once a nanny is assigned.')
  }
}

export async function assertEligibleNanny(
  supabase: SupabaseClient,
  nannyId: string,
  booking: Pick<
    Booking,
    | 'id'
    | 'destination'
    | 'check_in'
    | 'check_out'
    | 'tier'
    | 'youngest_age'
    | 'notes'
    | 'care_type'
    | 'children_count'
    | 'nannies_needed'
  >,
) {
  const { data, error } = await supabase
    .from('nannies')
    .select('*')
    .eq('id', nannyId)
    .maybeSingle()
  if (error || !data) throw new BookingActionError('That nanny is unavailable.', 409)
  const { data: destinations } = await supabase
    .from('destinations')
    .select('name,country')
    .eq('is_active', true)
  const match = scoreNannyMatch(
    data as Nanny,
    {
      destination: booking.destination,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      tier: booking.tier,
      youngestAge: booking.youngest_age,
      notes: booking.notes,
      careType: booking.care_type,
      childrenCount: booking.children_count,
      nanniesNeeded: booking.nannies_needed,
      kenyaDestinations: (destinations || [])
        .filter((d) => d.country === 'Kenya')
        .map((d) => d.name),
    },
    [],
  )
  if (!match.eligible) throw new BookingActionError(match.blockers.join('. '), 409)
  return data as Nanny
}
