import { completeApplication } from './fixtures/application'
import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { localCli, localCredentials, root } from '../scripts/local-database.mjs'
import { checkDatabase } from '../lib/database-checks'
import { applyBookingMutation } from '../lib/booking-ops'

let admin: SupabaseClient
let anonymous: SupabaseClient
let signedIn: SupabaseClient
let settings: Awaited<ReturnType<typeof localCredentials>>
let userId: string
let applicationId: string
let nannyId: string
let bookingId: string
let documentPath: string
const reference = `VN-${randomUUID()}`
const date = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

before(async () => {
  settings = await localCredentials()
  const options = { auth: { autoRefreshToken: false, persistSession: false } }
  admin = createClient(settings.url, settings.serviceKey, options)
  anonymous = createClient(settings.url, settings.anonKey, options)
  signedIn = createClient(settings.url, settings.anonKey, options)
  const email = `local-${randomUUID()}@example.test`
  const password = `Local-${randomBytes(20).toString('hex')}`
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Local integration test', role: 'admin' },
  })
  assert.ifError(created.error)
  userId = created.data.user!.id
  const login = await signedIn.auth.signInWithPassword({ email, password })
  assert.ifError(login.error)
})

after(async () => {
  if (!admin) return
  if (bookingId) {
    await admin.from('payment_attempts').delete().eq('booking_id', bookingId)
    await admin.from('bookings').delete().eq('id', bookingId)
  }
  if (nannyId) await admin.from('nannies').delete().eq('id', nannyId)
  if (documentPath) await admin.storage.from('nanny-documents').remove([documentPath])
  if (applicationId)
    await admin.from('nanny_applications').delete().eq('id', applicationId)
  if (userId) await admin.auth.admin.deleteUser(userId)
})

test('the full schema is available through the actual local Data API', async () => {
  const checks = await checkDatabase({
    NEXT_PUBLIC_SUPABASE_URL: settings.url,
    SUPABASE_SERVICE_ROLE_KEY: settings.serviceKey,
  })
  assert.ok(
    checks.every((check) => check.status === 'ready'),
    JSON.stringify(checks),
  )
  const tiers = await anonymous.from('pricing_tiers').select('code')
  assert.ifError(tiers.error)
  assert.equal(tiers.data?.length, 3)
})

test('real Auth triggers create a parent profile and reject client role escalation', async () => {
  const profile = await signedIn.from('profiles').select('role').eq('id', userId).single()
  assert.ifError(profile.error)
  assert.equal(profile.data?.role, 'parent')
  const forged = await signedIn
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', userId)
  assert.ok(forged.error)
  const promoted = await admin.from('profiles').update({ role: 'admin' }).eq('id', userId)
  assert.ifError(promoted.error)
  const visible = await signedIn.from('profiles').select('role').eq('id', userId).single()
  assert.ifError(visible.error)
  assert.equal(visible.data?.role, 'admin')
})

test('agreement review gates publication and the document remains private in real Storage', async () => {
  const application = await admin
    .from('nanny_applications')
    .insert({
      full_name: 'Local sample nanny',
      email: 'local-nanny@example.test',
      status: 'approved',
    })
    .select('id')
    .single()
  assert.ifError(application.error)
  applicationId = application.data!.id
  const nanny = await admin
    .from('nannies')
    .insert({
      application_id: applicationId,
      slug: `local-${randomUUID()}`,
      display_name: 'Local sample nanny',
      is_active: false,
    })
    .select('id')
    .single()
  assert.ifError(nanny.error)
  nannyId = nanny.data!.id
  const premature = await admin
    .from('nannies')
    .update({ is_active: true })
    .eq('id', nannyId)
  assert.match(premature.error?.message || '', /signed agreement/)
  documentPath = `local-tests/${applicationId}/signed.pdf`
  // Deliberately labelled test bytes; never configured as the official agreement.
  const upload = await admin.storage
    .from('nanny-documents')
    .upload(
      documentPath,
      Buffer.from('%PDF-1.4\n% LOCAL INTEGRATION TEST DOCUMENT\n%%EOF'),
      { contentType: 'application/pdf' },
    )
  assert.ifError(upload.error)
  const privateRead = await anonymous.storage
    .from('nanny-documents')
    .download(documentPath)
  assert.ok(privateRead.error)
  const review = await admin
    .from('nanny_applications')
    .update({
      agreement_signed_path: documentPath,
      agreement_reviewed_at: new Date().toISOString(),
      agreement_reviewed_by: userId,
      vetting_reviewed_by: userId,
      vetting_reviewed_at: new Date().toISOString(),
      vetting_checks: {
        identity: true,
        policeClearance: true,
        references: true,
        interview: true,
        qualifications: true,
      },
    })
    .eq('id', applicationId)
  assert.ifError(review.error)
  const publish = await admin
    .from('nannies')
    .update({ is_active: true })
    .eq('id', nannyId)
  assert.ifError(publish.error)
  const publicProfile = await anonymous
    .from('nannies')
    .select('id')
    .eq('id', nannyId)
    .single()
  assert.ifError(publicProfile.error)
})

