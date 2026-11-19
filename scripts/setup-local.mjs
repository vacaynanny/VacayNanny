import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const path = new URL('../.env.local', import.meta.url)
let existing = ''
try {
  existing = await readFile(path, 'utf8')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const has = (name) =>
  new RegExp(`^\\s*(?:export\\s+)?${name}=`, 'm').test(existing)
const defaults = {
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  EMAIL_DELIVERY_MODE: 'disabled',
  CRON_SECRET: randomBytes(32).toString('hex'),
}
const additions = Object.entries(defaults).filter(([name]) => !has(name))
if (additions.length) {
  await writeFile(
    path,
    `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}\n# Local defaults; secrets in this file stay outside Git.\n${additions.map(([name, value]) => `${name}=${value}`).join('\n')}\n`,
    { mode: 0o600 },
  )
  console.log(
    `Local setup: added ${additions.map(([name]) => name).join(', ')}.`,
  )
} else
  console.log(
    'Local setup is already configured. Existing values were preserved.',
  )
console.log(
  'No database or external account was changed. Use npm run dev:review for isolated UI review.',
)
