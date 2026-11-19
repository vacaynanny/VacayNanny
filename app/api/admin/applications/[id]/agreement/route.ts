import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireAdminProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const form = await request.formData()
  const file = form.get('agreement')
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 8 * 1024 * 1024 ||
    form.get('reviewed') !== 'true'
  )
    return NextResponse.json(
      {
        error:
          'Upload the signed PDF (up to 8 MB) and confirm that you have reviewed it.',
      },
      { status: 400 },
    )
  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.subarray(0, 5).toString() !== '%PDF-')
    return NextResponse.json(
      { error: 'The signed agreement must be a PDF.' },
      { status: 400 },
    )
  const supabase = createServerClient()
  const { data: app } = await supabase
    .from('nanny_applications')
    .select('status')
    .eq('id', id)
    .maybeSingle()
  if (app?.status !== 'approved')
    return NextResponse.json({ error: 'Approve the application first.' }, { status: 409 })
  const path = `${id}/agreements/${randomUUID()}.pdf`
  const { error: uploadError } = await supabase.storage
    .from('nanny-documents')
    .upload(path, bytes, { contentType: 'application/pdf', upsert: false })
  if (uploadError)
    return NextResponse.json(
      { error: 'Could not store the signed agreement.' },
      { status: 500 },
    )
  const { error } = await supabase.rpc('record_nanny_agreement', {
    p_id: id,
    p_actor: admin.id,
    p_path: path,
  })
  if (error) {
    await supabase.storage.from('nanny-documents').remove([path])
    return NextResponse.json(
      { error: 'Could not record agreement review.' },
      { status: 500 },
    )
  }
  return NextResponse.json({ success: true })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdminProfile()))
    return new NextResponse('Unauthorized', { status: 401 })
  const { id } = await params
  const supabase = createServerClient()
  const { data: app } = await supabase
    .from('nanny_applications')
    .select('agreement_signed_path')
    .eq('id', id)
    .maybeSingle()
  if (!app?.agreement_signed_path) return new NextResponse('Not found', { status: 404 })
  const { data, error } = await supabase.storage
    .from('nanny-documents')
    .download(app.agreement_signed_path)
  if (error || !data) return new NextResponse('Not found', { status: 404 })
  return new NextResponse(data, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="signed-vacaynanny-agreement.pdf"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