test('anonymous clients cannot forge bookings, publish nannies or call settlement', async () => {
  const booking = await anonymous.from('bookings').insert({
    parent_name: 'Forgery',
    email: 'forgery@example.test',
    destination: 'Diani',
    check_in: date(10),
    check_out: date(12),
    payment_status: 'paid',
  })
  assert.ok(booking.error)
  const publish = await signedIn
    .from('nannies')
    .update({ is_active: true })
    .eq('id', nannyId)
  assert.ok(publish.error)
  const ledger = await anonymous.from('payment_attempts').select('id')
  assert.ok(ledger.error)
  const settle = await anonymous.rpc('settle_booking_payment', {
    p_reference: reference,
    p_amount: 640000,
    p_currency: 'KES',
    p_channel: 'mobile_money',
    p_paid_at: new Date().toISOString(),
  })
  assert.ok(settle.error)
})

test('form writes cannot bypass server validation and rate limits through the Data API', async () => {
  const cases: [string, Record<string, unknown>][] = [
    [
      'contact_messages',
      { name: 'Local test', email: 'local@example.test', message: 'Test' },
    ],
    ['waitlist', { email: 'local@example.test' }],
    ['nanny_references', { application_id: applicationId, full_name: 'Local reference' }],
    [
      'nanny_documents',
      {
        application_id: applicationId,
        kind: 'id_front',
        storage_path: documentPath,
      },
    ],
    ['nanny_applications', { full_name: 'Local test', email: 'local@example.test' }],
  ]
  for (const client of [anonymous, signedIn]) {
    for (const [table, payload] of cases) {
      const result = await client.from(table).insert(payload)
      assert.equal(
        result.error?.code,
        '42501',
        `Client write access should be denied for ${table}`,
      )
    }
  }
})

test('actual PostgreSQL payment functions enforce acceptance, amount, idempotency and paid care', async () => {
  const booking = await admin
    .from('bookings')
    .insert({
      parent_id: userId,
      parent_name: 'Local sample family',
      email: 'local-family@example.test',
      destination: 'Diani',
      nanny_id: nannyId,
      check_in: date(10),
      check_out: date(12),
      total_amount_kes: 6400,
      nannies_needed: '1',
      children_count: '2',
      status: 'matched',
    })
    .select('id')
    .single()
  assert.ifError(booking.error)
  bookingId = booking.data!.id
  const beforeAcceptance = await admin.rpc('create_booking_payment', {
    p_booking_id: bookingId,
    p_reference: reference,
  })
  assert.match(beforeAcceptance.error?.message || '', /Accept the nanny match/)
  await applyBookingMutation(admin, bookingId, { action: 'accept' }, { id: userId })
  await applyBookingMutation(admin, bookingId, { action: 'confirm' }, { id: userId })
  const create = await admin.rpc('create_booking_payment', {
    p_booking_id: bookingId,
    p_reference: reference,
  })
  assert.ifError(create.error)
  assert.equal(create.data.amount_subunit, 640000)
  const repeat = await admin.rpc('create_booking_payment', {
    p_booking_id: bookingId,
    p_reference: `VN-${randomUUID()}`,
  })
  assert.ifError(repeat.error)
  assert.equal(repeat.data.reference, reference)
  const unpaidStart = await admin
    .from('bookings')
    .update({ status: 'in_progress' })
    .eq('id', bookingId)
  assert.match(unpaidStart.error?.message || '', /Payment is required/)
  const args = {
    p_reference: reference,
    p_amount: 640000,
    p_currency: 'KES',
    p_channel: 'mobile_money',
    p_paid_at: new Date().toISOString(),
  }
  const wrong = await admin.rpc('settle_booking_payment', {
    ...args,
    p_amount: 1,
  })
  assert.match(wrong.error?.message || '', /mismatch/)
  const settlements = await Promise.all([
    admin.rpc('settle_booking_payment', args),
    admin.rpc('settle_booking_payment', args),
  ])
  for (const settled of settlements) assert.ifError(settled.error)
  const paid = await admin
    .from('bookings')
    .select('payment_status')
    .eq('id', bookingId)
    .single()
  assert.ifError(paid.error)
  assert.equal(paid.data?.payment_status, 'paid')
  assert.ifError(
    (await admin.from('bookings').update({ status: 'in_progress' }).eq('id', bookingId))
      .error,
  )
  const ledger = await admin
    .from('payment_attempts')
    .select('id')
    .eq('booking_id', bookingId)
  assert.ifError(ledger.error)
  assert.equal(ledger.data?.length, 1)
})

