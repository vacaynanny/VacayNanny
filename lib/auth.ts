import { createSupabaseServer } from '@/lib/supabase/server'
import { hasSupabaseConfig } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import type { Profile, UserRole } from '@/lib/types'
import { redirect } from 'next/navigation'

const AUTH_MS = 2000

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

export async function getCurrentProfile(): Promise<Profile | null> {
  if (!hasSupabaseConfig()) return null
  return withTimeout(
    (async () => {
      try {
        const supabase = await createSupabaseServer()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        return (data as Profile | null) ?? {
          id: user.id,
          role: 'parent' as const,
          full_name: user.user_metadata?.full_name || '',
          email: user.email ?? null,
          phone: null,
          avatar_url: null,
          created_at: user.created_at,
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
