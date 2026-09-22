import { NextRequest, NextResponse } from 'next/server'
import { requireAdminProfile } from '@/lib/auth'
import { parseStoragePath } from '@/lib/application-docs'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Documents are not configured yet.' }, { status: 503 })
  }

  const { id, docId } = await params
  const download = request.nextUrl.searchParams.get('download') === '1'
  const supabase = createServerClient()

  const { data: doc, error } = await supabase
    .from('nanny_documents')
    .select('*')
    .eq('id', docId)
    .eq('application_id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { bucket, path } = parseStoragePath(String(doc.storage_path || ''))
  if (!path) return NextResponse.json({ error: 'Document path is missing.' }, { status: 404 })

  const { data: file, error: dlErr } = await supabase.storage.from(bucket).download(path)
  if (dlErr || !file) {
    return NextResponse.json({ error: dlErr?.message || 'Could not open this file.' }, { status: 404 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const mime = String(doc.mime_type || file.type || 'application/octet-stream')
  const filename = String(doc.file_name || `${doc.kind}.bin`).replace(/[\r\n"]/g, '')
  const disposition = download ? 'attachment' : 'inline'

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
