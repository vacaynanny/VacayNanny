import { NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

export async function POST() {
  const profile = await getCurrentProfile()
  if (!profile)
    return NextResponse.json(
      { error: 'Sign in to link your application.' },
      { status: 401 },
    )
  if (!profile.emailConfirmed || !profile.email)
    return NextResponse.json(
      { error: 'Verify your account email before linking an existing application.' },
      { status: 403 },
    )
  const { data, error } = await createServerClient().rpc('claim_nanny_applications', {
    p_actor: profile.id,
    p_verified_email: profile.email,
  })
  if (error)
    return NextResponse.json(
      { error: 'Your application could not be linked. Contact our team for help.' },
      { status: 409 },
    )
  return NextResponse.json({ success: true, linked: Number(data) || 0 })
}
