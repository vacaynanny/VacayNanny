import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { sendEmail, deliverEmail, withNotificationContext } from '../lib/email-delivery'
import { openWorkflow, sealWorkflow } from '../lib/workflow-secrets'
const originalFetch = globalThis.fetch
const keys = [
  'EMAIL_DELIVERY_MODE',
  'RESEND_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NOTIFICATION_ENCRYPTION_KEY',
] as const
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
after(() => {
  globalThis.fetch = originalFetch
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key]
    else process.env[key] = previous[key]
  }
})
test('queued email encrypts private booking links and uses stable recipient deduplication', async () => {
  process.env.EMAIL_DELIVERY_MODE = 'send'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://notification-fixture.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-local-key'
  process.env.NOTIFICATION_ENCRYPTION_KEY = 'synthetic-stable-encryption-key'
  const jobs: Array<{
    p_payload: { sealed: Parameters<typeof openWorkflow>[0] }
    p_key: string
  }> = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    assert.match(
      url,
      /^https:\/\/notification-fixture\.invalid\/rest\/v1\/rpc\/enqueue_workflow_job/,
    )
    jobs.push(JSON.parse(String(init?.body)))
    return new Response(JSON.stringify('11111111-1111-4111-8111-111111111111'), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const message = {
    to: 'family@example.test',
    subject: 'Booking confirmation',
    html: '<p>Private</p>',
    text: 'https://example.test/booking/test?token=PRIVATE_TEST_TOKEN',
  }
  await withNotificationContext('domain-job-one', () => sendEmail(message))
  await withNotificationContext('domain-job-one', () => sendEmail(message))
  assert.equal(jobs[0].p_key, jobs[1].p_key)
  assert.equal(JSON.stringify(jobs[0]).includes('PRIVATE_TEST_TOKEN'), false)
  assert.deepEqual(openWorkflow(jobs[0].p_payload.sealed), message)
  const broken = {
    ...jobs[0].p_payload.sealed,
    data: Buffer.from('tampered').toString('base64'),
  }
  assert.throws(() => openWorkflow(broken))
  assert.notDeepEqual(sealWorkflow(message), sealWorkflow(message))
})
test('provider failures are retryable and repeated sends use the same provider idempotency key', async () => {
  process.env.EMAIL_DELIVERY_MODE = 'send'
  process.env.RESEND_API_KEY = 're_synthetic_never_real'
  const idempotency: string[] = []
  let attempts = 0
  globalThis.fetch = async (input, init) => {
    assert.equal(new URL(String(input)).hostname, 'api.resend.com')
    idempotency.push(new Headers(init?.headers).get('idempotency-key') || '')
    attempts++
    return new Response(
      JSON.stringify(
        attempts === 1
          ? { name: 'application_error', message: 'Synthetic provider failure' }
          : { id: 'synthetic-email-id' },
      ),
      {
        status: attempts === 1 ? 500 : 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
  const message = {
    to: 'family@example.test',
    subject: 'Synthetic retry',
    html: '<p>Test</p>',
  }
  await assert.rejects(deliverEmail(message, 'stable-job-id'), /did not accept/)
  await deliverEmail(message, 'stable-job-id')
  assert.deepEqual(idempotency, ['stable-job-id', 'stable-job-id'])
})
