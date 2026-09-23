// What an upgrade owes the person running it, in two halves (ADR 0063).
//
// A copy BEFORE the shape changes, because the only protection an operator had was a line of
// documentation asking them to remember, on somebody else's machine, on the one day it
// matters. And the space BACK afterwards, because SQLite hands freed pages to a freelist
// rather than to the disk: after the 0062 migration, measured on a copy of a real 618 MB
// database, 148,824 of 150,985 pages were free and the file was still 618 MB. Somebody who
// reads a changelog about half a gigabyte of dead cache and then looks at their disk would be
// right to conclude it did not work.
import { Database } from 'bun:sqlite'
import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

/** This upgrade's copy and the one before it. See ADR 0063 for why two and not more. */
const KEEP = 2

/**
 * Compacting is for the case the 0062 migration creates — a file that is nearly all holes —
 * and for nothing else. An ordinary upgrade on an ordinary blog must do NOTHING, so both
 * conditions have to hold: a quarter of the file free, and enough of it to be worth a rewrite.
 */
const MIN_FREE_SHARE = 0.25
const MIN_FREE_BYTES = 64 * 1024 * 1024

/**
 * ⚠️ SQL FROM A VARIABLE, and the second site in this codebase to do it. `VACUUM INTO` takes
 * a filename and SQLite accepts no bound parameter there, which is the same reason and the
 * same escape `server/backup.ts` documents at length. What goes in is a path derived from the
 * data directory this process was started with — never a request, never a setting. The rule
 * in CLAUDE.md stands everywhere else: a VALUE is bound, always.
 */
const quoted = (path: string): string => `'${path.replace(/'/g, "''")}'`

const pragma = (db: Database, name: 'page_size' | 'page_count' | 'freelist_count'): number =>
  Number((db.query(`pragma ${name}`).get() as Record<string, number> | null)?.[name] ?? 0)

/**
 * Write a copy of `path` before a migration is allowed to touch it, named for the step about
 * to run. Throws if it cannot, and the caller must let that stop the boot: every cause — a
 * full disk, a read-only mount, wrong ownership — is also a reason not to change the shape of
 * somebody's database.
 *
 * `VACUUM INTO` rather than a file copy, for the reason `backups.md` gives: a live database
 * has a write-ahead log, and copying the file can capture a torn state that only shows itself
 * on the day somebody restores it.
 */
export function copyBeforeMigrating(db: Database, path: string, step: string): string {
  const dir = join(dirname(path), 'backups')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
  const dest = join(dir, `pre-${step}-${stamp}-${basename(path)}`)
  try {
    mkdirSync(dir, { recursive: true })
    emptyCaches(db)
    db.exec(`vacuum into ${quoted(dest)}`)
  } catch (error) {
    throw new Error(
      `could not write the pre-upgrade copy at ${dest} (${(error as Error).message}). `
      + 'The migration has NOT run and nothing in the database has changed but its rebuildable '
      + 'caches. Free some space '
      + 'or fix the ownership of that directory, then start again.',
    )
  }
  keepNewest(dir, basename(path))
  return dest
}

/**
 * THE CACHES ARE EMPTIED BEFORE THE COPY, in the live database, and that is the one change a
 * boot makes ahead of the copy existing. `VACUUM INTO` copies every table, and on a v2.2.13
 * blog `render_cache` WAS the database: found in the release review of 2026-09-23, a 154 MB
 * database migrated to a 426 KB one beside a 154 MB "copy of before" - the space the upgrade
 * handed back was sitting in `data/backups/`, and a disk without room for a second whole
 * database refused the boot, which under `restart: always` is a loop.
 *
 * Emptying them is safe for the same reason the backup drops them (`server/backup.ts`): both
 * are rebuilt on demand, and step 019 empties `render_cache` anyway. Both spelled out, each
 * behind its own existence check, since a database from before 019 has only the first.
 */
function emptyCaches(db: Database): void {
  const has = (table: string): boolean =>
    db.query("select 1 from sqlite_master where type='table' and name = ?").get(table) !== null
  if (has('render_cache')) db.exec('delete from render_cache')
  if (has('body_cache')) db.exec('delete from body_cache')
}

/**
 * Keep this database's two most recent pre-upgrade copies and delete the rest.
 *
 * By modification time rather than by name: the names carry a step and a stamp, so sorting
 * them as text orders by the STEP first and would keep two copies of whichever migration
 * happens to sort last. A failure here is swallowed — a leftover file is untidy, and refusing
 * to boot over untidiness would be worse than the mess.
 */
function keepNewest(dir: string, dbFile: string): void {
  try {
    readdirSync(dir)
      .filter((name) => name.startsWith('pre-') && name.endsWith(`-${dbFile}`))
      .map((name) => ({ name, at: statSync(join(dir, name)).mtimeMs }))
      .sort((a, b) => b.at - a.at)
      .slice(KEEP)
      .forEach((old) => rmSync(join(dir, old.name), { force: true }))
  } catch { /* see the note above */ }
}

/**
 * Give the disk back when a migration has left the file mostly holes. Returns whether it
 * did, in which case THE DATABASE IS CLOSED and the caller has to open it again.
 *
 * ⚠️ `VACUUM INTO` and a rename, never a `VACUUM` in place. "There is deliberately no VACUUM"
 * has been in `render-cache.ts` since the sweep was written, because one has cost this project
 * a database. This shape has no such day in it: the replacement is verified before anything
 * moves, the rename is atomic, a crash before it leaves the original untouched, and the
 * database is closed first so SQLite retires its `-wal` and `-shm` rather than leaving one
 * beside a file it no longer describes.
 */
export function compactIfMostlyFree(
  db: Database, path: string,
  // Test seam. A fixture that had to be 64 MB before it could exercise this would be a
  // fixture nobody runs, and the thresholds are the one part of this that is a judgement
  // rather than a mechanism.
  { minShare = MIN_FREE_SHARE, minBytes = MIN_FREE_BYTES } = {},
): boolean {
  const size = pragma(db, 'page_size')
  const pages = pragma(db, 'page_count')
  const free = pragma(db, 'freelist_count')
  if (!size || !pages) return false
  if (free / pages < minShare || free * size < minBytes) return false

  const tmp = `${path}.compacting`
  let closed = false
  try {
    rmSync(tmp, { force: true })
    db.exec(`vacuum into ${quoted(tmp)}`)
    if (!intact(tmp)) {
      rmSync(tmp, { force: true })
      return false
    }
    db.close()
    closed = true
    renameSync(tmp, path)
    return true
  } catch (error) {
    // Before the close, this is a blog with a big file rather than a broken one, so it goes
    // on booting. After it, there is no connection left to go on with and the caller has to
    // hear about it.
    rmSync(tmp, { force: true })
    if (closed) throw error
    console.error(`[WARN] could not compact ${path}: ${(error as Error).message}`)
    return false
  }
}

/** Does the file that is about to replace a live database read as a database at all? */
function intact(path: string): boolean {
  const copy = new Database(path, { readonly: true })
  try {
    const row = copy.query(`pragma integrity_check`).get() as { integrity_check?: string } | null
    return row?.integrity_check === 'ok'
  } finally {
    copy.close()
  }
}
