// What an upgrade owes the person running it, in two halves (ADR 0063).
//
// A copy BEFORE the shape changes, because the only protection an operator had was a line of
// documentation asking them to remember, on somebody else's machine, on the one day it
// matters. And the space BACK afterwards, because SQLite hands freed pages to a freelist
// rather than to the disk: after the 0062 migration, measured on a copy of a real 618 MB
// database, 148,824 of 150,985 pages were free and the file was still 618 MB. Somebody who
// reads a changelog about half a gigabyte of dead cache and then looks at their disk would be
// right to conclude it did not work.
//
// HOW both are done needs a file, and lives behind the runtime seam (`src/runtime/bun/snapshot.ts`,
// ADR 0066). What stays here is what is true of the DATA on any runtime: which tables a copy
// may leave behind.
import { copyBeforeMigrating as copy, compactIfMostlyFree } from '@/runtime/impl/snapshot'
import type { Connection } from '@/runtime/ports'

export { compactIfMostlyFree }

/**
 * Write a copy of `path` before a migration is allowed to touch it, named for the step about
 * to run, with the caches emptied first (below). Throws if it cannot, and the caller must let
 * that stop the boot. Null on a runtime that keeps no such copy.
 */
export const copyBeforeMigrating = (conn: Connection, path: string, step: string): string | null =>
  copy(conn, path, step, emptyCaches)

/**
 * THE CACHES ARE EMPTIED BEFORE THE COPY, in the live database, and that is the one change a
 * boot makes ahead of the copy existing. `VACUUM INTO` copies every table, and on a v2.2.13
 * blog `render_cache` WAS the database: found in the release review of 2026-09-23, a 154 MB
 * database migrated to a 426 KB one beside a 154 MB "copy of before" - the space the upgrade
 * handed back was sitting in `data/backups/`, and a disk without room for a second whole
 * database refused the boot, which under `restart: always` is a loop.
 *
 * Emptying them is safe for the same reason the backup leaves them out (`store/rows.ts`): both
 * are rebuilt on demand, and step 019 empties `render_cache` anyway. Both spelled out, each
 * behind its own existence check, since a database from before 019 has only the first.
 */
function emptyCaches(conn: Connection): void {
  const has = (table: string): boolean =>
    conn.one("select 1 from sqlite_master where type='table' and name = ?", table) !== null
  if (has('render_cache')) conn.exec('delete from render_cache')
  if (has('body_cache')) conn.exec('delete from body_cache')
}
