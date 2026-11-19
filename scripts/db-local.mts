import {
  assertLocalWorkspace,
  localCli,
  prepareDatabase,
  startDatabase,
} from './local-database.mjs'

const action = process.argv[2] || 'start'
try {
  if (action === 'start') await startDatabase()
  else if (action === 'prepare') {
    await prepareDatabase()
    console.log('Prepared the isolated local database workspace.')
  } else if (action === 'stop') {
    await assertLocalWorkspace()
    localCli(['stop'])
    console.log(
      'Stopped the VacayNanny local database services. Data was preserved.',
    )
  } else if (action === 'reset') {
    await assertLocalWorkspace()
    await prepareDatabase()
    localCli(['db', 'reset', '--yes', '--network-id', 'vacaynanny-local'])
    console.log(
      'Rebuilt the isolated local test database from the current SQL sources.',
    )
  } else throw new Error('Use start, prepare, stop or reset.')
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Local database setup failed.',
  )
  process.exitCode = 1
}
