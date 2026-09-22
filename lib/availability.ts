import { datesOverlap, bookingBlocksAvailability } from '@/lib/booking'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import type { BookingStatus } from '@/lib/types'

/** Nanny ids already blocking the requested dates. Server-only — uses the service role. */
export async function getBusyNannyIds(checkIn?: string, checkOut?: string): Promise<string[]> {
  const start = String(checkIn || '').slice(0, 10)
  const end = String(checkOut || '').slice(0, 10)
  if (!start || !end) return []
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return []
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('bookings')
      .select('nanny_id, check_in, check_out, status, nanny_response')
      .not('nanny_id', 'is', null)
    if (error || !data) return []
    const busy = new Set<string>()
    for (const row of data) {
      if (!row.nanny_id) continue
      if (!bookingBlocksAvailability(row.status as BookingStatus, row.nanny_response)) continue
      if (!datesOverlap(start, end, row.check_in, row.check_out)) continue
      busy.add(row.nanny_id as string)
    }
    return [...busy]
  } catch {
    return []
  }
}
