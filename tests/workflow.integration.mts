import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { localCredentials } from '../scripts/local-database.mjs'
import { applyBookingMutation, nannyContact } from '../lib/booking-ops'
import { createGuestAccess } from '../lib/guest-access'

let db: SupabaseClient,
  client: SupabaseClient,
  operator: string,
  family: string,
  nannyUser: string
const users: string[] = [],
  apps: string[] = [],
  nannies: string[] = [],
  books: string[] = [],
  enquiries: string[] = []
const days = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]
const date = (offset: number) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
const checks = {
  identity: true,
  policeClearance: true,
  references: true,
  interview: true,
  qualifications: true,
}
before(async () => {
  const config = await localCredentials(),
    options = { auth: { persistSession: false, autoRefreshToken: false } }
  db = createClient(config.url, config.serviceKey, options)
  client = createClient(config.url, config.anonKey, options)
  for (const role of ['admin', 'parent', 'nanny'] as const) {
    const email = `workflow-${randomUUID()}@example.test`,
      password = `Test-${randomUUID()}`
    const result = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    assert.ifError(result.error)
    const id = result.data!.user!.id
    users.push(id)
    assert.ifError((await db.from('profiles').update({ role }).eq('id', id)).error)
    if (role === 'admin') operator = id
    if (role === 'parent') {
      family = id
      assert.ifError((await client.auth.signInWithPassword({ email, password })).error)
    }
    if (role === 'nanny') nannyUser = id
  }
})
after(async () => {
  if (!db) return
  for (const id of enquiries) await db.from('contact_messages').delete().eq('id', id)
  for (const id of books) {
    await db.from('workflow_audit').delete().eq('entity_id', id)
    await db.from('ops_tasks').delete().eq('booking_id', id)
    await db.from('bookings').delete().eq('id', id)
  }
  for (const id of nannies) await db.from('nannies').delete().eq('id', id)
  for (const id of apps) {
    await db.from('workflow_audit').delete().eq('entity_id', id)
    await db.from('nanny_applications').delete().eq('id', id)
  }
  for (const id of users) {
    await db.from('workflow_audit').delete().eq('actor_id', id)
    await db.auth.admin.deleteUser(id)
  }
})
async function newNanny(userId: string | null = null) {
  const id = randomUUID()
  apps.push(id)
  assert.ifError(
    (
      await db.from('nanny_applications').insert({
        id,
        user_id: userId,
        full_name: 'Workflow Test Nanny',
        email: `nanny-${id}@example.test`,
        status: 'approved',
        agreement_signed_path: 'local/signed.pdf',
        agreement_reviewed_at: new Date().toISOString(),
        agreement_reviewed_by: operator,
        vetting_checks: checks,
        vetting_reviewed_by: operator,
        vetting_reviewed_at: new Date().toISOString(),
      })
    ).error,
  )
  const saved = await db
    .from('nannies')
    .insert({
      application_id: id,
      user_id: userId,
      slug: `workflow-${id}`,
      display_name: 'Workflow Test Nanny',
      tier: 'bronze',
      daily_rate_kes: 2200,
      is_active: true,
      available_days: days,
      destinations: ['Diani'],
      age_groups: ['School-age'],
      services: ['Daytime childcare'],
    })
    .select('*')
    .single()
  assert.ifError(saved.error)
  nannies.push(saved.data!.id)
  return saved.data!
}
async function newBooking(nannyId: string | null, needed = '1', offset = 30) {
  const guest = createGuestAccess(),
    id = randomUUID()
  books.push(id)
  const { error } = await db.rpc('save_booking_request', {
    p_row: {
      id,
      parent_id: family,
      parent_name: 'Workflow Test Family',
      email: 'family@example.test',
      destination: 'Diani',
      check_in: date(offset),
      check_out: date(offset + 2),
      children_count: '2',
      nannies_needed: needed,
      nanny_id: nannyId,
      status: nannyId ? 'matched' : 'pending',
      nanny_response: nannyId ? 'pending' : null,
      care_type: 'standard',
      total_amount_kes: 4400,
      addon_codes: [],
      payment_status: 'not_required',
      guest_access_token_hash: guest.hash,
    },
    p_notification: { localTest: true },
  })
  assert.ifError(error)
  return id
}
test('profile email cannot be forged through the real authenticated Data API', async () => {
  const result = await client
    .from('profiles')
    .update({ email: 'unrelated@example.test' })
    .eq('id', family)
  assert.ok(result.error)
  assert.match(result.error.message, /Identity and role/)
  const rpc = await client.rpc('commit_booking_mutation', {
    p_id: randomUUID(),
    p_version: 0,
    p_action: 'confirm',
    p_updates: {},
    p_actor: family,
    p_verified_email: 'forged@example.test',
    p_guest_hash: null,
  })
  assert.ok(rpc.error)
})
test('concurrent acceptances both succeed and end in one confirmed booking', async () => {
  const nanny = await newNanny(nannyUser),
    id = await newBooking(nanny.id)
  await Promise.all([
    applyBookingMutation(db, id, { action: 'confirm' }, { id: family }),
    applyBookingMutation(db, id, { action: 'accept' }, { id: nannyUser }),
  ])
  const { data } = await db.from('bookings').select('*').eq('id', id).single()
  assert.equal(data!.status, 'confirmed')
  assert.equal(data!.nanny_response, 'accepted')
  assert.ok(data!.parent_confirmed_at)
  const { data: jobs } = await db
    .from('workflow_jobs')
    .select('id')
    .like('dedupe_key', `booking:${id}:%`)
  assert.equal(jobs?.length, 3)
})
test('competing requests for the same nanny cannot reserve overlapping care days', async () => {
  const nanny = await newNanny(),
    base = {
      parent_name: 'Race Test',
      email: 'race@example.test',
      destination: 'Diani',
      check_in: date(45),
      check_out: date(47),
      children_count: '2',
      nannies_needed: '1',
      nanny_id: nanny.id,
      status: 'matched',
      nanny_response: 'pending',
      care_type: 'standard',
      total_amount_kes: 4400,
      payment_status: 'not_required',
    }
  const ids = [randomUUID(), randomUUID()]
  books.push(...ids)
  const results = await Promise.all(
    ids.map((id) =>
      db.rpc('save_booking_request', {
        p_row: { ...base, id, addon_codes: [] },
        p_notification: { localTest: true },
      }),
    ),
  )
  assert.equal(results.filter((r) => !r.error).length, 1)
  assert.equal(results.filter((r) => r.error?.code === '23P01').length, 1)
})
test('rescheduling clears every acceptance and requires a fresh match confirmation', async () => {
  const nanny = await newNanny(),
    id = await newBooking(nanny.id, '1', 55)
  await applyBookingMutation(db, id, { action: 'accept' }, { id: operator })
  await applyBookingMutation(db, id, { action: 'confirm' }, { id: family })
  await applyBookingMutation(
    db,
    id,
    { action: 'reschedule', checkIn: date(60), checkOut: date(62) },
    { id: family },
  )
  const { data } = await db
    .from('bookings')
    .select('status,parent_confirmed_at,nanny_response,booking_assignments(response)')
    .eq('id', id)
    .single()
  assert.equal(data!.status, 'matched')
  assert.equal(data!.parent_confirmed_at, null)
  assert.equal(data!.nanny_response, 'pending')
  assert.equal(data!.booking_assignments[0].response, 'pending')
})
test('every requested nanny must be assigned and accept before confirmation', async () => {
  const first = await newNanny(),
    second = await newNanny(),
    id = await newBooking(first.id, '2', 65)
  await assert.rejects(
    applyBookingMutation(db, id, { action: 'confirm' }, { id: family }),
    /complete care team/,
  )
  await applyBookingMutation(db, id, { action: 'accept' }, { id: operator })
  assert.equal(
    (await db.from('bookings').select('status').eq('id', id).single()).data!.status,
    'matched',
  )
  await applyBookingMutation(
    db,
    id,
    { action: 'assign', slot: 2, nannyId: second.id },
    { id: operator },
  )
  await applyBookingMutation(db, id, { action: 'accept' }, { id: operator })
  const current = (await db.from('bookings').select('version').eq('id', id).single()).data
  assert.ifError(
    (
      await db.rpc('commit_booking_mutation', {
        p_id: id,
        p_version: current!.version,
        p_action: 'accept',
        p_updates: {},
        p_actor: operator,
        p_verified_email: null,
        p_guest_hash: null,
        p_slot: 2,
        p_event: 'nanny_accepted',
      })
    ).error,
  )
  await applyBookingMutation(db, id, { action: 'confirm' }, { id: family })
  const { data } = await db
    .from('bookings')
    .select('status,booking_assignments(response)')
    .eq('id', id)
    .single()
  assert.equal(data!.status, 'confirmed')
  assert.equal(data!.booking_assignments.length, 2)
  const slots = await db
    .from('booking_care_slots')
    .select('nanny_id')
    .eq('booking_id', id)
  assert.equal(new Set(slots.data?.map((s) => s.nanny_id)).size, 2)
})
test('suspension cannot be reversed by profile editing and creates active-placement follow-ups', async () => {
  const nanny = await newNanny(),
    id = await newBooking(nanny.id, '1', 75)
  assert.ifError(
    (
      await db.rpc('moderate_nanny', {
        p_id: nanny.id,
        p_actor: operator,
        p_active: false,
      })
    ).error,
  )
  await db.from('nannies').update({ is_active: true }).eq('id', nanny.id)
  const { data } = await db
    .from('nannies')
    .select('is_active,is_suspended')
    .eq('id', nanny.id)
    .single()
  assert.equal(data!.is_active, false)
  assert.equal(data!.is_suspended, true)
  const tasks = await db
    .from('ops_tasks')
    .select('id')
    .eq('booking_id', id)
    .eq('kind', 'nanny_suspended')
  assert.equal(tasks.data?.length, 1)
})
test('expired proposals release all care reservations and overdue replacement alerts are deduplicated', async () => {
  const nanny = await newNanny(),
    id = await newBooking(nanny.id, '1', 85)
  await db
    .from('bookings')
    .update({ match_expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq('id', id)
  assert.ifError((await db.rpc('run_workflow_automation')).error)
  assert.equal(
    (await db.from('booking_care_slots').select('nanny_id').eq('booking_id', id)).data
      ?.length,
    0,
  )
  await db
    .from('bookings')
    .update({
      status: 'matched',
      replacement_requested_at: new Date(Date.now() - 3 * 3600000).toISOString(),
      replacement_fulfilled_at: null,
    })
    .eq('id', id)
  assert.ifError((await db.rpc('run_workflow_automation')).error)
  assert.ifError((await db.rpc('run_workflow_automation')).error)
  const tasks = await db
    .from('ops_tasks')
    .select('id')
    .eq('booking_id', id)
    .eq('kind', 'replacement_overdue')
  assert.equal(tasks.data?.length, 1)
})
test('an anonymous application can be linked to its verified account without stealing another account application', async () => {
  const applicationId = randomUUID()
  apps.push(applicationId)
  const identity = await db.auth.admin.getUserById(family),
    email = identity.data!.user!.email!
  await db
    .from('nanny_applications')
    .insert({ id: applicationId, full_name: 'Guest applicant', email })
  assert.ifError(
    (
      await db.rpc('claim_nanny_applications', {
        p_actor: family,
        p_verified_email: email,
      })
    ).error,
  )
  assert.equal(
    (
      await db
        .from('nanny_applications')
        .select('user_id')
        .eq('id', applicationId)
        .single()
    ).data!.user_id,
    family,
  )
  assert.ifError(
    (
      await db.rpc('claim_nanny_applications', {
        p_actor: operator,
        p_verified_email: email,
      })
    ).error,
  )
  assert.equal(
    (
      await db
        .from('nanny_applications')
        .select('user_id')
        .eq('id', applicationId)
        .single()
    ).data!.user_id,
    family,
  )
})
test('specialist quotes require assessment and owner, enforce expiry/version, and freeze accepted scope', async () => {
  const id = randomUUID()
  enquiries.push(id)
  const token = createGuestAccess()
  assert.ifError(
    (
      await db.rpc('save_contact_enquiry', {
        p_row: {
          id,
          name: 'Specialist Test',
          email: 'specialist@example.test',
          subject: 'Specialist care',
          message: 'Please assess a care plan.',
          care_service: 'Professional Nursing Care',
          guest_access_token_hash: token.hash,
        },
        p_notice: null,
      })
    ).error,
  )
  const premature = await db.rpc('update_care_enquiry', {
    p_id: id,
    p_actor: operator,
    p_version: 0,
    p_changes: { care_status: 'quoted' },
    p_notice: { localTest: true },
  })
  assert.ok(premature.error)
  const quote = {
    care_status: 'quoted',
    assigned_to: operator,
    assessment_notes: 'Needs assessed with family privately.',
    provider_details: 'Qualified provider credentials checked by operations.',
    quote_summary: 'Agreed nursing care scope and support schedule.',
    quote_amount_kes: 6000,
    quote_expires_at: new Date(Date.now() + 86400000).toISOString(),
    service_start: date(10),
    service_end: date(11),
  }
  assert.ifError(
    (
      await db.rpc('update_care_enquiry', {
        p_id: id,
        p_actor: operator,
        p_version: 0,
        p_changes: quote,
        p_notice: { localTest: true },
      })
    ).error,
  )
  const forged = await db.rpc('accept_care_quote', {
    p_id: id,
    p_version: 1,
    p_actor: null,
    p_verified_email: null,
    p_guest_hash: 'a'.repeat(64),
  })
  assert.ok(forged.error)
  assert.ifError(
    (
      await db.rpc('accept_care_quote', {
        p_id: id,
        p_version: 1,
        p_actor: null,
        p_verified_email: null,
        p_guest_hash: token.hash,
      })
    ).error,
  )
  assert.ok(
    (
      await db.rpc('update_care_enquiry', {
        p_id: id,
        p_actor: operator,
        p_version: 2,
        p_changes: { care_status: 'fulfilled', quote_amount_kes: 1 },
        p_notice: null,
      })
    ).error,
  )
  assert.ifError(
    (
      await db.rpc('update_care_enquiry', {
        p_id: id,
        p_actor: operator,
        p_version: 2,
        p_changes: { care_status: 'fulfilled' },
        p_notice: null,
      })
    ).error,
  )
})

test('complete application save is atomic and duplicate submission keys do not create duplicates', async () => {
  const id = randomUUID(),
    key = randomUUID()
  apps.push(id)
  const row = {
    id,
    submission_key: key,
    full_name: 'Complete application test',
    date_of_birth: '1990-01-01',
    email: 'complete@example.test',
    languages: ['English'],
    age_groups: ['School-age'],
    services: ['Daytime childcare'],
    certifications: [],
    available_days: days,
    preferred_locations: ['Diani'],
    estimated_tier: 'bronze',
    consent_background: true,
    consent_terms: true,
    consent_accuracy: true,
  }
  const docs = ['photo', 'id_front', 'id_back', 'selfie'].map((kind) => ({
    kind,
    storage_path: `local-tests/${id}/${kind}.jpg`,
  }))
  const refs = [
    { full_name: 'Reference One', sort_order: 1 },
    { full_name: null, sort_order: 2 },
  ]
  assert.ok(
    (
      await db.rpc('save_complete_application', {
        p_row: row,
        p_references: refs,
        p_documents: docs,
      })
    ).error,
  )
  assert.equal(
    (await db.from('nanny_applications').select('id').eq('id', id)).data?.length,
    0,
  )
  assert.equal(
    (await db.from('nanny_references').select('id').eq('application_id', id)).data
      ?.length,
    0,
  )
  refs[1].full_name = 'Reference Two'
  assert.ifError(
    (
      await db.rpc('save_complete_application', {
        p_row: row,
        p_references: refs,
        p_documents: docs,
      })
    ).error,
  )
  const duplicateId = randomUUID()
  const duplicate = await db.rpc('save_complete_application', {
    p_row: { ...row, id: duplicateId },
    p_references: refs,
    p_documents: docs,
  })
  assert.ifError(duplicate.error)
  assert.equal(duplicate.data!.id, id)
  assert.equal(
    (await db.from('nanny_applications').select('id').eq('submission_key', key)).data
      ?.length,
    1,
  )
  const premature = await db.rpc('review_nanny_application', {
    p_id: id,
    p_actor: operator,
    p_changes: { status: 'approved' },
  })
  assert.ok(premature.error)
})
test('notification claims use leases and recover from stale workers without losing the job', async () => {
  const key = `lease-test:${randomUUID()}`
  const queued = await db.rpc('enqueue_workflow_job', {
    p_kind: 'ops_notice',
    p_payload: { summary: 'Synthetic lease recovery test' },
    p_key: key,
  })
  assert.ifError(queued.error)
  const duplicate = await db.rpc('enqueue_workflow_job', {
    p_kind: 'ops_notice',
    p_payload: { summary: 'Duplicate' },
    p_key: key,
  })
  assert.equal(duplicate.data, queued.data)
  const claims = await Promise.all([
    db.rpc('claim_workflow_jobs', { p_limit: 100 }),
    db.rpc('claim_workflow_jobs', { p_limit: 100 }),
  ])
  claims.forEach((r) => assert.ifError(r.error))
  const matching = claims
    .flatMap((result) => result.data)
    .filter((job) => job.id === queued.data)
  assert.equal(matching.length, 1)
  const job = matching[0]
  await db.rpc('finish_workflow_job', {
    p_id: job.id,
    p_lease: randomUUID(),
    p_error: null,
  })
  assert.equal(
    (await db.from('workflow_jobs').select('status').eq('id', job.id).single()).data!
      .status,
    'processing',
  )
  await db
    .from('workflow_jobs')
    .update({ locked_at: new Date(Date.now() - 16 * 60000).toISOString() })
    .eq('id', job.id)
  const reclaimed = await db.rpc('claim_workflow_jobs', { p_limit: 100 })
  assert.ifError(reclaimed.error)
  const next = reclaimed.data!.find(
    (j: { id: string; lease_token: string }) => j.id === job.id,
  )
  assert.ok(next)
  assert.notEqual(next.lease_token, job.lease_token)
  await db.rpc('finish_workflow_job', {
    p_id: job.id,
    p_lease: job.lease_token,
    p_error: null,
  })
  assert.equal(
    (await db.from('workflow_jobs').select('status').eq('id', job.id).single()).data!
      .status,
    'processing',
  )
  await db.rpc('finish_workflow_job', {
    p_id: job.id,
    p_lease: next.lease_token,
    p_error: 'Synthetic failure',
  })
  const pending = (
    await db.from('workflow_jobs').select('status,available_at').eq('id', job.id).single()
  ).data
  assert.equal(pending!.status, 'pending')
  assert.ok(Date.parse(pending!.available_at) > Date.now())
  await db.from('workflow_jobs').delete().eq('id', job.id)
})

test('abandoned upload cleanup preserves committed documents and runs while email is disabled', async () => {
  const { processWorkflowJobs } = await import('../lib/workflow-jobs')
  const previous = process.env.EMAIL_DELIVERY_MODE
  process.env.EMAIL_DELIVERY_MODE = 'disabled'
  const id = randomUUID()
  apps.push(id)
  const entries = ['kept.pdf', 'orphan.pdf'].map((name) => ({
    bucket: 'nanny-documents',
    path: `local-workflow-cleanup/${id}/${name}`,
  }))
  let jobId: string | undefined
  try {
    assert.ifError(
      (
        await db
          .from('nanny_applications')
          .insert({ id, full_name: 'Cleanup test', email: 'cleanup@example.test' })
      ).error,
    )
    for (const entry of entries)
      assert.ifError(
        (
          await db.storage
            .from(entry.bucket)
            .upload(entry.path, Buffer.from('%PDF-1.4\nLOCAL TEST'), {
              contentType: 'application/pdf',
            })
        ).error,
      )
    assert.ifError(
      (
        await db.from('nanny_documents').insert({
          application_id: id,
          kind: 'id_front',
          storage_path: `${entries[0].bucket}/${entries[0].path}`,
        })
      ).error,
    )
    const queued = await db.rpc('enqueue_workflow_job', {
      p_kind: 'application_upload_cleanup',
      p_payload: { entries },
      p_key: `cleanup-test:${id}`,
    })
    assert.ifError(queued.error)
    jobId = queued.data
    const scheduled = (
      await db.from('workflow_jobs').select('available_at').eq('id', jobId!).single()
    ).data
    assert.ok(Date.parse(scheduled!.available_at) > Date.now() + 2 * 3600000)
    await db
      .from('workflow_jobs')
      .update({ available_at: new Date(Date.now() - 1000).toISOString() })
      .eq('id', jobId!)
    const result = await processWorkflowJobs(db, 100)
    assert.equal(result.disabled, true)
    assert.ok(result.processed >= 1)
    assert.ifError(
      (await db.storage.from(entries[0].bucket).download(entries[0].path)).error,
    )
    assert.ok((await db.storage.from(entries[1].bucket).download(entries[1].path)).error)
  } finally {
    for (const entry of entries) await db.storage.from(entry.bucket).remove([entry.path])
    if (jobId) await db.from('workflow_jobs').delete().eq('id', jobId)
    if (previous === undefined) delete process.env.EMAIL_DELIVERY_MODE
    else process.env.EMAIL_DELIVERY_MODE = previous
  }
})

test('nanny notifications use the canonical Auth address rather than editable profile contact data', async () => {
  const identity = await db.auth.admin.getUserById(nannyUser)
  assert.ifError(identity.error)
  await db
    .from('profiles')
    .update({ email: 'unrelated-contact@example.test' })
    .eq('id', nannyUser)
  const nanny = (await db.from('nannies').select('id').eq('user_id', nannyUser).single())
    .data!
  const contact = await nannyContact(db, nanny.id)
  assert.equal(contact.email, identity.data.user!.email)
})

test('repeated acceptance and unchanged rescheduling do not reset consent or duplicate notifications', async () => {
  const nanny = await newNanny(),
    id = await newBooking(nanny.id, '1', 120)
  await applyBookingMutation(db, id, { action: 'accept' }, { id: operator })
  await applyBookingMutation(db, id, { action: 'confirm' }, { id: family })
  const before = (
    await db.from('bookings').select('version,parent_confirmed_at').eq('id', id).single()
  ).data!
  await applyBookingMutation(db, id, { action: 'accept' }, { id: operator })
  await applyBookingMutation(
    db,
    id,
    { action: 'reschedule', checkIn: date(120), checkOut: date(122) },
    { id: family },
  )
  const after = (
    await db
      .from('bookings')
      .select('version,parent_confirmed_at,status')
      .eq('id', id)
      .single()
  ).data!
  assert.equal(after.version, before.version)
  assert.equal(after.parent_confirmed_at, before.parent_confirmed_at)
  assert.equal(after.status, 'confirmed')
})
