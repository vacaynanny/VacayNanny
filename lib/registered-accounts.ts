import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, RegisteredAccount, UserRole } from '@/lib/types'

function savedRole(value: unknown): UserRole | null {
  if (value === 'parent' || value === 'nanny' || value === 'admin') return value
  return null
}

function accountRole(profileRole: UserRole | null, signupRole: unknown): UserRole {
  if (profileRole) return profileRole
  if (signupRole === 'nanny') return 'nanny'
  return 'parent'
}

export async function loadRegisteredAccounts(supabase: SupabaseClient): Promise<RegisteredAccount[]> {
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, role, full_name, email, phone, avatar_url, created_at')
  const profiles = new Map(
    ((profileRows || []) as Profile[]).map(profile => [profile.id, profile]),
  )

  const users = []
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) break
    users.push(...data.users)
    if (data.users.length < 200) break
  }

  return users
    .map(user => {
      const profile = profiles.get(user.id)
      const metadata = user.user_metadata as { full_name?: unknown; role?: unknown } | undefined
      return {
        id: user.id,
        fullName: profile?.full_name || String(metadata?.full_name || ''),
        email: profile?.email || user.email || null,
        phone: profile?.phone || null,
        role: accountRole(savedRole(profile?.role), metadata?.role),
        hasProfile: Boolean(profile),
        registeredAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      }
    })
    .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
}
