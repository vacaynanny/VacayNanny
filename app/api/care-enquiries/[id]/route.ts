import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { hashGuestToken } from '@/lib/guest-access'
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile(),
    token = request.headers.get('authorization')?.replace(/^Bearer /, ''),
    { id } = await params,
    body = await request.json().catch(() => ({}))
  if (!profile && !/^[0-9a-f]{64}$/.test(token || ''))
    return NextResponse.json(
      { error: 'Use your private enquiry link or sign in.' },
      { status: 401 },
    )
  if (body.action !== 'accept' || !Number.isInteger(body.version))
    return NextResponse.json(
      { error: 'Choose a valid quote to accept.' },
      { status: 400 },
    )
  const { error } = await createServerClient().rpc('accept_care_quote', {
    p_id: id,
    p_version: body.version,
    p_actor: profile?.id || null,
    p_verified_email: profile?.emailConfirmed ? profile.email : null,
    p_guest_hash: token && /^[0-9a-f]{64}$/.test(token) ? hashGuestToken(token) : null,
  })
  return error
    ? NextResponse.json(
        {
          error:
            error.code === '42501' ? 'You cannot access this enquiry.' : error.message,
        },
        { status: error.code === '42501' ? 403 : 409 },
      )
    : NextResponse.json({ success: true })
}
