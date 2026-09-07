import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'

type InboxKind = 'contact' | 'waitlist'

function parseKind(raw: string): InboxKind | null {
  if (raw === 'contact' || raw === 'waitlist') return raw
  return null
}

function tableFor(kind: InboxKind) {
  switch (kind) {
    case 'contact':
      return 'contact_messages'
    case 'waitlist':
      return 'waitlist'
    default: {
      const _never: never = kind
      return _never
    }
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Inbox is not configured yet.' }, { status: 503 })
  }

  const { kind: rawKind, id } = await params
  const kind = parseKind(rawKind)
  if (!kind) return NextResponse.json({ error: 'Unknown inbox type.' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from(tableFor(kind))
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 })
  return NextResponse.json({ success: true })
}
