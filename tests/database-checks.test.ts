import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { checkDatabase } from '../lib/database-checks'

test('database readiness uses only read requests and downloads zero records', async () => {
  const calls: URL[] = []
  const fetch = mock.method(
    globalThis,
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      )
      calls.push(url)
      assert.ok(!init?.method || init.method === 'GET')
      if (url.pathname === '/rest/v1/')
        return Response.json({
          paths: {
            '/rpc/create_booking_payment': {},
            '/rpc/settle_booking_payment': {},
            ...Object.fromEntries(
              [
                'commit_booking_mutation',
                'save_complete_application',
                'claim_nanny_applications',
                'update_care_enquiry',
                'accept_care_quote',
                'claim_workflow_jobs',
                'run_workflow_automation',
              ].map((name) => [`/rpc/${name}`, {}]),
            ),
          },
        })
      assert.equal(url.searchParams.get('limit'), '0')
      return Response.json([])
    },
  )
  try {
    const checks = await checkDatabase({
      NEXT_PUBLIC_SUPABASE_URL: 'https://database.example.test',
      SUPABASE_SERVICE_ROLE_KEY: 'fixture-server-key',
    })
    assert.ok(checks.every((check) => check.status === 'ready'))
    assert.ok(calls.length >= 4)
    assert.ok(!calls.some((url) => url.pathname.includes('/rpc/')))
  } finally {
    fetch.mock.restore()
  }
})

test('missing migrations stay pending without leaking provider errors or keys', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () =>
    Response.json({ message: 'private-provider-message' }, { status: 404 }),
  )
  try {
    const checks = await checkDatabase({
      NEXT_PUBLIC_SUPABASE_URL: 'https://database.example.test',
      SUPABASE_SERVICE_ROLE_KEY: 'fixture-secret-never-print',
    })
    assert.ok(checks.every((check) => check.status === 'pending'))
    assert.ok(!JSON.stringify(checks).includes('private-provider-message'))
    assert.ok(!JSON.stringify(checks).includes('fixture-secret-never-print'))
  } finally {
    fetch.mock.restore()
  }
})
