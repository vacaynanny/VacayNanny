import { careRangeEnd } from '@/lib/booking'
import { validateCareDates } from '@/lib/booking-validation'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'

/** One reservation per nanny and care day, including additional carers. */
export async function getBusyNannyIds(
  checkIn?: string,
  checkOut?: string,
): Promise<string[]> {
  if (!checkIn || !checkOut || validateCareDates(checkIn, checkOut, true)) return []
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return []
  const { data, error } = await createServerClient()
    .from('booking_care_slots')
    .select('nanny_id')
    .gte('care_date', checkIn)
    .lt('care_date', careRangeEnd(checkIn, checkOut))
  if (error) throw new Error('Availability could not be checked. Please retry.')
  return [...new Set((data || []).map((row) => String(row.nanny_id)))]
}
