// The raw `bun:sqlite` handle under each of the store's two connections, for tests.
//
// The store hands out a `Connection` (`src/runtime/ports.ts`), the one shape both runtimes can
// give. Tests seed and inspect rows with whatever SQL states the case most plainly — `db().run`
// with an array, `.query().get()`, `.transaction()` — and they run on Bun by definition, so they
// keep the driver's own API through these two. Shipped code cannot: `check:sql` fails a file
// outside `src/store/` that reaches for either, and `sqliteOf` is imported from the Bun side
// directly, never through `@/runtime/impl/`, so nothing here pretends to be portable.
import type { Database } from 'bun:sqlite'
import { sqliteOf } from '@/runtime/bun/db'
import { analyticsDb as analyticsConnection, db as contentConnection, openDatabases } from '@/store/db'

/** `quire.db`, as the driver sees it. Throws before `openDatabases`, as the store does. */
export const db = (): Database => sqliteOf(contentConnection())

/** `analytics.db`, as the driver sees it. */
export const analyticsDb = (): Database => sqliteOf(analyticsConnection())

/** `openDatabases`, answering with the two raw handles instead of the two connections. */
export function openSqlite(dir: string): { db: Database; analyticsDb: Database } {
  openDatabases(dir)
  return { db: db(), analyticsDb: analyticsDb() }
}
