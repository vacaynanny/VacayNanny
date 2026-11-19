import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import { randomUUID } from 'node:crypto'
import { validateApplication } from '@/lib/application-validation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { slugify } from '@/lib/constants'
import {
  APPLICATION_REQUEST_MAX_BYTES,
  collectApplicationFiles,
  prepareApplicationFiles,
} from '@/lib/application-files'
import { limitRoute } from '@/lib/rate-limit'
import {
  readApplicationUpload,
  type ApplicationUploadManifest,
} from '@/lib/application-uploads'
import type { NannyTier } from '@/lib/types'

function estimateTier(body: Record<string, unknown>): NannyTier {
  const years = parseInt(String(body.experienceYears || '0'), 10) || 0
  const certs = Array.isArray(body.certifications)
    ? body.certifications.filter(Boolean)
    : []
  const langs = Array.isArray(body.languages) ? body.languages : []
  const hasCogc = body.cogcStatus === 'yes' || body.cogcStatus === 'have'
  const travel =
    body.willingToTravel === 'international' ||
    (Array.isArray(body.services) &&
      body.services.includes('Travel nanny (international)'))
  if (years >= 5 && certs.length && hasCogc && (langs.length >= 3 || travel))
    return 'gold'
  if (years >= 2 && hasCogc) return 'silver'
  return 'bronze'
}

async function parseBody(request: NextRequest): Promise<
  | {
      payload: Record<string, unknown>
      files: Map<string, File>
      manifest?: ApplicationUploadManifest
    }
  | { error: string }
