// Snapshots, kept on this machine.
//
// One snapshot is a `tar.gz` holding both databases and the uploads tree — the same
// archive the owner can download from Settings, written to a directory on the box instead
// of streamed to a browser. The schedule and the retention count in Settings drive it, and
// until now drove nothing: 2.0 dropped Google Drive (parity exception 1) and the fields
// stayed behind pointing at a destination that no longer existed.
//
// A copy that lives beside the thing it is copying survives a bad delete, a bad restore
// and a bad migration, and does not survive the disk — so every archive written here is
// also SHIPPED, when a bucket is configured: `backup-offsite.ts` (ADR 0035) PUTs it into
// any S3-compatible store and prunes the remote copies to the same retention. The ops
// script in `scripts/ops/quire-backup.sh` remains for fleets that would rather run their
// own; `docs/backups.md` holds the map.
//
// The databases are copied through SQLite's own `VACUUM INTO` rather than read off disk: a
// live database has a write-ahead log, and copying the file alone can capture a torn state
// that only reveals itself on restore.

import { mkdtemp, readdir, rm, stat, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { db, analyticsDb } from '@/store/db'
import { getSettings } from '@/content/settings'
import { replicateSnapshot } from '@/server/backup-offsite'

export type Snapshot = {
  name: string
  size: number
  /** ISO 8601, from the file's own mtime. There is no state table; see `lastRunAt`. */
  createdAt: string
}

/** Where snapshots live. Beside the data by default, so one volume holds both. */
export const snapshotsDir = (): string =>
  resolve(process.env.BACKUP_DIR || join(process.env.DATA_DIR || './data', 'backups'))

const uploadsDir = (): string => resolve(process.env.STORAGE_LOCAL_DIR || './uploads')

/**
 * `quire-2026-07-29T2040.tar.gz` — sortable, and unambiguous in a Downloads folder a year
 * later. The minute is in it because a schedule can produce more than one a day and two
 * files named for the same date would be one file.
 */
export function snapshotName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `quire-${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}`
    + `T${p(now.getUTCHours())}${p(now.getUTCMinutes())}.tar.gz`
}

/**
 * A name this module produced, and nothing else.
 *
 * Every route that takes a snapshot name goes through here. The name arrives in a query
 * string, and without this a `..` in it reads or deletes a file anywhere the process can
 * reach. An allowlist pattern rather than a check for `..`, because normalising a path and
 * then trusting it is how that check gets got.
 */
export const isSnapshotName = (name: string): boolean =>
  /^quire-\d{4}-\d{2}-\d{2}T\d{4}\.tar\.gz$/.test(name)

/**
 * Build one archive at `dest`. Throws with tar's own stderr if it fails.
 *
 * Shared with the download route, so the file the owner takes by hand and the file the
 * schedule writes are the same artifact built by the same code. Two builders would drift,
 * and the one that drifted would be the one nobody exercised.
 */
export async function buildArchive(dest: string): Promise<number> {
  // A staging directory, so the consistent database copies and the uploads tree can be
  // tarred as one tree with sensible names inside the archive.
  const stage = await mkdtemp(join(tmpdir(), 'quire-backup-'))
  try {
    // VACUUM INTO takes a consistent snapshot of a live database, WAL included, and writes
    // a single compact file. This is the reason not to copy quire.db directly.
    //
    // ⚠️ THE ONE PLACE OUTSIDE `analytics/aggregate.ts` THAT ASSEMBLES SQL FROM A VARIABLE,
    // and it is deliberate rather than an oversight — noted here on 2026-08-22, when a sweep
    // found the schema doc still calling that the codebase's only such site.
    //
    // `VACUUM INTO` takes a filename, and SQLite does not accept a bound parameter there:
    // there is no parameterised form of this statement to reach for. What goes in is a path
    // this process just made with `mkdtemp` under the system temp directory — never a
    // request, never a setting, never anything a reader can touch — and the single quotes
    // are doubled, which is SQLite's own escape for a string literal.
    //
    // Do not generalise from it. The rule in CLAUDE.md stands: a VALUE is bound, always.
    db().exec(`vacuum into '${join(stage, 'quire.db').replace(/'/g, "''")}'`)
    analyticsDb().exec(`vacuum into '${join(stage, 'analytics.db').replace(/'/g, "''")}'`)

    const uploads = uploadsDir()
    // To STDOUT, then written here. NOT `-f <dest>`: GNU tar reads an `-f` argument
    // containing a colon as `host:path` and tries to reach a remote machine, so an absolute
    // Windows path fails with "Cannot connect to C" and the whole feature is untestable on
    // the machine it is written on.
    const args = ['-czf', '-', '-C', stage, 'quire.db', 'analytics.db']
    // The uploads tree is added from its own parent, so it unpacks as `uploads/`
    // regardless of where it lives on this machine.
    if (existsSync(uploads)) args.push('-C', resolve(uploads, '..'), uploads.split(/[\\/]/).pop()!)

    const proc = Bun.spawn(['tar', ...args], { stdout: 'pipe', stderr: 'pipe' })
    // Read fully, then write. Handing the live stdout stream straight to `Bun.write`
    // deadlocks on Windows, and this runs off the request path where a few hundred
    // megabytes held briefly costs nothing.
    const body = await new Response(proc.stdout).arrayBuffer()
    const code = await proc.exited
    if (code !== 0) {
      throw new Error(`tar exited ${code}: ${(await new Response(proc.stderr).text()).trim()}`)
    }
    await Bun.write(dest, body)
    return (await stat(dest)).size
  } finally {
    await rm(stage, { recursive: true, force: true })
  }
}

