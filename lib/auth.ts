import { createSupabaseServer } from '@/lib/supabase/server'
import { hasSupabaseConfig } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import type { Profile, UserRole } from '@/lib/types'
import { redirect } from 'next/navigation'

const AUTH_MS = 2000

export type CurrentProfile = Profile & { emailConfirmed: boolean }

export { emailOwnershipProven, profileOwnsBooking } from '@/lib/booking-ownership'
import { emailOwnershipProven, type AuthIdentity } from '@/lib/booking-ownership'

export async function getSessionUser() {
  if (!hasSupabaseConfig()) return null
  return withTimeout(
    (async () => {
      try {
        const supabase = await createSupabaseServer()
        const {
          data: { user },
        } = await supabase.auth.getUser()
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
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return null
        const identity = user as AuthIdentity
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        const profile: Profile = (data as Profile | null) ?? {
          id: identity.id,
          role: 'parent' as const,
          full_name: identity.user_metadata?.full_name || '',
          email: identity.email ?? null,
          phone: null,
          avatar_url: null,
          created_at: identity.created_at,
        }
        // Ownership uses the identity returned by Auth, never editable profile data.
        return {
          ...profile,
          email: identity.email ?? null,
          emailConfirmed: emailOwnershipProven(identity),
        }
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