> {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const raw = form.get('payload')
    const payload = raw ? JSON.parse(String(raw)) : {}
    const files = collectApplicationFiles(form)
    if ('error' in files) return files
    return { payload, files }
  }
  const body = await request.json()
  if (body.manifest) return readApplicationUpload(createServerClient(), body.manifest)
  return { payload: body, files: new Map() }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Application storage is not configured yet.' },
        { status: 503 },
      )
    }

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > APPLICATION_REQUEST_MAX_BYTES) {
      return NextResponse.json(
        { error: 'Uploads are too large. Each file must be 5 MB or smaller.' },
        { status: 413 },
      )
    }

    const supabase = createServerClient()
    const blocked = await limitRoute(request, supabase, 'apply')
    if (blocked) return blocked

    let parsed: Awaited<ReturnType<typeof parseBody>>
    try {
      parsed = await parseBody(request)
    } catch {
      return NextResponse.json(
        {
          error:
            'Your application or uploads could not be verified. Please submit again.',
        },
        { status: 400 },
      )
    }
    if ('error' in parsed)
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { payload: body, files, manifest } = parsed
    const fullName = String(body.fullName || '').trim()
    const email = String(body.email || '').trim()
    if (!fullName || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })
    }

    const emailBlocked = await limitRoute(request, supabase, 'apply', {
      email,
      skipIp: true,
    })
    if (emailBlocked) return emailBlocked

    const prepared = await prepareApplicationFiles(files)
    if ('error' in prepared)
      return NextResponse.json({ error: prepared.error }, { status: 400 })

    let userId: string | null = null
    try {
      const authClient = await createSupabaseServer()
      const {
        data: { user },
      } = await authClient.auth.getUser()
      userId = user?.email?.toLowerCase() === email.toLowerCase() ? user.id : null
    } catch {}

    const errors = validateApplication(
      body,
      prepared.files.map((file) => file.kind),
    )
    if (errors.length)
      return NextResponse.json({ error: errors[0], errors }, { status: 400 })
    const estimated = estimateTier(body)
    const applicationId = manifest?.applicationId || randomUUID()
    const submissionKey =
      typeof body.submissionKey === 'string' &&
      /^[0-9a-f-]{36}$/i.test(body.submissionKey)
        ? body.submissionKey
        : randomUUID()

    const row = {
      id: applicationId,
      submission_key: submissionKey,
      user_id: userId,
      full_name: fullName,
      date_of_birth: body.dateOfBirth || null,
      phone: body.phone || null,
      country_code: body.countryCode || null,
      email,
      gender: body.gender || null,
      languages: body.languages || [],
      county: body.county || null,
      town: body.town || null,
      national_id_number: body.nationalIdNumber || null,
      kra_pin: body.kraPin || null,
      cogc_status: body.cogcStatus || null,
      cogc_date: body.cogcDate || null,
      experience_years: body.experienceYears || null,
      age_groups: body.ageGroups || [],
      services: body.services || [],
      bio: body.bio || null,
      certifications: body.certifications || [],
      swimming: body.swimming || null,
      cooking: body.cooking || null,
      tutoring: body.tutoring || null,
      driving: body.driving || null,
      special_needs: body.specialNeeds || null,
      available_days: body.availableDays || [],
      earliest_start: body.earliestStart || null,
      latest_end: body.latestEnd || null,
      willing_to_travel: body.willingToTravel || null,
      preferred_locations: body.preferredLocations || [],
      comfortable_pets: body.comfortablePets || null,
      comfortable_multiple: body.comfortableMultiple || null,
      estimated_tier: estimated,
      status: 'pending',
      consent_background: Boolean(body.consentBackground),
      consent_terms: Boolean(body.consentTerms),
      consent_accuracy: Boolean(body.consentAccuracy),
    }

    const refs = [
      {
        application_id: applicationId,
        full_name: body.ref1Name,
        relationship: body.ref1Relationship,
        employer: body.ref1Employer,
        phone: body.ref1Phone,
        email: body.ref1Email,
        country_code: body.ref1Contact,
        permission_to_contact: body.ref1Permission,
        sort_order: 1,
      },
      {
        application_id: applicationId,
        full_name: body.ref2Name,
        relationship: body.ref2Relationship,
        employer: body.ref2Employer,
        phone: body.ref2Phone,
        email: body.ref2Email,
        country_code: body.ref2Contact,
        permission_to_contact: body.ref2Permission,
        sort_order: 2,
      },
    ].filter((r) => r.full_name)

    const uploaded: Array<{ bucket: string; path: string }> = []
    const documents: Array<Record<string, unknown>> = []
    let committed = false
    let preserveFiles = false
    try {
      if (!manifest) {
        const { error } = await supabase.rpc('enqueue_workflow_job', {
          p_kind: 'application_upload_cleanup',
          p_payload: { entries: [] },
          p_key: `application-upload-cleanup:${applicationId}`,
        })
        if (error)
          throw new Error('Could not prepare safe document storage. Please retry.')
      }
      for (const [index, file] of prepared.files.entries()) {
        const staged = manifest?.entries[index]
        const bucket = 'nanny-documents'
        const path =
          staged?.path ||
          `${applicationId}/${randomUUID()}-${slugify(file.fileName) || 'file'}`
        const { error } = staged
          ? { error: null }
          : await supabase.storage
              .from(bucket)
              .upload(path, file.buffer, { contentType: file.contentType, upsert: false })
        if (error)
          throw new Error(
            'A document could not be uploaded. Your application has not been submitted; please retry.',
          )
        uploaded.push({ bucket, path })
        if (!manifest) {
          const { error } = await supabase
            .from('workflow_jobs')
            .update({ payload: { entries: uploaded } })
            .eq('dedupe_key', `application-upload-cleanup:${applicationId}`)
          if (error) throw new Error('Could not record document staging. Please retry.')
        }
        documents.push({
          application_id: applicationId,
          kind: file.kind,
          storage_path: `${bucket}/${path}`,
          file_name: file.fileName,
          mime_type: file.contentType,
        })
      }
      const { data, error } = await supabase.rpc('save_complete_application', {
        p_row: row,
        p_references: refs,
        p_documents: documents,
      })
      if (error) {
        preserveFiles = !/^(23|P0001|42501)/.test(error.code || '')
        throw new Error(
          'Your complete application could not be saved. Please retry with the same details.',
        )
      }
      committed = data?.id === applicationId
      return NextResponse.json({ success: true, id: data.id, estimatedTier: estimated })
    } finally {
      if (!committed && !preserveFiles)
        for (const upload of uploaded)
          await supabase.storage.from(upload.bucket).remove([upload.path])
    }
  } catch (err) {
    console.error('Apply route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
