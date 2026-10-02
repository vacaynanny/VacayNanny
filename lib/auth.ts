import { createSupabaseServer } from '@/lib/supabase/server'
import { hasSupabaseConfig } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import type { Profile, UserRole } from '@/lib/types'
import { redirect } from 'next/navigation'

const AUTH_MS = 2000

export type CurrentProfile = Profile & { emailConfirmed: boolean }

type AuthIdentity = {
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
  if (!profile.emailConfirmed || !profile.email || !booking.email) return false
  return booking.email.toLowerCase() === profile.email.toLowerCase()
}

export async function getSessionUser() {
  if (!hasSupabaseConfig()) return null
  return withTimeout(
    (async () => {
      try {
        const supabase = await createSupabaseServer()
        const { data: { user } } = await supabase.auth.getUser()
        return user
      } catch {
        return null
      }
    })(),
    AUTH_MS,
    null,
  )
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  if (!hasSupabaseConfig()) return null
  return withTimeout(
    (async () => {
      try {
        const supabase = await createSupabaseServer()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null
        const identity = user as AuthIdentity
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        const profile: Profile = (data as Profile | null) ?? {
          id: identity.id,
          role: 'parent' as const,
          full_name: identity.user_metadata?.full_name || '',
          email: identity.email ?? null,
          phone: null,
          avatar_url: null,
          created_at: identity.created_at,
        }
        return { ...profile, emailConfirmed: emailOwnershipProven(identity) }
      } catch {
        return null
      }
    })(),
    AUTH_MS,
    null,
  )
}

export async function requireProfile(roles?: UserRole[]) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (roles && !roles.includes(profile.role)) redirect('/')
  return profile
}

export async function requireAdminProfile() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') return null
  return profile
}
