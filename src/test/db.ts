// A real, empty SQLite database per test file.
//
// The frozen tree's data-layer tests had to mock the PostgREST query builder, because
// Postgres is not available in a unit test. Two of them (`slugs.test.ts`,
// `soft-delete.test.ts`) were a hand-written fake that re-implemented `.eq()`/`.is()`
// filtering, i.e. a second, unverified copy of the database's behaviour. SQLite is
// in-process, so the fake is deleted and the tests run against the real schema: a read
// path that forgets `liveOnly` now fails because SQLite really returns the trashed row.
//
// Each test file gets its own directory. `openDatabases` holds one pair of connections
// per process and closes the previous pair, so files must not share a directory.
import { rmSync } from 'node:fs'
import { openDatabases, closeDatabases } from '@/store/db'
import { resetViewTotalsCache } from '@/analytics/summary'
import { resetSettingsCache } from '@/content/settings'

export function freshDatabase(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
  openDatabases(dir)
  // In-process caches that outlive a database do not survive one being replaced under
  // them. A test that writes analytics rows straight into the table and then renders the
  // sidebar would otherwise read the previous file's totals.
  resetViewTotalsCache()
  resetSettingsCache()
}

export function dropDatabase(dir: string): void {
  closeDatabases()
  // Best-effort: Windows can hold the WAL/SHM files a beat after close, and this is test
  // hygiene rather than a behaviour under test.
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}
