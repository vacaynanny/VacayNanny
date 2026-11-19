import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { emailSettings } from '../lib/email-settings'
import { sendEmail } from '../lib/email-delivery'
import { authorizedCron } from '../lib/cron-auth'
import { checkSetup } from '../lib/setup-checks'

test('local development and Vercel previews disable email unless explicitly enabled', () => {
  assert.equal(emailSettings({ NODE_ENV: 'development' }).mode, 'disabled')
  assert.equal(
    emailSettings({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }).mode,
    'disabled',
  )
  assert.equal(
    emailSettings({ NODE_ENV: 'production', VERCEL_ENV: 'production' }).mode,
    'send',
  )
  assert.equal(
    emailSettings({ NODE_ENV: 'production', EMAIL_DELIVERY_MODE: 'disabled' })
      .mode,
    'disabled',
  )
  assert.equal(
    emailSettings({ NODE_ENV: 'development', EMAIL_DELIVERY_MODE: 'send' })
      .mode,
    'send',
  )
})

test('disabled delivery never calls the email provider, even when a key exists', async () => {
  const previous = {
    mode: process.env.EMAIL_DELIVERY_MODE,
    key: process.env.RESEND_API_KEY,
  }
  process.env.EMAIL_DELIVERY_MODE = 'disabled'
  process.env.RESEND_API_KEY = 're_fixture'
  const fetch = mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected provider request')
  })
  try {
    const result = await sendEmail({
      to: 'sample@example.test',
      subject: 'Preview',
      html: '<p>Preview</p>',
    })
    assert.equal(result.skipped, true)
    assert.equal(result.error, null)
    assert.equal(fetch.mock.callCount(), 0)
  } finally {
    fetch.mock.restore()
    if (previous.mode === undefined) delete process.env.EMAIL_DELIVERY_MODE
    else process.env.EMAIL_DELIVERY_MODE = previous.mode
    if (previous.key === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = previous.key
  }
})

test('email addresses can be configured for verified senders and replies', () => {
  const settings = emailSettings({
    RESEND_FROM_EMAIL: ' VacayNanny <care@example.test> ',
    RESEND_REPLY_TO_EMAIL: ' replies@example.test ',
  })
  assert.equal(settings.from, 'VacayNanny <care@example.test>')
  assert.equal(settings.replyTo, 'replies@example.test')
})

test('cron requires the exact bearer secret and rejects missing or incorrect credentials', () => {
  const secret = 'private-fixture-secret'
  assert.equal(authorizedCron(`Bearer ${secret}`, secret), true)
  for (const supplied of [
    null,
    '',
    secret,
    `bearer ${secret}`,
    `Bearer ${secret} `,
    'Bearer wrong-secret',
  ]) {
    assert.equal(authorizedCron(supplied, secret), false)
  }
  assert.equal(authorizedCron('Bearer undefined', undefined), false)
})

test('production setup reports blocked configuration without exposing credentials', () => {
  const secret = 'sk_test_never_print_this_key'
  const checks = checkSetup(
    {
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      PAYSTACK_SECRET_KEY: secret,
      EMAIL_DELIVERY_MODE: 'disabled',
      RESEND_API_KEY: 're_never_print_this_key',
    },
    'production',
  )
  assert.equal(checks.find((c) => c.name === 'Site URL')?.status, 'invalid')
  assert.equal(checks.find((c) => c.name === 'Paystack')?.status, 'invalid')
  assert.equal(
    checks.find((c) => c.name === 'Email delivery')?.status,
    'pending',
  )
  assert.equal(checks.find((c) => c.name === 'Supabase')?.status, 'pending')
  assert.ok(!JSON.stringify(checks).includes('never_print_this_key'))
})

test('staging accepts test credentials but rejects unsafe origins and malformed addresses', () => {
  const checks = checkSetup(
    {
      NEXT_PUBLIC_SITE_URL: 'https://preview.example.test',
      CRON_SECRET: 'a'.repeat(64),
      PAYSTACK_SECRET_KEY: 'sk_test_fixture',
      PAYSTACK_WEBHOOK_SECRET: 'whsec_fixture',
      EMAIL_DELIVERY_MODE: 'disabled',
      NANNY_AGREEMENT_STORAGE_PATH: 'agreements/final.pdf',
    },
    'staging',
  )
  assert.deepEqual(
    checks.filter((c) => c.name !== 'Supabase').map((c) => c.status),
    Array(7).fill('ready'),
  )
  for (const origin of [
    'https://localhost',
    'https://user:password@example.test',
    'https://example.test/path',
    'https://example.test?secret=1',
    'https://localhost',
  ]) {
    assert.equal(
      checkSetup({ NEXT_PUBLIC_SITE_URL: origin }, 'staging')[0].status,
      'invalid',
    )
  }
  assert.equal(
    checkSetup({ RESEND_REPLY_TO_EMAIL: 'invalid' }).find(
      (c) => c.name === 'Email addresses',
    )?.status,
    'invalid',
  )
})

test('cron reports database read failures instead of treating them as zero due bookings', async () => {
  const { advanceDueBookings } = await import('../lib/booking-ops')
  const db = {
    from: () => ({
      select: () => ({
        in: async () => ({
          data: null,
          error: { message: 'Fixture unavailable' },
        }),
      }),
    }),
  }
  const logger = mock.method(console, 'error', () => {})
  try {
    await assert.rejects(
      advanceDueBookings(
        db as unknown as import('@supabase/supabase-js').SupabaseClient,
        { strict: true },
      ),
      /Could not load due bookings/,
    )
    assert.equal(
      await advanceDueBookings(
        db as unknown as import('@supabase/supabase-js').SupabaseClient,
      ),
      0,
    )
  } finally {
    logger.mock.restore()
  }
})

test('matching an email address grants booking access only after ownership is proven', async () => {
  const { emailOwnershipProven, profileOwnsBooking } = await import(
    '../lib/booking-ownership'
  )
  const identity = {
    id: 'family',
    email: 'family@example.test',
    created_at: '2026-11-18',
    email_confirmed_at: '2026-11-18',
    app_metadata: { provider: 'email' },
  }
  assert.equal(emailOwnershipProven(identity), false)
  assert.equal(
    emailOwnershipProven({ ...identity, confirmation_sent_at: '2026-11-18' }),
    true,
  )
  const guest = { parent_id: null, email: 'FAMILY@example.test' }
  const profile = { id: 'family', email: identity.email, emailConfirmed: false }
  assert.equal(profileOwnsBooking(profile, guest), false)
  assert.equal(
    profileOwnsBooking({ ...profile, emailConfirmed: true }, guest),
    true,
  )
  assert.equal(
    profileOwnsBooking(
      { ...profile, emailConfirmed: true },
      { ...guest, email: 'another@example.test' },
    ),
    false,
  )
  assert.equal(
    profileOwnsBooking(profile, { ...guest, parent_id: 'family' }),
    true,
  )
})
