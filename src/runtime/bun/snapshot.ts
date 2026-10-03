// Bun: the mechanics of the copy before an upgrade and the compaction after it (ADR 0063), both of
// which need a FILE — `VACUUM INTO`, a rename, `integrity_check`, the page counts. Why an upgrade
// owes either is in `src/store/upgrade.ts`; this is how, on a machine with a disk.
//
// A Durable Object refuses every statement here (measured 2026-10-03), and has no file to copy:
// recovering from a bad upgrade there is Cloudflare's point-in-time restore.
import { Database } from 'bun:sqlite'
import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { Connection, SnapshotPort } from '@/runtime/ports'

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

const pragma = (conn: Connection, name: 'page_size' | 'page_count' | 'freelist_count'): number =>
  Number(conn.one<Record<string, number>>(`pragma ${name}`)?.[name] ?? 0)

/**
 * Write a copy of `path` before a migration is allowed to touch it, named for the step about
 * to run. Throws if it cannot, and the caller must let that stop the boot: every cause — a
 * full disk, a read-only mount, wrong ownership — is also a reason not to change the shape of
 * somebody's database.
 *
 * `VACUUM INTO` rather than a file copy, for the reason `backups.md` gives: a live database
 * has a write-ahead log, and copying the file can capture a torn state that only shows itself
 * on the day somebody restores it. The caches are emptied inside the same attempt, so a failure
 * of either is the one error below.
 */
export const copyBeforeMigrating: SnapshotPort['copyBeforeMigrating'] = (conn, path, step, emptyCaches) => {
  const dir = join(dirname(path), 'backups')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
  const dest = join(dir, `pre-${step}-${stamp}-${basename(path)}`)
  try {
    mkdirSync(dir, { recursive: true })
    emptyCaches(conn)
    conn.exec(`vacuum into ${quoted(dest)}`)
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
 * did, in which case THE CONNECTION IS CLOSED and the caller has to open it again.
 *
 * ⚠️ `VACUUM INTO` and a rename, never a `VACUUM` in place. "There is deliberately no VACUUM"
 * has been in `render-cache.ts` since the sweep was written, because one has cost this project
 * a database. This shape has no such day in it: the replacement is verified before anything
 * moves, the rename is atomic, a crash before it leaves the original untouched, and the
 * database is closed first so SQLite retires its `-wal` and `-shm` rather than leaving one
 * beside a file it no longer describes.
 */
export const compactIfMostlyFree: SnapshotPort['compactIfMostlyFree'] = (
  conn, path,
  // Test seam. A fixture that had to be 64 MB before it could exercise this would be a
  // fixture nobody runs, and the thresholds are the one part of this that is a judgement
  // rather than a mechanism.
  { minShare = MIN_FREE_SHARE, minBytes = MIN_FREE_BYTES } = {},
) => {
  const size = pragma(conn, 'page_size')
  const pages = pragma(conn, 'page_count')
  const free = pragma(conn, 'freelist_count')
  if (!size || !pages) return false
  if (free / pages < minShare || free * size < minBytes) return false

  const tmp = `${path}.compacting`
  let closed = false
  try {
    rmSync(tmp, { force: true })
    conn.exec(`vacuum into ${quoted(tmp)}`)
    if (!intact(tmp)) {
      rmSync(tmp, { force: true })
      return false
    }
    conn.close()
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

/**
 * Does the file that is about to replace a live database read as a database at all?
 *
 * Opened RAW and read-only, not through `db.ts`'s `open`: that one sets `journal_mode = WAL`,
 * which rewrites the header of the very file being vouched for.
 */
function intact(path: string): boolean {
  const copy = new Database(path, { readonly: true })
  try {
    const row = copy.query(`pragma integrity_check`).get() as { integrity_check?: string } | null
    return row?.integrity_check === 'ok'
  } finally {
    copy.close()
  }
}
