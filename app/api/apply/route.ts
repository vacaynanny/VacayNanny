import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import { sendApplicationEmails } from '@/lib/email'
import { createSupabaseServer } from '@/lib/supabase/server'
import { slugify } from '@/lib/constants'
import type { DocumentKind, NannyTier } from '@/lib/types'

const FILE_FIELDS: { form: string; kind: DocumentKind }[] = [
  { form: 'photo', kind: 'photo' },
  { form: 'id_front', kind: 'id_front' },
  { form: 'id_back', kind: 'id_back' },
  { form: 'selfie', kind: 'selfie' },
  { form: 'cogc', kind: 'cogc' },
  { form: 'passport', kind: 'passport' },
]

function estimateTier(body: Record<string, unknown>): NannyTier {
  const years = parseInt(String(body.experienceYears || '0'), 10) || 0
  const certs = Array.isArray(body.certifications) ? body.certifications.filter(Boolean) : []
  const langs = Array.isArray(body.languages) ? body.languages : []
  const hasCogc = body.cogcStatus === 'yes' || body.cogcStatus === 'have'
  const travel = body.willingToTravel === 'international' || (Array.isArray(body.services) && body.services.includes('Travel nanny (international)'))
  if (years >= 5 && certs.length && hasCogc && (langs.length >= 3 || travel)) return 'gold'
  if (years >= 2 && hasCogc) return 'silver'
  return 'bronze'
}

async function parseBody(request: NextRequest): Promise<{ payload: Record<string, unknown>; files: Map<string, File> }> {
  const contentType = request.headers.get('content-type') || ''
  const files = new Map<string, File>()
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const raw = form.get('payload')
    const payload = raw ? JSON.parse(String(raw)) : {}
    for (const [key, value] of form.entries()) {
      if (key === 'payload') continue
      if (value instanceof File && value.size > 0) files.set(key, value)
    }
    const extraCerts = form.getAll('certificate')
    extraCerts.forEach((v, i) => {
      if (v instanceof File && v.size > 0) files.set(`certificate_${i}`, v)
    })
    return { payload, files }
  }
  return { payload: await request.json(), files }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Application storage is not configured yet.' }, { status: 503 })
    }

    const { payload: body, files } = await parseBody(request)
    const fullName = String(body.fullName || '').trim()
    const email = String(body.email || '').trim()
    if (!fullName || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })
    }

    let userId: string | null = null
    try {
      const authClient = await createSupabaseServer()
      const { data: { user } } = await authClient.auth.getUser()
      userId = user?.id ?? null
    } catch {}

    const estimated = estimateTier(body)
    const supabase = createServerClient()

    const { data: application, error } = await supabase.from('nanny_applications').insert([{
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
    }]).select('id').single()

    if (error || !application) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ error: error?.message || 'Could not save application' }, { status: 500 })
    }

    const refs = [
      {
        application_id: application.id,
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
        application_id: application.id,
        full_name: body.ref2Name,
        relationship: body.ref2Relationship,
        employer: body.ref2Employer,
        phone: body.ref2Phone,
        email: body.ref2Email,
        country_code: body.ref2Contact,
        permission_to_contact: body.ref2Permission,
        sort_order: 2,
      },
    ].filter(r => r.full_name)

    if (refs.length) {
      const { error: refErr } = await supabase.from('nanny_references').insert(refs)
      if (refErr) console.error('Reference insert error:', refErr)
    }

    for (const [key, file] of files) {
      const mapped = FILE_FIELDS.find(f => f.form === key)
      const kind: DocumentKind = mapped?.kind || (key.startsWith('certificate') ? 'certificate' : 'certificate')
      const bucket = kind === 'photo' ? 'nanny-photos' : 'nanny-documents'
      const path = `${application.id}/${kind}-${slugify(file.name) || 'file'}`
      const buf = Buffer.from(await file.arrayBuffer())
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, buf, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      })
      if (upErr) {
        console.error('Upload error', key, upErr)
        continue
      }
      await supabase.from('nanny_documents').insert([{
        application_id: application.id,
        kind,
        storage_path: `${bucket}/${path}`,
        file_name: file.name,
        mime_type: file.type,
      }])
    }

    sendApplicationEmails({
      fullName,
      email,
      phone: String(body.phone || ''),
      county: String(body.county || ''),
      town: String(body.town || ''),
      experienceYears: String(body.experienceYears || ''),
      cogcStatus: String(body.cogcStatus || ''),
      certifications: Array.isArray(body.certifications) ? body.certifications : [],
      services: Array.isArray(body.services) ? body.services : [],
      ageGroups: Array.isArray(body.ageGroups) ? body.ageGroups : [],
      ref1Name: String(body.ref1Name || ''),
      ref2Name: String(body.ref2Name || ''),
      willingToTravel: String(body.willingToTravel || ''),
    }).catch(err => console.error('sendApplicationEmails failed:', err))

    return NextResponse.json({ success: true, id: application.id, estimatedTier: estimated })
  } catch (err) {
    console.error('Apply route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
