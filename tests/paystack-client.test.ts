import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  initializePayment,
  reconcilePayment,
  type PaymentAttempt,
} from '../lib/paystack'

const attempt = {
  id: 'attempt',
  booking_id: 'booking',
  reference: 'VN-test',
  amount_subunit: 640000,
  currency: 'KES',
  status: 'pending',
  authorization_url: null,
  channel: null,
  paid_at: null,
  created_at: new Date().toISOString(),
} satisfies PaymentAttempt
function database(
  row: PaymentAttempt & { initialize?: boolean } = {
    ...attempt,
    initialize: true,
  },
) {
  const calls: Array<{ name: string; args: unknown }> = []
  const db = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args })
      return { data: row, error: null }
    },
    from: () => ({
      update: (args: unknown) => ({
        eq: async () => {
          calls.push({ name: 'update', args })
          return { error: null }
        },
      }),
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
      }),
    }),
  }
  return { client: db as unknown as SupabaseClient, calls }
}

test('checkout sends the stored total in KES and enables card and M-Pesa channels', async () => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_fixture'
  const db = database()
  const fetch = mock.method(
    globalThis,
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(input, 'https://api.paystack.co/transaction/initialize')
      const body = JSON.parse(String(init?.body))
      assert.equal(body.amount, 640000)
      assert.equal(body.currency, 'KES')
      assert.deepEqual(body.channels, ['card', 'mobile_money'])
      assert.equal(body.reference, 'VN-test')
      assert.equal(body.email, 'family@example.test')
      return Response.json({
        status: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/test',
          reference: 'VN-test',
        },
      })
    },
  )
  try {
    assert.equal(
      (await initializePayment(db.client, 'booking', 'family@example.test'))
        .authorization_url,
      'https://checkout.paystack.com/test',
    )
  } finally {
    fetch.mock.restore()
  }
})

test('duplicate in-flight initialization never creates a second provider request', async () => {
  const db = database({ ...attempt, initialize: false })
  const fetch = mock.method(
    globalThis,
    'fetch',
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      assert.ok(!init?.method || init.method === 'GET')
      return Response.json({ status: true, data: { status: 'pending' } })
    },
  )
  try {
    await assert.rejects(
      initializePayment(db.client, 'booking', 'family@example.test'),
      /still being prepared/,
    )
    assert.equal(fetch.mock.callCount(), 1)
  } finally {
    fetch.mock.restore()
  }
})

test('successful provider responses with the wrong amount cannot mark the booking paid', async () => {
  const db = database()
  const fetch = mock.method(globalThis, 'fetch', async () =>
    Response.json({
      status: true,
      data: {
        status: 'success',
        reference: 'VN-test',
        amount: 1,
        currency: 'KES',
      },
    }),
  )
  try {
    await assert.rejects(reconcilePayment(db.client, 'VN-test'), /mismatch/)
    assert.equal(db.calls.length, 0)
  } finally {
    fetch.mock.restore()
  }
})

test('verified success persists through the atomic settlement RPC', async () => {
  const db = database()
  const fetch = mock.method(globalThis, 'fetch', async () =>
    Response.json({
      status: true,
      data: {
        status: 'success',
        reference: 'VN-test',
        amount: 640000,
        currency: 'KES',
        channel: 'mobile_money',
        paid_at: '2026-11-18T10:00:00Z',
      },
    }),
  )
  try {
    assert.equal(
      (await reconcilePayment(db.client, 'VN-test')).status,
      'success',
    )
    assert.equal(db.calls[0].name, 'settle_booking_payment')
  } finally {
    fetch.mock.restore()
  }
})

test('pending payments stay pending and previously settled payments are idempotent', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () =>
    Response.json({ status: true, data: { status: 'pending' } }),
  )
  try {
    const db = database()
    assert.equal(
      (await reconcilePayment(db.client, 'VN-test')).status,
      'pending',
    )
    assert.equal(db.calls.length, 0)
    const settled = database({ ...attempt, status: 'success' })
    assert.equal(
      (await reconcilePayment(settled.client, 'VN-test')).status,
      'success',
    )
    assert.equal(fetch.mock.callCount(), 1)
  } finally {
    fetch.mock.restore()
  }
})
