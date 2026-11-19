import { spawn } from 'node:child_process'
import nextEnv from '@next/env'
import { localCredentials, root } from './local-database.mjs'

nextEnv.loadEnvConfig(root)
const database = await localCredentials()
const paymentKey = process.env.PAYSTACK_SECRET_KEY || ''
if (paymentKey && !paymentKey.startsWith('sk_test_'))
  throw new Error(
    'The local database review server requires a Paystack test key.',
  )
const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'dev',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3102',
  ],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: database.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: database.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: database.serviceKey,
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3102',
      EMAIL_DELIVERY_MODE: 'disabled',
      RESEND_API_KEY: '',
      PAYSTACK_SECRET_KEY: paymentKey,
      CRON_SECRET: '',
      VACAYNANNY_TEST_DIST: '.next-localdb',
    },
  },
)
console.log(
  'Database review: http://localhost:3102. Uses the isolated local Supabase stack; email sending is disabled.',
)
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
child.on('exit', (code) => process.exit(code || 0))
