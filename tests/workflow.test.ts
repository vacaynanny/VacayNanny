import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { validateApplication } from '../lib/application-validation'
import { validateCareDates, nannyWorksDates } from '../lib/booking-validation'
import { scoreNannyMatch } from '../lib/match'
import { FALLBACK_NANNIES } from '../lib/data'
import { emailOwnershipProven, profileOwnsBooking } from '../lib/booking-ownership'

import { completeApplication } from './fixtures/application'

const requiredFiles = ['photo', 'id_front', 'id_back', 'selfie']
test('a complete adult application is valid; a name/email-only submission is rejected', () => {
  assert.deepEqual(validateApplication(completeApplication, requiredFiles), [])
  assert.ok(
    validateApplication({ fullName: 'Applicant', email: 'a@example.test' }, []).length >
      5,
  )
})
test('missing identity files, a child applicant, string consents and duplicate references are rejected', () => {
  for (const changes of [
    { dateOfBirth: '2020-01-01' },
    { dateOfBirth: '1990-02-31' },
    { consentTerms: 'true' },
    { ref2Phone: completeApplication.ref1Phone },
  ])
    assert.ok(
      validateApplication({ ...completeApplication, ...changes }, requiredFiles).length,
    )
  assert.ok(validateApplication(completeApplication, requiredFiles.slice(1)).length)
  assert.ok(
    validateApplication(
      { ...completeApplication, cogcStatus: 'yes' },
      requiredFiles,
    ).some((e) => e.includes('clearance')),
  )
})
test('care dates reject impossible, reversed, past and unbounded requests', () => {
  for (const [start, end] of [
    ['2027-02-30', '2027-03-02'],
    ['2027-06-12', '2027-06-10'],
    ['2020-01-01', '2020-01-03'],
    ['2027-01-01', '2029-01-01'],
  ])
    assert.ok(validateCareDates(start, end))
  assert.equal(validateCareDates('2027-06-10', '2027-06-10'), null)
})
test('matching enforces weekdays, suspension, infant experience and child capacity', () => {
  const nanny = {
    ...FALLBACK_NANNIES[5],
    destinations: ['Diani'],
    available_days: ['Thursday', 'Friday', 'Saturday', 'Sunday'],
    tier: 'bronze' as const,
  }
  const request = {
    destination: 'Diani',
    checkIn: '2027-06-10',
    checkOut: '2027-06-12',
    childrenCount: '2',
    nanniesNeeded: '1',
  }
  assert.equal(scoreNannyMatch(nanny, request, []).eligible, true)
  assert.equal(
    scoreNannyMatch({ ...nanny, available_days: [] }, request, []).eligible,
    false,
  )
  assert.equal(
    scoreNannyMatch({ ...nanny, is_suspended: true }, request, []).eligible,
    false,
  )
  assert.equal(
    scoreNannyMatch(nanny, { ...request, childrenCount: '3' }, []).eligible,
    false,
  )
  assert.equal(
    scoreNannyMatch(nanny, { ...request, infantRequired: true }, []).eligible,
    false,
  )
  assert.equal(nannyWorksDates(nanny, '2027-06-10', '2027-06-11'), true)
})
test('an account email never overrides another account ownership; disabled confirmation is not proof', () => {
  const profile = { id: 'account-a', email: 'family@example.test', emailConfirmed: true }
  assert.equal(
    profileOwnsBooking(profile, { parent_id: 'account-b', email: 'family@example.test' }),
    false,
  )
  assert.equal(
    profileOwnsBooking(profile, { parent_id: null, email: 'family@example.test' }),
    true,
  )
  assert.equal(
    emailOwnershipProven({
      id: 'account-a',
      email: 'family@example.test',
      created_at: '2026-11-19',
      email_confirmed_at: '2026-11-19',
      app_metadata: { provider: 'email' },
    }),
    false,
  )
})

const originalFetch = globalThis.fetch
const envNames = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'EMAIL_DELIVERY_MODE',
] as const
const envBefore = Object.fromEntries(envNames.map((key) => [key, process.env[key]]))
after(() => {
  globalThis.fetch = originalFetch
  for (const key of envNames) {
    if (envBefore[key] === undefined) delete process.env[key]
    else process.env[key] = envBefore[key]
  }
})
async function submitFixture(failure: 'upload' | 'database' | 'ambiguous' | null) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://workflow-fixture.invalid'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-server'
  process.env.EMAIL_DELIVERY_MODE = 'disabled'
  let uploads = 0,
    cleanups = 0,
    commits = 0
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    )
    assert.equal(
      url.hostname,
      'workflow-fixture.invalid',
      'test must never contact a hosted project',
    )
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    if (url.pathname.endsWith('/consume_rate_limit')) return json(true)
    if (url.pathname.endsWith('/enqueue_workflow_job'))
      return json('11111111-1111-4111-8111-111111111111')
    if (url.pathname.endsWith('/workflow_jobs')) return json(null)
    if (url.pathname.startsWith('/storage/v1/object/')) {
      if (init?.method === 'DELETE') {
        cleanups++
        return json([])
      }
      uploads++
      return failure === 'upload' && uploads === 2
        ? json({ message: 'Synthetic upload failure' }, 500)
        : json({ Key: 'test' })
    }
    if (url.pathname.endsWith('/save_complete_application')) {
      commits++
      const body = JSON.parse(String(init?.body))
      if (failure === 'ambiguous')
        return json({ message: 'Synthetic timeout', code: 'PGRST003' }, 504)
      return failure === 'database'
        ? json({ message: 'Synthetic transaction failure', code: '23514' }, 400)
        : json({ id: body.p_row.id })
    }
    throw new Error(`Unexpected fixture endpoint ${url.pathname}`)
  }
  const form = new FormData()
  form.set('payload', JSON.stringify(completeApplication))
  for (const kind of requiredFiles)
    form.set(
      kind,
      new File([new Uint8Array([255, 216, 255, 224, 0, 16, 0, 0])], `${kind}.jpg`, {
        type: 'image/jpeg',
      }),
    )
  const { NextRequest } = await import('next/server')
  const { POST } = await import('../app/api/apply/route')
  const response = await POST(
    new NextRequest('http://localhost/api/apply', { method: 'POST', body: form }),
  )
  return {
    status: response.status,
    result: await response.json(),
    uploads,
    cleanups,
    commits,
  }
}
test('upload failure cannot report success and cleans up files already uploaded', async () => {
  const result = await submitFixture('upload')
  assert.equal(result.status, 500)
  assert.equal(result.commits, 0)
  assert.equal(result.cleanups, 1)
  assert.notEqual(result.result.success, true)
})
test('reference/document transaction failure rolls back submission and cleans every staged file', async () => {
  const result = await submitFixture('database')
  assert.equal(result.status, 500)
  assert.equal(result.commits, 1)
  assert.equal(result.cleanups, 4)
})
test('successful complete application commits once without removing its files', async () => {
  const result = await submitFixture(null)
  assert.equal(result.status, 200)
  assert.equal(result.commits, 1)
  assert.equal(result.cleanups, 0)
  assert.equal(result.result.success, true)
})

test('an ambiguous database timeout preserves staged files for reconciliation', async () => {
  const result = await submitFixture('ambiguous')
  assert.equal(result.status, 500)
  assert.equal(result.commits, 1)
  assert.equal(result.cleanups, 0)
})
