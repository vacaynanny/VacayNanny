import { loadEnvConfig } from '@next/env'
import { checkSetup, type SetupTarget } from '../lib/setup-checks'
import { checkDatabase } from '../lib/database-checks'

loadEnvConfig(process.cwd())
const argument =
  process.argv.find((value) => value.startsWith('--target='))?.split('=')[1] ||
  'local'
if (!['local', 'staging', 'production'].includes(argument))
  throw new Error('Use --target=local, staging or production.')
const target = argument as SetupTarget
async function main() {
  let checks = checkSetup(process.env, target)
  const database = process.argv.includes('--database')
  if (database) {
    checks = checks.filter((check) => check.name !== 'Supabase')
    checks.push(...(await checkDatabase(process.env)))
  }
  console.log(`VacayNanny setup — ${target}\n`)
  for (const check of checks)
    console.log(
      `${check.status.toUpperCase().padEnd(9)} ${check.name}: ${check.detail}`,
    )
  console.log(
    database
      ? '\nDatabase checks used read-only requests. No records were downloaded, emails sent or payments attempted.'
      : '\nThis checks configuration only. It does not connect to Supabase, send email or attempt a payment.',
  )
  if (
    checks.some((check) => check.status === 'invalid') ||
    (target !== 'local' && checks.some((check) => check.status !== 'ready'))
  )
    process.exitCode = 1
}
main().catch(() => {
  console.error('Setup checks could not be completed.')
  process.exitCode = 1
})