/** Newest first. An unreadable or absent directory is an empty list, not an error. */
export async function listSnapshots(): Promise<Snapshot[]> {
  const dir = snapshotsDir()
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }

  const found: Snapshot[] = []
  for (const name of names) {
    if (!isSnapshotName(name)) continue
    try {
      const info = await stat(join(dir, name))
      found.push({ name, size: info.size, createdAt: new Date(info.mtimeMs).toISOString() })
    } catch {
      // Vanished between the listing and the stat. Not worth an error.
    }
  }
  // By NAME, which is the time it was taken. An mtime sort would reorder the list after a
  // file copy or a restore touched it.
  return found.sort((a, b) => b.name.localeCompare(a.name))
}

/** When the last snapshot was taken, or null. Derived, so there is no state to go stale. */
export async function lastRunAt(): Promise<string | null> {
  return (await listSnapshots())[0]?.createdAt ?? null
}

/**
 * Take one snapshot and prune to the retention count.
 *
 * Pruned AFTER the new one is written, not before. Pruning first would use less peak disk
 * and would delete a good backup to make room for one that then failed.
 */
export async function runBackup(): Promise<Snapshot> {
  const dir = snapshotsDir()
  await mkdir(dir, { recursive: true })

  const name = snapshotName()
  const dest = join(dir, name)
  let size: number
  try {
    size = await buildArchive(dest)
  } catch (error) {
    // A half-written archive is worse than none: it counts towards retention and it looks
    // like a backup until the day someone opens it.
    await rm(dest, { force: true })
    throw error
  }

  const { keep } = (await getSettings()).backups
  for (const old of (await listSnapshots()).slice(Math.max(1, keep))) {
    await rm(join(dir, old.name), { force: true })
  }

  // And off the machine (ADR 0035): every snapshot the schedule or the button writes is
  // also PUT into the configured bucket. Awaited, so the cron tick's report is truthful —
  // but a bucket outage never fails the backup; the archive above is already on disk.
  await replicateSnapshot(dest, name)

  return { name, size, createdAt: new Date().toISOString() }
}

export async function deleteSnapshot(name: string): Promise<boolean> {
  if (!isSnapshotName(name)) return false
  await rm(join(snapshotsDir(), name), { force: true })
  return true
}

/**
 * The cron entry: run only when enabled and only when one is due.
 *
 * "Due" is measured from the newest snapshot on disk rather than from a recorded run time,
 * so deleting every snapshot asks for a fresh one and a restored machine does not think it
 * already has today's.
 */
export async function maybeRunBackup(): Promise<{ ran: boolean; name?: string; error?: string }> {
  const { backups } = await getSettings()
  if (!backups.enabled) return { ran: false }

  const last = await lastRunAt()
  if (last && Date.now() - Date.parse(last) < backups.intervalDays * 86_400_000) {
    return { ran: false }
  }

  try {
    const { name } = await runBackup()
    return { ran: true, name }
  } catch (error) {
    // Reported, not thrown: a failed backup must not take the rest of the cron tick with it.
    console.error(`[ERROR] backup.scheduled: ${(error as Error).message}`)
    return { ran: false, error: (error as Error).message }
  }
}
