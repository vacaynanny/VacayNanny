import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServerClient } from '@/lib/supabase'
import { validateApplication } from '@/lib/application-validation'
import { APPLICATION_FILE_MAX_BYTES } from '@/lib/application-files'
import { sealWorkflow } from '@/lib/workflow-secrets'
import { enqueueJob } from '@/lib/workflow-jobs'
import { limitRoute } from '@/lib/rate-limit'
import type {
  ApplicationUploadEntry,
  ApplicationUploadManifest,
} from '@/lib/application-uploads'
const kinds = new Set([
  'photo',
  'id_front',
  'id_back',
  'selfie',
  'cogc',
  'passport',
  'certificate',
  'certificate_1',
  'certificate_2',
])
export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 64000)
      return NextResponse.json(
        { error: 'Application metadata is too large.' },
        { status: 413 },
      )
    const { payload, files } = await request.json()
    if (
      !payload ||
      typeof payload !== 'object' ||
      !Array.isArray(files) ||
      files.length > 9 ||
      files.some(
        (f) =>
          !kinds.has(f.key) ||
          typeof f.name !== 'string' ||
          f.name.length > 120 ||
          !Number.isInteger(f.size) ||
          f.size <= 0 ||
          f.size > APPLICATION_FILE_MAX_BYTES,
      ) ||
      new Set(files.map((f) => f.key)).size !== files.length
    )
      return NextResponse.json(
        { error: 'Choose valid files of up to 5 MB each.' },
        { status: 400 },
      )
    const errors = validateApplication(
      payload,
      files.map((f) => (f.key.startsWith('certificate') ? 'certificate' : f.key)),
    )
    if (errors.length)
      return NextResponse.json({ error: errors[0], errors }, { status: 400 })
    const db = createServerClient(),
      blocked = await limitRoute(request, db, 'apply_upload', {
        email: String(payload.email),
      })
    if (blocked) return blocked
    const applicationId = randomUUID(),
      entries: ApplicationUploadEntry[] = files.map((file) => ({
        key: file.key,
        kind: file.key.startsWith('certificate') ? 'certificate' : file.key,
        bucket: 'nanny-documents',
        path: `${applicationId}/${randomUUID()}`,
        name: file.name,
        size: file.size,
      }))
    const manifest: ApplicationUploadManifest = {
      applicationId,
      entries,
      payload,
      expiresAt: Date.now() + 2 * 3600000,
    }
    await enqueueJob(
      db,
      'application_upload_cleanup',
      { entries: entries.map(({ bucket, path }) => ({ bucket, path })) },
      `application-upload-cleanup:${applicationId}`,
    )
    const signed = []
    for (const entry of entries) {
      const { data, error } = await db.storage
        .from(entry.bucket)
        .createSignedUploadUrl(entry.path)
      if (error || !data) throw new Error('Could not prepare private uploads.')
      signed.push({ ...entry, token: data.token })
    }
    return NextResponse.json(
      { manifest: sealWorkflow(manifest), entries: signed },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json(
      { error: 'Could not prepare your uploads. Please retry.' },
      { status: 503 },
    )
  }
}
