// An isolated Supabase fixture: browser tests never read or mutate production data.
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { demoCatalog } from '../lib/catalog-data'

const reviewMode = process.argv.includes('--review')
const adminId = '33333333-3333-4333-8333-333333333333'
const parentId = '44444444-4444-4444-8444-444444444444'
const nannyUserId = '55555555-5555-4555-8555-555555555555'
const applicationId = '66666666-6666-4666-8666-666666666666'
const nannyId = '22222222-2222-4222-8222-222222222222'
const bookingId = '11111111-1111-4111-8111-111111111111'
const catalog = demoCatalog()
const created = new Date().toISOString()
const future = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
const user = {
  id: adminId,
  email: 'operator@example.test',
  role: 'authenticated',
  aud: 'authenticated',
  created_at: created,
  email_confirmed_at: created,
  confirmation_sent_at: created,
  app_metadata: { provider: 'email' },
  user_metadata: { full_name: 'Test Operator' },
}
const users = [
  user,
  {
    ...user,
    id: parentId,
    email: 'family@example.test',
    user_metadata: { full_name: 'Test Family' },
  },
  {
    ...user,
    id: nannyUserId,
    email: 'nanny@example.test',
    user_metadata: { full_name: 'Test Nanny' },
  },
]
const nanny = {
  id: nannyId,
  slug: 'test-nanny',
  display_name: 'Test Nanny',
  user_id: nannyUserId,
  application_id: null,
  tier: 'bronze',
  daily_rate_kes: 2200,
  is_active: true,
  photo_url: null,
  bio: 'An experienced childcare professional.',
  county: 'Kwale',
  town: 'Diani',
  destinations: ['Diani'],
  languages: ['English', 'Swahili'],
  tags: ['Creative play'],
  age_groups: ['3–5'],
  services: [],
  certifications: [],
  available_days: [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ],
  rating_avg: 0,
  review_count: 0,
  safeguarding_completed_at: null,
  willing_to_travel: 'local',
  created_at: created,
}
const booking = {
  id: bookingId,
  parent_id: parentId,
  parent_name: 'Test Family',
  email: 'family@example.test',
  phone: '+254700000000',
  nanny_id: nannyId,
  destination: 'Diani',
  check_in: future(28),
  check_out: future(30),
  children_count: '1',
  youngest_age: '3–5 years',
  nannies_needed: '1',
  tier: 'bronze',
  status: 'confirmed',
  care_type: 'standard',
  total_amount_kes: 4400,
  parent_confirmed_at: created,
  nanny_response: 'accepted',
  payment_status: 'unpaid',
  guest_access_token_hash: createHash('sha256').update('a'.repeat(64)).digest('hex'),
  created_at: created,
  nannies: nanny,
}
const tables: Record<string, unknown[]> = {
  profiles: users.map((identity, index) => ({
    id: identity.id,
    role: ['admin', 'parent', 'nanny'][index],
    full_name: identity.user_metadata.full_name,
    email: index === 1 ? 'unrelated@example.test' : identity.email,
    phone: null,
    avatar_url: null,
    created_at: created,
  })),
  nannies: [nanny],
  bookings: [
    {
      ...booking,
      booking_assignments: [
        { slot: 1, nanny_id: nannyId, response: 'accepted', nannies: nanny },
      ],
    },
  ],
  booking_assignments: [
    {
      booking_id: bookingId,
      slot: 1,
      nanny_id: nannyId,
      response: 'accepted',
      nannies: nanny,
    },
  ],
  booking_care_slots: [],
  workflow_jobs: [],
  ops_tasks: [
    {
      id: '99999999-9999-4999-8999-999999999999',
      kind: 'replacement_overdue',
      summary: 'Synthetic replacement deadline follow-up.',
      status: 'open',
      assigned_to: null,
      created_at: created,
      booking_id: bookingId,
    },
  ],
  nanny_applications: [
    {
      id: applicationId,
      user_id: null,
      full_name: 'Test Applicant',
      email: 'applicant.with.a.long.address.for.layout.review@example.test',
      phone: '+254700000000',
      country_code: '+254',
      date_of_birth: '1990-01-01',
      gender: 'Female',
      county: 'Kwale',
      town: 'Diani',
      national_id_number: null,
      kra_pin: null,
      cogc_status: 'yes',
      cogc_date: null,
      experience_years: '4',
      languages: ['English', 'Swahili'],
      age_groups: ['3–5'],
      services: ['Daytime care'],
      bio: 'Synthetic application for local layout review only.',
      certifications: ['First Aid'],
      swimming: 'Yes',
      cooking: 'Yes',
      tutoring: null,
      driving: null,
      special_needs: null,
      available_days: ['Monday', 'Tuesday'],
      earliest_start: '08:00',
      latest_end: '17:00',
      willing_to_travel: 'kenya',
      preferred_locations: ['Diani'],
      comfortable_pets: 'Yes',
      comfortable_multiple: 'Yes',
      status: 'reviewing',
      estimated_tier: 'silver',
      admin_notes: '',
      interview_at: null,
      consent_background: true,
      consent_terms: true,
      consent_accuracy: true,
      agreement_signed_path: null,
      agreement_reviewed_at: null,
      agreement_reviewed_by: null,
      approval_email_sent_at: null,
      created_at: created,
    },
  ],
  nanny_references: [
    {
      id: 'reference-test',
      application_id: applicationId,
      full_name: 'Test Reference',
      relationship: 'Former employer',
      phone: '+254700000000',
      email: 'reference@example.test',
      country_code: '+254',
      permission_to_contact: 'Yes',
      sort_order: 1,
    },
  ],
  nanny_documents: [],
  booking_messages: [
    {
      id: 'message-test',
      booking_id: bookingId,
      sender_id: parentId,
      sender_role: 'parent',
      body: 'Looking forward to our trip. Here are our arrival details for the family booking.',
      created_at: created,
    },
  ],
  reviews: [],
  contact_messages: [
    {
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Other Family',
      email: 'unrelated@example.test',
      family_id: null,
      subject: 'Private care',
      message: 'OTHER FAMILY PRIVATE CARE PLAN',
      care_service: 'Adult & Elderly Care',
      care_status: 'quoted',
      quote_summary: 'OTHER FAMILY PRIVATE CARE PLAN',
      quote_amount_kes: 9000,
      quote_expires_at: `${future(7)}T20:59:59Z`,
      quote_version: 1,
      guest_access_token_hash: createHash('sha256').update('e'.repeat(64)).digest('hex'),
      created_at: created,
    },
    {
      id: '88888888-8888-4888-8888-888888888888',
      name: 'Specialist Test Family',
      email: 'family@example.test',
      family_id: parentId,
      subject: 'Specialist care quote',
      message: 'Synthetic specialist care enquiry.',
      care_service: 'Professional Nursing Care',
      care_status: 'quoted',
      assigned_to: adminId,
      assessment_notes: 'PRIVATE ASSESSMENT MUST NEVER APPEAR TO FAMILY',
      provider_details: 'PRIVATE PROVIDER VERIFICATION RECORD',
      quote_summary: 'Qualified nursing support with an agreed daytime care schedule.',
      quote_amount_kes: 6000,
      quote_expires_at: `${future(7)}T20:59:59Z`,
      service_start: future(14),
      service_end: future(15),
      quote_version: 1,
      guest_access_token_hash: createHash('sha256').update('d'.repeat(64)).digest('hex'),
      created_at: created,
    },
    {
      id: 'contact-test',
      name: 'Test Enquiry',
      email: 'family.with.a.long.address.for.layout.review@example.test',
      subject: 'A family trip with additional childcare requirements',
      message: 'Synthetic enquiry for local layout review only.',
      created_at: created,
    },
  ],
  waitlist: [
    {
      id: 'waitlist-test',
      email: 'waitlist@example.test',
      region: 'Zanzibar',
      created_at: created,
    },
  ],
  payment_attempts: [
    {
      id: 'payment-test',
      booking_id: bookingId,
      reference: 'VN-77777777-7777-4777-8777-777777777777',
      amount_subunit: 440000,
      currency: 'KES',
      status: 'pending',
      channel: null,
      authorization_url: null,
      created_at: created,
    },
  ],
  destinations: [
    {
      id: 'diani',
      slug: 'diani',
      name: 'Diani',
      country: 'Kenya',
      is_active: true,
      sort_order: 0,
      image_url: null,
    },
  ],
  pricing_tiers: catalog.tiers.map((t) => ({
    code: t.code,
    label: t.label,
    card_title: t.cardTitle,
    badge: t.badge,
    description: t.description,
    period: t.period,
    daily_rate_kes: t.dailyRateKes,
    features: t.features,
    cta: t.cta,
    sort_order: t.sortOrder,
    is_active: true,
  })),
  care_offerings: catalog.care.map((c) => ({
    code: c.code,
    label: c.label,
    hours: c.hours,
    multiplier: c.multiplier,
    hint: c.hint,
    sort_order: c.sortOrder,
    is_active: true,
  })),
  pricing_addons: catalog.addons.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    description: a.description,
    pricing_mode: a.pricingMode,
    amount_kes: a.amountKes,
    is_active: true,
  })),
  business_policies: [
    {
      id: 1,
      standard_shift_hours: 8,
      replacement_sla_hours: 2,
      max_nannies: 4,
    },
  ],
  faqs: catalog.faqs.map((f) => ({
    id: f.id,
    question: f.question,
    answer: f.answer,
    is_active: true,
    sort_order: f.sortOrder,
  })),
  homepage_steps: [],
}
function fixtureSession(identity = user) {
  const payload = {
    sub: identity.id,
    aud: 'authenticated',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  const token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'fixture-signature',
  ].join('.')
  return {
    access_token: token,
    refresh_token: 'fixture-refresh-token',
    expires_at: payload.exp,
    expires_in: 3600,
    token_type: 'bearer',
    user: identity,
  }
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1:4748')
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') {
    res.end()
    return
  }
  if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
    let body = ''
    for await (const chunk of req) body += chunk.toString()
    let credentials
    try {
      credentials = JSON.parse(body)
    } catch {
      res.statusCode = 400
      res.end('{}')
      return
    }
    const identity = users.find((candidate) => candidate.email === credentials.email)
    if (!identity || credentials.password !== 'local-review') {
      res.statusCode = 400
      res.end(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
      )
      return
    }
    res.end(JSON.stringify(fixtureSession(identity)))
    return
  }
  if (url.pathname === '/auth/v1/user') {
    try {
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '')
      const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
      const identity = users.find((candidate) => candidate.id === claims.sub)
      if (!identity) throw new Error('Unknown local fixture user')
      res.end(JSON.stringify(identity))
    } catch {
      res.statusCode = 401
      res.end(JSON.stringify({ message: 'No fixture session' }))
    }
    return
  }
  if (url.pathname === '/auth/v1/admin/users') {
    res.end(JSON.stringify({ users, aud: 'authenticated' }))
    return
  }
  if (url.pathname === '/rest/v1/rpc/consume_rate_limit') {
    res.end('true')
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    res.end(
      JSON.stringify({
        message: 'Writes are disabled in browser test fixtures.',
      }),
    )
    return
  }
  const table = url.pathname.split('/').at(-1) || ''
  let rows = tables[table] || []
  for (const [key, value] of url.searchParams) {
    if (value.startsWith('eq.'))
      rows = rows.filter(
        (row) => String((row as Record<string, unknown>)[key]) === value.slice(3),
      )
    if (value === 'is.null')
      rows = rows.filter((row) => (row as Record<string, unknown>)[key] == null)
    if (value === 'not.is.null')
      rows = rows.filter((row) => (row as Record<string, unknown>)[key] != null)
    if (value.startsWith('ilike.')) {
      // The app uses ilike for exact, escaped email matching.
      const expected = value
        .slice(6)
        .replace(/\\([\\%_])/g, '$1')
        .toLowerCase()
      rows = rows.filter(
        (row) =>
          String((row as Record<string, unknown>)[key] ?? '').toLowerCase() === expected,
      )
    }
    if (value.startsWith('in.'))
      rows = rows.filter((row) =>
        value
          .slice(4, -1)
          .split(',')
          .includes(String((row as Record<string, unknown>)[key])),
      )
  }
  res.setHeader('Content-Range', `0-${Math.max(rows.length - 1, 0)}/${rows.length}`)
  res.end(
    JSON.stringify(
      req.headers.accept?.includes('vnd.pgrst.object') ? rows[0] || null : rows,
    ),
  )
})
server.listen(4748, '127.0.0.1', () => {
  const child = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3101',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:4748',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3101',
        PAYSTACK_SECRET_KEY: '',
        PAYSTACK_WEBHOOK_SECRET: '',
        RESEND_API_KEY: '',
        EMAIL_DELIVERY_MODE: 'disabled',
        CRON_SECRET: '',
        VACAYNANNY_TEST_DIST: '.next-tests',
      },
    },
  )
  if (reviewMode) {
    console.log('Isolated UI review: http://localhost:3101')
    console.log('Operations: http://localhost:3101/login?next=/admin')
    console.log('Fixture login: operator@example.test / local-review')
    console.log(
      'Uses local sample data. Database writes, email and payments are disabled.',
    )
  }
  const close = () => {
    child.kill('SIGTERM')
    server.close()
    setTimeout(() => process.exit(), 1000).unref()
  }
  process.on('SIGTERM', close)
  process.on('SIGINT', close)
  child.on('exit', () => {
    server.close()
    process.exit()
  })
})
