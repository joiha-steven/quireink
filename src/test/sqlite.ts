// The raw `bun:sqlite` handle under each of the store's two connections, for tests.
//
// Tests seed and inspect rows with whatever SQL states the case most plainly — `db().run` with an
// array, `.query().get()`, `.transaction()` — and they run on Bun by definition, so they keep the
// driver's own API, through these two and from this one place. Shipped code cannot: `check:sql`
// fails a file outside `src/store/` that reaches for a connection. Today the store's handles ARE
// the driver's; once they are the runtime seam's `Connection` (ADR 0066), only this file changes.
import type { Database } from 'bun:sqlite'
import { analyticsDb as analyticsConnection, db as contentConnection, openDatabases } from '@/store/db'

/** `quire.db`, as the driver sees it. Throws before `openDatabases`, as the store does. */
export const db = (): Database => contentConnection()

/** `analytics.db`, as the driver sees it. */
export const analyticsDb = (): Database => analyticsConnection()

/** `openDatabases`, answering with the two raw handles. */
export function openSqlite(dir: string): { db: Database; analyticsDb: Database } {
  openDatabases(dir)
  return { db: db(), analyticsDb: analyticsDb() }
}
