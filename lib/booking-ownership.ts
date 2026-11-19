export type AuthIdentity = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
  confirmation_sent_at?: string | null
  created_at: string
  app_metadata?: { provider?: string }
  user_metadata?: { full_name?: string }
}

/**
 * Email/password accounts only count as verified after Supabase has sent a
 * confirmation message and the user has confirmed it. When confirmation is
 * turned off, Supabase marks the email confirmed immediately and never sends
 * that message, so a new account must not inherit guest bookings.
 */
export function emailOwnershipProven(user: AuthIdentity): boolean {
  if (!user.email || !user.email_confirmed_at) return false
  const provider = user.app_metadata?.provider
  if (typeof provider === 'string' && provider !== 'email') return true
  return Boolean(user.confirmation_sent_at)
}

export function profileOwnsBooking(
  profile: { id: string; email: string | null; emailConfirmed: boolean },
  booking: { parent_id: string | null; email: string | null },
): boolean {
  if (booking.parent_id && booking.parent_id === profile.id) return true
  if (booking.parent_id) return false
  if (!profile.emailConfirmed || !profile.email || !booking.email) return false
  return booking.email.toLowerCase() === profile.email.toLowerCase()
}
