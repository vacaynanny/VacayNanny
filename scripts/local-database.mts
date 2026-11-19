import { spawnSync } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

export const root = fileURLToPath(new URL('../', import.meta.url))
export const workdir = join(root, 'artifacts/supabase-local')
const cli = join(root, 'node_modules/.bin/supabase')
const network = 'vacaynanny-local'

function command(binary: string, args: string[]) {
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  if (result.error) throw new Error(`Could not run ${binary.split('/').at(-1)}.`)
  if (result.status !== 0)
    throw new Error(result.stderr?.slice(-5000) || 'Local database command failed.')
  return result.stdout
}

export function localCli(args: string[]) {
  if (
    args.some(
      (value) =>
        value.startsWith('--remote') ||
        value.startsWith('--db-url') ||
        value === 'link' ||
        value === 'projects',
    )
  )
    throw new Error('Only local database operations are permitted by this helper.')
  return command(cli, [...args, '--workdir', workdir])
}

export async function assertLocalWorkspace() {
  const config = await readFile(join(workdir, 'supabase/config.toml'), 'utf8')
  if (!/^project_id = "vacaynanny-local"$/m.test(config))
    throw new Error('The local project ID does not match VacayNanny.')
  try {
    await access(join(workdir, 'supabase/.temp/project-ref'))
  } catch {
    return
  }
  throw new Error('The local test workspace must never be linked to a hosted project.')
}

export async function prepareDatabase() {
  await mkdir(join(workdir, 'supabase'), { recursive: true })
  await writeFile(
    join(workdir, 'supabase/config.toml'),
    await readFile(join(root, 'supabase/local.config.toml'), 'utf8'),
  )
  await assertLocalWorkspace()
  const sources = [
    'schema.sql',
    'content_catalog.sql',
    'payments_and_agreements.sql',
    'security_hardening.sql',
    'payment_cutover.sql',
  ]
  const pieces = await Promise.all(
    sources.map(
      async (source) =>
        `-- Source: supabase/${source}\n${await readFile(join(root, 'supabase', source), 'utf8')}`,
    ),
  )
  const workflowMigrations = (await readdir(join(root, 'supabase/migrations')))
    .filter((name) => name.endsWith('.sql'))
    .sort()
  for (const source of workflowMigrations) {
    pieces.push(await readFile(join(root, 'supabase/migrations', source), 'utf8'))
  }
  // Supabase handles the migration transaction; strip only top-level wrappers.
  const sql = pieces.join('\n\n').replace(/^\s*(?:begin|commit);\s*$/gim, '')
  const migrations = join(workdir, 'supabase/migrations')
  await mkdir(migrations, { recursive: true })
  let filename = (await readdir(migrations)).find((name) =>
    name.endsWith('_local_bootstrap.sql'),
  )
  if (!filename) {
    localCli(['migration', 'new', 'local_bootstrap'])
    filename = (await readdir(migrations)).find((name) =>
      name.endsWith('_local_bootstrap.sql'),
    )
  }
  if (!filename) throw new Error('The CLI did not create the local bootstrap migration.')
  await writeFile(join(migrations, filename), sql)
  const checksum = createHash('sha256').update(sql).digest('hex')
  await writeFile(
    join(workdir, 'sources.json'),
    JSON.stringify(
      {
        sources: [
          ...sources,
          ...workflowMigrations.map((source) => `migrations/${source}`),
        ],
        checksum,
      },
      null,
      2,
    ) + '\n',
  )
}

export async function startDatabase() {
  await prepareDatabase()
  try {
    command('docker', ['network', 'inspect', network])
  } catch {
    command('docker', [
      'network',
      'create',
      '--opt',
      'com.docker.network.bridge.host_binding_ipv4=127.0.0.1',
      network,
    ])
  }
  console.log('Starting local Supabase. The first run downloads its Docker images.')
  localCli([
    'start',
    '--network-id',
    network,
    '--exclude',
    'realtime,imgproxy,studio,edge-runtime,logflare,vector,supavisor',
  ])
  console.log(
    'Local Supabase is running at http://127.0.0.1:56321; PostgreSQL uses port 56322.',
  )
}

export async function localCredentials() {
  await assertLocalWorkspace()
  const status = JSON.parse(localCli(['status', '-o', 'json']))
  const url = status.API_URL || status.api?.url
  const anonKey = status.ANON_KEY || status.PUBLISHABLE_KEY || status.auth?.anon_key
  const serviceKey =
    status.SERVICE_ROLE_KEY || status.SECRET_KEY || status.auth?.service_role_key
  if (
    typeof url !== 'string' ||
    new URL(url).hostname !== '127.0.0.1' ||
    new URL(url).port !== '56321' ||
    typeof anonKey !== 'string' ||
    typeof serviceKey !== 'string'
  )
    throw new Error('Expected credentials for the isolated local Supabase endpoint.')
  return { url, anonKey, serviceKey }
}
