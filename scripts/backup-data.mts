import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { root } from './local-database.mjs'

nextEnv.loadEnvConfig(root)
const expected = process.argv
  .find((value) => value.startsWith('--project-ref='))
  ?.split('=')[1]
if (!expected || !/^[a-z]{20}$/.test(expected))
  throw new Error('Pass the expected --project-ref explicitly.')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
if (
  new URL(url).hostname !== `${expected}.supabase.co` ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
)
  throw new Error(
    'The configured database does not match the expected project.',
  )
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const tables = [
  'profiles',
  'destinations',
  'nanny_applications',
  'nanny_references',
  'nanny_documents',
  'nannies',
  'bookings',
  'reviews',
  'waitlist',
  'contact_messages',
  'booking_messages',
  'pricing_tiers',
  'care_offerings',
  'pricing_addons',
  'faqs',
  'homepage_steps',
  'business_policies',
  'rate_limits',
]
const data: Record<string, unknown[]> = {}
for (const table of tables) {
  const rows: unknown[] = []
  const key =
    table === 'rate_limits'
      ? 'bucket'
      : ['pricing_tiers', 'care_offerings', 'pricing_addons'].includes(table)
        ? 'code'
        : 'id'
  for (let start = 0; ; start += 500) {
    const result = await db
      .from(table)
      .select('*')
      .order(key)
      .range(start, start + 499)
    if (result.error)
      throw new Error(
        `Could not snapshot ${table}; no complete snapshot was written.`,
      )
    rows.push(...result.data)
    if (result.data.length < 500) break
  }
  data[table] = rows
}
const folder = join(root, 'artifacts/database-backups')
await mkdir(folder, { recursive: true, mode: 0o700 })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const filename = `application-data-${stamp}.json`
const content =
  JSON.stringify(
    {
      project_ref: expected,
      captured_at: new Date().toISOString(),
      scope:
        'Public application tables only. Excludes Auth users, Storage file bytes and platform settings.',
      tables: data,
    },
    null,
    2,
  ) + '\n'
await writeFile(join(folder, filename), content, { mode: 0o600 })
await writeFile(
  join(folder, `${filename}.sha256`),
  createHash('sha256').update(content).digest('hex') + '\n',
  { mode: 0o600 },
)
console.log(
  `Saved a private application-data snapshot covering ${tables.length} tables under artifacts/database-backups/.`,
)
console.log(
  'No row contents or credentials were printed. This is not a full managed database backup; Auth users and Storage files are excluded.',
)
