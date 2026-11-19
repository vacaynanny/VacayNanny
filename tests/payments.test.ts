import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import {
  kesToSubunits,
  paymentMatches,
  verifyWebhook,
} from '../lib/payment-rules'
import { createGuestAccess, validGuestToken } from '../lib/guest-access'
import {
  applicationApprovedTemplate,
  applicationReceivedTemplate,
} from '../lib/application-email-templates'
import { dueBookingStatus } from '../lib/booking'

test('KES conversion preserves cents and rejects unsafe or invalid amounts', () => {
  assert.equal(kesToSubunits(2200), 220000)
  assert.equal(kesToSubunits(3200.15), 320015)
  for (const amount of [0, -1, 2.99, NaN, Infinity, Number.MAX_SAFE_INTEGER])
    assert.throws(() => kesToSubunits(amount))
})
test('a success must match the exact reference, amount and KES currency', () => {
  const attempt = {
    reference: 'VN-test',
    amount_subunit: 220000,
    currency: 'KES',
  }
  const transaction = {
    reference: 'VN-test',
    amount: 220000,
    currency: 'KES',
    status: 'success',
  }
  assert.ok(paymentMatches(attempt, transaction))
  for (const changed of [
    { amount: 2200 },
    { amount: '220000' },
    { currency: 'USD' },
    { reference: 'another' },
    { status: 'pending' },
  ])
    assert.equal(paymentMatches(attempt, { ...transaction, ...changed }), false)
})
test('legacy webhook signatures authenticate the raw bytes', () => {
  const raw = Buffer.from('{"event":"charge.success", "amount":1.50}')
  const headers = new Headers({
    'x-paystack-signature': createHmac('sha512', 'sk_test')
      .update(raw)
      .digest('hex'),
  })
  assert.ok(verifyWebhook(raw, headers, 'sk_test'))
  assert.equal(
    verifyWebhook(
      Buffer.from(JSON.stringify(JSON.parse(raw.toString()))),
      headers,
      'sk_test',
    ),
    false,
  )
  assert.equal(
    verifyWebhook(
      raw,
      new Headers({ 'x-paystack-signature': 'abc' }),
      'sk_test',
    ),
    false,
  )
  assert.equal(verifyWebhook(raw, headers, 'wrong'), false)
})
test('timestamped webhooks support rotation and reject replay and downgrade', () => {
  const raw = Buffer.from('{"event":"charge.success"}')
  const now = 1800000000
  const signature = createHmac('sha512', 'whsec_new')
    .update(`${now}.`)
    .update(raw)
    .digest('hex')
  const headers = new Headers({
    'paystack-signature': `t=${now},v1=whk_old:${'0'.repeat(128)},v1=whk_new:${signature}`,
  })
  assert.ok(verifyWebhook(raw, headers, 'sk_test', 'whsec_new', now))
  assert.equal(
    verifyWebhook(raw, headers, 'sk_test', 'whsec_new', now + 301),
    false,
  )
  assert.equal(verifyWebhook(raw, headers, 'sk_test', 'wrong', now), false)
  headers.set('paystack-signature', `t=${now},t=${now},v1=whk_new:${signature}`)
  assert.equal(verifyWebhook(raw, headers, 'sk_test', 'whsec_new', now), false)
  const legacy = new Headers({
    'x-paystack-signature': createHmac('sha512', 'sk_test')
      .update(raw)
      .digest('hex'),
  })
  assert.equal(verifyWebhook(raw, legacy, 'sk_test', 'whsec_new', now), false)
})
test('guest tokens are random, hashed, and restricted to their own booking', () => {
  const first = createGuestAccess(),
    second = createGuestAccess()
  assert.notEqual(first.token, second.token)
  assert.notEqual(first.token, first.hash)
  assert.ok(validGuestToken(first.token, first.hash))
  assert.equal(validGuestToken(second.token, first.hash), false)
  for (const invalid of [null, undefined, '', first.hash, 'abc'])
    assert.equal(validGuestToken(invalid, first.hash), false)
})
test('application receipts use the supplied copy without approval or turnaround promises', () => {
  const email = applicationReceivedTemplate('<script>name</script>')
  assert.ok(
    email.text.includes(
      'does not automatically mean that your profile has been approved',
    ),
  )
  assert.ok(email.html.includes('&lt;script&gt;name&lt;/script&gt;'))
  assert.ok(!email.html.includes('<script>'))
  assert.ok(!email.text.includes('3–5'))
})
test('approval asks for a signed agreement before activation', () => {
  const email = applicationApprovedTemplate('Amina')
  assert.ok(email.text.includes('Attached to this email'))
  assert.ok(email.html.includes('<strong>Attached to this email'))
  assert.ok(email.html.includes('<strong>The VacayNanny Team</strong>'))
  assert.ok(
    email.text.includes('Once we receive and review your signed agreement'),
  )
  assert.ok(!email.text.includes('Your profile is live'))
})
test('unpaid placements never start or complete automatically', () => {
  const booking = {
    status: 'confirmed' as const,
    check_in: '2026-01-01',
    check_out: '2026-01-02',
  }
  const now = new Date('2026-01-03T00:00:00Z')
  assert.equal(
    dueBookingStatus({ ...booking, payment_status: 'unpaid' }, now),
    null,
  )
  assert.equal(
    dueBookingStatus({ ...booking, payment_status: 'paid' }, now),
    'completed',
  )
  assert.equal(
    dueBookingStatus({ ...booking, payment_status: 'not_required' }, now),
    'completed',
  )
})
