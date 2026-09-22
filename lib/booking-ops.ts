import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  bookingBlocksAvailability,
  bookingHasThread,
  cancellationRefundPercent,
  datesOverlap,
  dueBookingStatus,
  isReplacementOpen,
  parseCareType,
  quoteBooking,
  careTypeLabel,
} from '@/lib/booking'
import { notifyBookingEvent, type BookingEmailEvent } from '@/lib/email'
import { waDigits } from '@/lib/constants'
import { bestAvailableMatch, matchRequestFromBooking, type ClashRow } from '@/lib/match'
import type { Booking, BookingMessageRole, BookingStatus, CareType, Nanny, Profile } from '@/lib/types'

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
    return NextResponse.json({ error: err.message, clashes: err.clashes }, { status: 409 })
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
  | { action: 'assign'; nannyId: string | null; force?: boolean }
  | { action: 'set_status'; status: BookingStatus }
  | { action: 'replace'; reason?: string }
  | { action: 'refund_replacement' }
  | { action: 'auto_match' }

const NANNY_EMBED = 'nannies(id, display_name, slug, photo_url, tier, daily_rate_kes)'

export async function loadBooking(supabase: SupabaseClient, id: string): Promise<Booking> {
  const { data, error } = await supabase.from('bookings').select(`*, ${NANNY_EMBED}`).eq('id', id).maybeSingle()
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

export async function suggestMatch(supabase: SupabaseClient, request: Parameters<typeof bestAvailableMatch>[1]) {
  const [{ data: nannies, error: nannyErr }, { data: rows, error: bookErr }] = await Promise.all([
    supabase.from('nannies').select('*').eq('is_active', true),
    supabase.from('bookings').select('id, nanny_id, check_in, check_out, status, nanny_response, parent_name'),
  ])
  if (nannyErr) throw new BookingActionError(nannyErr.message, 500)
  if (bookErr) throw new BookingActionError(bookErr.message, 500)
  return bestAvailableMatch((nannies || []) as Nanny[], request, (rows || []) as ClashRow[])
}

async function pickAutoMatch(supabase: SupabaseClient, bookingId: string): Promise<string> {
  const booking = await loadBooking(supabase, bookingId)
  const best = await suggestMatch(supabase, matchRequestFromBooking(booking))
  if (!best) {
    throw new BookingActionError('No available nanny matches destination, dates, infant care, and skills.', 409)
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
    .from('bookings')
    .select('id, check_in, check_out, parent_name, status, nanny_response')
    .eq('nanny_id', nannyId)
  if (error) throw new BookingActionError(error.message, 500)
  return (data || [])
    .filter(row => row.id !== excludeBookingId)
    .filter(row => bookingBlocksAvailability(row.status as BookingStatus, row.nanny_response))
    .filter(row => datesOverlap(checkIn, checkOut, row.check_in, row.check_out))
    .map(row => ({
      id: row.id as string,
      check_in: row.check_in as string,
      check_out: row.check_out as string,
      parent_name: row.parent_name as string,
      status: row.status as BookingStatus,
    }))
}

export type NannyContact = {
  name: string | null
  email: string | null
  phone: string | null
}

export async function nannyContact(supabase: SupabaseClient, nannyId: string | null): Promise<NannyContact> {
  if (!nannyId) return { name: null, email: null, phone: null }
  const { data: nanny } = await supabase
    .from('nannies')
    .select('display_name, user_id, application_id')
    .eq('id', nannyId)
    .maybeSingle()
  if (!nanny) return { name: null, email: null, phone: null }

  let email: string | null = null
  let phone: string | null = null

  if (nanny.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, phone')
      .eq('id', nanny.user_id)
      .maybeSingle()
    email = profile?.email ?? null
    phone = profile?.phone ?? null
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

async function quoteFor(supabase: SupabaseClient, booking: Booking, checkIn: string, checkOut: string, careType: CareType) {
  let dailyRateKes: number | null = booking.nannies?.daily_rate_kes ?? null
  if (!dailyRateKes && booking.nanny_id) {
    const { data } = await supabase.from('nannies').select('daily_rate_kes').eq('id', booking.nanny_id).maybeSingle()
    dailyRateKes = (data as Pick<Nanny, 'daily_rate_kes'> | null)?.daily_rate_kes ?? null
  }
  return quoteBooking({
    checkIn,
    checkOut,
    careType,
    tier: booking.tier,
    nanniesNeeded: booking.nannies_needed,
    dailyRateKes,
  })
}

async function fireEvent(
  supabase: SupabaseClient,
  event: BookingEmailEvent,
  booking: Booking,
  extra?: { nannyId?: string | null; note?: string | null; extraNannyId?: string | null },
) {
  const nannyId = extra?.nannyId === undefined ? booking.nanny_id : extra.nannyId
  const [assigned, extraNanny] = await Promise.all([
    nannyContact(supabase, nannyId ?? null),
    extra?.extraNannyId ? nannyContact(supabase, extra.extraNannyId) : Promise.resolve({ name: null, email: null, phone: null }),
  ])
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
  }).catch(err => console.error('notifyBookingEvent failed:', err))
}

export async function applyBookingMutation(
  supabase: SupabaseClient,
  bookingId: string,
  mutation: BookingMutation,
): Promise<{ booking: Booking; event: BookingEmailEvent }> {
  const resolved: Exclude<BookingMutation, { action: 'auto_match' }> = mutation.action === 'auto_match'
    ? { action: 'assign', nannyId: await pickAutoMatch(supabase, bookingId) }
    : mutation
  const booking = await loadBooking(supabase, bookingId)
  const updates: Record<string, unknown> = {}
  let event: BookingEmailEvent
  let notifyNannyId: string | null | undefined = undefined
  let extraNannyId: string | null | undefined = undefined
  let note: string | null | undefined = resolved.action === 'cancel' || resolved.action === 'decline' || resolved.action === 'replace'
    ? ('reason' in resolved ? resolved.reason : undefined)
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
      if (booking.status === 'cancelled') throw new BookingActionError('This booking is already cancelled.')
      if (booking.status === 'completed') throw new BookingActionError('Completed bookings cannot be cancelled.')
      if (booking.status === 'in_progress') {
        throw new BookingActionError('An in-progress placement has to be cancelled by VacayNanny ops.')
      }
      const refund = cancellationRefundPercent(booking.check_in)
      updates.status = 'cancelled'
      updates.cancelled_at = new Date().toISOString()
      updates.cancellation_reason = resolved.action === 'cancel'
        ? (resolved.reason?.trim() || 'Cancelled by family')
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
      if (resolved.action !== 'reschedule') throw new BookingActionError('Invalid reschedule payload.')
      if (new Date(resolved.checkOut) < new Date(resolved.checkIn)) {
        throw new BookingActionError('Check-out must be on or after check-in.')
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
      const quote = await quoteFor(supabase, booking, resolved.checkIn, resolved.checkOut, booking.care_type)
      updates.check_in = resolved.checkIn
      updates.check_out = resolved.checkOut
      updates.total_amount_kes = quote.total
      event = 'rescheduled'
      note = `New dates: ${resolved.checkIn} → ${resolved.checkOut}`
      break
    }
    case 'accept': {
      if (!booking.nanny_id) throw new BookingActionError('This booking is not assigned to a nanny.')
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
      if (!booking.nanny_id) throw new BookingActionError('This booking is not assigned to a nanny.')
      extraNannyId = booking.nanny_id
      const needsReplacement = booking.status === 'confirmed' || booking.status === 'in_progress' || Boolean(booking.parent_confirmed_at)
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
        notifyNannyId = null
        note = (resolved.action === 'decline' ? resolved.reason?.trim() : undefined) || 'Nanny declined a confirmed placement'
      } else {
        updates.nanny_id = null
        updates.status = 'pending'
        updates.nanny_response = null
        updates.parent_confirmed_at = null
        event = 'nanny_declined'
        notifyNannyId = null
        note = (resolved.action === 'decline' ? resolved.reason?.trim() : undefined) || 'Nanny declined the assignment'
      }
      break
    }
    case 'assign': {
      const nannyId = resolved.nannyId || null
      if (nannyId) {
        if (!resolved.force) {
          const clashes = await findNannyClashes(supabase, nannyId, booking.check_in, booking.check_out, booking.id)
          if (clashes.length) throw new BookingConflictError(clashes)
        }
        updates.nanny_id = nannyId
        updates.nanny_response = 'pending'
        updates.nanny_responded_at = null
        updates.parent_confirmed_at = null
        if (booking.status === 'pending' || isReplacementOpen(booking) || booking.status === 'matched') {
          updates.status = 'matched'
        }
        if (isReplacementOpen(booking)) {
          updates.replacement_fulfilled_at = new Date().toISOString()
          event = 'replacement_assigned'
        } else {
          event = 'matched'
        }
        notifyNannyId = nannyId
      } else {
        extraNannyId = booking.nanny_id
        updates.nanny_id = null
        updates.nanny_response = null
        updates.nanny_responded_at = null
        if (booking.status === 'matched' || booking.status === 'confirmed') updates.status = 'pending'
        event = 'nanny_declined'
        notifyNannyId = null
        note = 'Assignment cleared by ops'
      }
      break
    }
    case 'set_status': {
      updates.status = resolved.status
      switch (resolved.status) {
        case 'cancelled': {
          updates.cancelled_at = booking.cancelled_at || new Date().toISOString()
          updates.refund_percent = booking.refund_percent ?? cancellationRefundPercent(booking.check_in)
          updates.cancellation_reason = booking.cancellation_reason || 'Cancelled by VacayNanny'
          event = 'cancelled'
          break
        }
        case 'confirmed': {
          updates.parent_confirmed_at = booking.parent_confirmed_at || new Date().toISOString()
          if (booking.nanny_id) updates.nanny_response = booking.nanny_response || 'accepted'
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
      extraNannyId = booking.nanny_id
      updates.replaced_nanny_id = booking.nanny_id || booking.replaced_nanny_id
      updates.nanny_id = null
      updates.nanny_response = null
      updates.nanny_responded_at = null
      updates.parent_confirmed_at = null
      updates.replacement_requested_at = new Date().toISOString()
      updates.replacement_fulfilled_at = null
      updates.status = 'matched'
      event = 'replacement_started'
      notifyNannyId = null
      note = (resolved.action === 'replace' ? resolved.reason?.trim() : undefined) || 'Replacement requested (no-show / cannot attend)'
      break
    }
    case 'refund_replacement': {
      if (!isReplacementOpen(booking) && !booking.replacement_requested_at) {
        throw new BookingActionError('No open replacement on this booking.')
      }
      updates.status = 'cancelled'
      updates.cancelled_at = new Date().toISOString()
      updates.refund_percent = 100
      updates.cancellation_reason = 'Replacement guarantee — booking fee refunded'
      updates.nanny_id = null
      event = 'replacement_refunded'
      notifyNannyId = null
      note = '2-hour replacement guarantee: booking fee refunded'
      break
    }
    default: {
      const _never: never = resolved
      throw new BookingActionError(`Unhandled action: ${JSON.stringify(_never)}`)
    }
  }

  const { error } = await supabase.from('bookings').update(updates).eq('id', bookingId)
  if (error) throw new BookingActionError(error.message, 500)

  const next = await loadBooking(supabase, bookingId)
  await fireEvent(supabase, event, next, {
    nannyId: notifyNannyId,
    extraNannyId,
    note,
  })
  return { booking: next, event }
}

export async function resolveBookingAccess(
  supabase: SupabaseClient,
  profile: Profile,
  booking: Booking,
): Promise<{ isParent: boolean; isAssignedNanny: boolean; isAdmin: boolean; senderRole: BookingMessageRole | null }> {
  const isParent =
    booking.parent_id === profile.id ||
    Boolean(profile.email && booking.email.toLowerCase() === profile.email.toLowerCase())
  const { data: nannyRow } = await supabase
    .from('nannies')
    .select('id')
    .eq('user_id', profile.id)
    .maybeSingle()
  const isAssignedNanny = Boolean(nannyRow && booking.nanny_id === nannyRow.id)
  const isAdmin = profile.role === 'admin'
  let senderRole: BookingMessageRole | null = null
  if (isAdmin) senderRole = 'admin'
  else if (isAssignedNanny) senderRole = 'nanny'
  else if (isParent) senderRole = 'parent'
  return { isParent, isAssignedNanny, isAdmin, senderRole }
}

export async function advanceDueBookings(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`*, ${NANNY_EMBED}`)
    .in('status', ['confirmed', 'in_progress'])
  if (error) {
    console.error('advanceDueBookings load failed:', error)
    return 0
  }

  let changed = 0
  for (const row of data || []) {
    const booking = normalizeBooking(row as Record<string, unknown>)
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
      continue
    }
    if (!updated) continue
    const next = await loadBooking(supabase, booking.id)
    const event: BookingEmailEvent = nextStatus === 'completed' ? 'completed' : 'in_progress'
    await fireEvent(supabase, event, next)
    changed += 1
  }
  return changed
}

export function assertBookingThread(booking: Booking) {
  if (!bookingHasThread(booking)) {
    throw new BookingActionError('Chat opens once a nanny is assigned.')
  }
}