test('real application routes save specialist enquiries, waitlist entries and secure guest bookings', async (context) => {
  localCli([
    'db',
    'query',
    "alter table public.bookings alter column payment_status set default 'not_required'",
  ])
  context.after(() => {
    localCli([
      'db',
      'query',
      "alter table public.bookings alter column payment_status set default 'unpaid'",
    ])
  })
  const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/dev-database.mts'], {
    cwd: root,
    env: {
      ...process.env,
      PAYSTACK_SECRET_KEY: '',
      PAYSTACK_WEBHOOK_SECRET: '',
      RESEND_API_KEY: '',
      EMAIL_DELIVERY_MODE: 'disabled',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.resume()
  child.stderr.resume()
  context.after(async () => {
    if (child.exitCode !== null) return
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve())
      child.kill('SIGTERM')
    })
  })
  const base = 'http://localhost:3102'
  let ready = false
  for (let attempt = 0; attempt < 240; attempt++) {
    if (child.exitCode !== null)
      throw new Error('The isolated app server stopped before becoming ready.')
    try {
      if ((await fetch(`${base}/api/health`)).ok) {
        ready = true
        break
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert.ok(ready, 'The local app server should become ready.')
  const email = `route-${randomUUID()}@example.test`
  let submittedApplication: string | undefined
  let uploadedEntries: Array<{ bucket: string; path: string }> = []
  try {
    const legacy = await admin
      .from('bookings')
      .insert({
        parent_name: 'Local legacy API test',
        email: `legacy-${email}`,
        destination: 'Diani',
        check_in: date(20),
        check_out: date(22),
      })
      .select('payment_status')
      .single()
    assert.ifError(legacy.error)
    assert.equal(legacy.data?.payment_status, 'not_required')
    const contact = await fetch(`${base}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Local test family',
        email,
        subject: 'Specialist care quote: Adult & Elderly Care',
        careService: 'Adult & Elderly Care',
        message: 'Local integration test enquiry.',
      }),
    })
    assert.equal(contact.status, 200)
    const waitlist = await fetch(`${base}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, region: 'Local test' }),
    })
    assert.equal(waitlist.status, 200)
    const booking = await fetch(`${base}/api/booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentName: 'Local test family',
        email,
        phone: '+254700000000',
        childrenCount: '2',
        destination: 'Diani',
        checkIn: date(20),
        checkOut: date(22),
        tier: 'bronze',
        careType: 'standard',
      }),
    })
    assert.equal(booking.status, 200)
    const saved = await booking.json()
    assert.match(saved.trackingPath, /^\/booking\/[^?]+\?token=[a-f0-9]{64}$/)
    const tracked = await fetch(`${base}${saved.trackingPath}`)
    assert.equal(tracked.status, 200)
    assert.equal(tracked.headers.get('referrer-policy'), 'no-referrer')
    const stored = await admin
      .from('bookings')
      .select('payment_status,guest_access_token_hash')
      .eq('email', email)
      .single()
    assert.ifError(stored.error)
    assert.equal(stored.data?.payment_status, 'unpaid')
    assert.ok(stored.data?.guest_access_token_hash)
    const messages = await admin
      .from('contact_messages')
      .select('subject')
      .eq('email', email)
      .single()
    assert.ifError(messages.error)
    assert.equal(messages.data?.subject, 'Specialist care quote: Adult & Elderly Care')
    const bytes = Buffer.from([255, 216, 255, 224, 0, 16, 0, 0])
    const payload = { ...completeApplication, email, submissionKey: randomUUID() }
    const prepared = await fetch(`${base}/api/apply/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload,
        files: ['photo', 'id_front', 'id_back', 'selfie'].map((key) => ({
          key,
          name: `${key}.jpg`,
          size: bytes.length,
        })),
      }),
    })
    assert.equal(prepared.status, 200)
    const staged = await prepared.json()
    uploadedEntries = staged.entries
    for (const entry of staged.entries) {
      const uploaded = await anonymous.storage
        .from(entry.bucket)
        .uploadToSignedUrl(entry.path, entry.token, bytes, { contentType: 'image/jpeg' })
      assert.ifError(uploaded.error)
    }
    const finalized = await fetch(`${base}/api/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest: staged.manifest }),
    })
    assert.equal(finalized.status, 200)
    submittedApplication = (await finalized.json()).id
    const savedDocuments = await admin
      .from('nanny_documents')
      .select('storage_path')
      .eq('application_id', submittedApplication!)
    assert.equal(savedDocuments.data?.length, 4)
    assert.ok(
      savedDocuments.data?.every((doc) =>
        doc.storage_path.startsWith('nanny-documents/'),
      ),
    )
    const privatePhoto = await anonymous.storage
      .from('nanny-documents')
      .download(staged.entries[0].path)
    assert.ok(privatePhoto.error)
  } finally {
    for (const entry of uploadedEntries)
      await admin.storage.from(entry.bucket).remove([entry.path])
    if (submittedApplication)
      await admin.from('nanny_applications').delete().eq('id', submittedApplication)
    await admin.from('bookings').delete().eq('email', email)
    await admin.from('bookings').delete().eq('email', `legacy-${email}`)
    await admin.from('contact_messages').delete().eq('email', email)
    await admin.from('waitlist').delete().eq('email', email)
  }
})
