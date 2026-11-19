import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const bookingId = '11111111-1111-4111-8111-111111111111'
const nannyId = '22222222-2222-4222-8222-222222222222'
const adminId = '33333333-3333-4333-8333-333333333333'
let legacyStatus: string | undefined
let oldApiStatus: string | undefined
const appId = '44444444-4444-4444-8444-444444444444'
before(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create function auth.role() returns text language sql as $$select coalesce(current_setting('request.jwt.claim.role',true),current_user)::text$$;
    create function public.set_updated_at() returns trigger language plpgsql as $$begin return new;end$$;
    create table profiles(id uuid primary key,role text);
    create table nanny_applications(id uuid primary key,status text);
    create table nanny_references(id uuid); create table nanny_documents(id uuid); create table contact_messages(id uuid); create table waitlist(id uuid);
    create table nannies(id uuid primary key,application_id uuid,is_active boolean);
    create table bookings(id uuid primary key,status text,parent_confirmed_at timestamptz,nanny_id uuid,nanny_response text,check_in date,check_out date,total_amount_kes numeric);
    insert into profiles values('${adminId}','admin');`)
  const migration = await readFile(
    new URL('../supabase/payments_and_agreements.sql', import.meta.url),
    'utf8',
  )
  await db.exec(
    "insert into bookings(id,status,check_in,check_out) values('55555555-5555-4555-8555-555555555555','pending',current_date+10,current_date+12)",
  )
  await db.exec(migration)
  legacyStatus = (
    await db.query<{ payment_status: string }>(
      "select payment_status from bookings where id='55555555-5555-4555-8555-555555555555'",
    )
  ).rows[0].payment_status
  await db.exec(
    "insert into bookings(id,status,check_in,check_out) values('66666666-6666-4666-8666-666666666666','pending',current_date+10,current_date+12)",
  )
  oldApiStatus = (
    await db.query<{ payment_status: string }>(
      "select payment_status from bookings where id='66666666-6666-4666-8666-666666666666'",
    )
  ).rows[0].payment_status
  const cutover = await readFile(
    new URL('../supabase/payment_cutover.sql', import.meta.url),
    'utf8',
  )
  await db.exec(cutover)
  await db.exec(cutover)
  const hardening = await readFile(
    new URL('../supabase/security_hardening.sql', import.meta.url),
    'utf8',
  )
  await db.exec(hardening)
  await db.exec(hardening)
  // Migrations must also be safe to reapply to an already migrated staging database.
  await db.exec(migration)
})
after(async () => {
  await db.close()
})
async function seed(overrides = '') {
  await db.exec(`delete from payment_attempts;delete from bookings;
    insert into bookings(id,status,parent_confirmed_at,nanny_id,nanny_response,check_in,check_out,total_amount_kes)
    values('${bookingId}','confirmed',now(),'${nannyId}','accepted',current_date+10,current_date+12,6400);${overrides}`)
}
async function create(reference = 'VN-test') {
  return db.query<{ attempt: { reference: string; amount_subunit: number } }>(
    'select create_booking_payment($1,$2) as attempt',
    [bookingId, reference],
  )
}
async function settle(amount = 640000, currency = 'KES') {
  return db.query('select settle_booking_payment($1,$2,$3,$4,now())', [
    'VN-test',
    amount,
    currency,
    'mobile_money',
  ])
}

test('legacy bookings keep their historical payment arrangement during migration', () => {
  assert.equal(legacyStatus, 'not_required')
  assert.equal(oldApiStatus, 'not_required')
})

test('internal trigger functions cannot be called through the anonymous or signed-in API', async () => {
  const result = await db.query<{ allowed: boolean }>(
    "select has_function_privilege('anon','guard_nanny_publication()','execute') as allowed union all select has_function_privilege('authenticated','set_updated_at()','execute')",
  )
  assert.ok(result.rows.every((row) => !row.allowed))
})

test('checkout requires both acceptances and an active confirmed booking', async () => {
  for (const mutation of [
    'parent_confirmed_at=null',
    'nanny_response=null',
    "nanny_response='pending'",
    'nanny_id=null',
    "status='pending'",
    "status='cancelled'",
  ]) {
    await seed(`update bookings set ${mutation};`)
    await assert.rejects(create(), /Accept the nanny match/)
  }
})
test('checkout snapshots the server total and reuses one pending payment', async () => {
  await seed()
  const a = (await create()).rows[0].attempt
  const b = (await create('VN-second-click')).rows[0].attempt
  assert.equal(a.amount_subunit, 640000)
  assert.equal(a.reference, b.reference)
  assert.equal(
    (
      await db.query<{ count: number }>(
        'select count(*)::int as count from payment_attempts',
      )
    ).rows[0].count,
    1,
  )
})
test('wrong amount and wrong currency cannot settle a payment', async () => {
  await seed()
  await create()
  await assert.rejects(settle(6400), /mismatch/)
  await assert.rejects(settle(640000, 'USD'), /mismatch/)
  assert.equal(
    (
      await db.query<{ payment_status: string }>(
        'select payment_status from bookings',
      )
    ).rows[0].payment_status,
    'unpaid',
  )
})
test('repeated settlement is idempotent and a paid booking cannot be charged again', async () => {
  await seed()
  await create()
  await settle()
  await settle()
  assert.equal(
    (
      await db.query<{ payment_status: string }>(
        'select payment_status from bookings',
      )
    ).rows[0].payment_status,
    'paid',
  )
  await assert.rejects(create('VN-again'), /does not need another payment/)
})
test('pending and paid bookings cannot silently change dates or price', async () => {
  await seed()
  await create()
  await assert.rejects(
    db.exec('update bookings set total_amount_kes=1'),
    /Contact support/,
  )
  await settle()
  await assert.rejects(
    db.exec('update bookings set check_in=check_in+1'),
    /Contact support/,
  )
})
test('care cannot start unpaid, but verified payment unlocks the lifecycle', async () => {
  await seed()
  await assert.rejects(
    db.exec("update bookings set status='in_progress'"),
    /Payment is required/,
  )
  await create()
  await settle()
  await db.exec("update bookings set status='in_progress'")
  assert.equal(
    (await db.query<{ status: string }>('select status from bookings')).rows[0]
      .status,
    'in_progress',
  )
})
test('late success on a cancelled booking is retained for refund review', async () => {
  await seed()
  await create()
  await db.exec("update bookings set status='cancelled'")
  await settle()
  assert.equal(
    (
      await db.query<{ payment_status: string }>(
        'select payment_status from bookings',
      )
    ).rows[0].payment_status,
    'refund_pending',
  )
})
test('approving an application cannot publish without a reviewed agreement', async () => {
  await db.exec(
    `insert into nanny_applications(id,status) values('${appId}','approved')`,
  )
  await assert.rejects(
    db.exec(`insert into nannies values('${nannyId}','${appId}',true)`),
    /signed agreement/,
  )
  await db.exec(
    `update nanny_applications set agreement_signed_path='private/signed.pdf',agreement_reviewed_at=now(),agreement_reviewed_by='${adminId}' where id='${appId}'`,
  )
  await db.exec(`insert into nannies values('${nannyId}','${appId}',true)`)
  assert.equal(
    (await db.query<{ is_active: boolean }>('select is_active from nannies'))
      .rows[0].is_active,
    true,
  )
})
test('anonymous and signed-in clients cannot execute settlement or insert forged paid bookings', async () => {
  const rows = await db.query<{ allowed: boolean }>(
    `select has_function_privilege('authenticated','settle_booking_payment(text,bigint,text,text,timestamptz)','execute') as allowed union all select has_table_privilege('anon','bookings','insert')`,
  )
  assert.ok(rows.rows.every((row) => !row.allowed))
})

test('signed-in users cannot promote their own account role', async () => {
  await db.exec(
    'grant usage on schema auth to authenticated; grant execute on function auth.role() to authenticated; grant update on profiles to authenticated; grant select on profiles to authenticated; set role authenticated;',
  )
  try {
    await assert.rejects(
      db.exec(`update profiles set role='nanny' where id='${adminId}'`),
      /Role changes must use/,
    )
    await db.exec("set request.jwt.claim.role = 'service_role'")
    await assert.rejects(
      db.exec(`update profiles set role='nanny' where id='${adminId}'`),
      /Role changes must use/,
    )
  } finally {
    await db.exec('reset role')
  }
})
