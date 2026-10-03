// Snapshots, kept on this machine.
//
// One snapshot is the archive `archive.ts` writes — both databases as rows and the uploads tree
// (ADR 0067) — the same file the owner can download from Settings, kept in the runtime's
// snapshot store (`@/runtime/impl/archive`; on Bun a directory beside the data) instead of
// streamed to a browser. The schedule and the retention count in Settings drive it, and until
// 2026-07-29 drove nothing: 2.0 dropped Google Drive (parity exception 1) and the fields stayed
// behind pointing at a destination that no longer existed.
//
// A copy that lives beside the thing it is copying survives a bad delete, a bad restore
// and a bad migration, and does not survive the disk — so every archive written here is
// also SHIPPED, when a bucket is configured: `backup-offsite.ts` (ADR 0035) PUTs it into
// any S3-compatible store and prunes the remote copies to the same retention. The ops
// script in `scripts/ops/quire-backup.sh` remains for fleets that would rather run their
// own; `docs/backups.md` holds the map.

import { getSettings } from '@/content/settings'
import { replicateSnapshot } from '@/server/backup-offsite'
import { logActivityError } from '@/server/activity'
import { archiveStream, encryptReady, withArchiveRetry } from '@/server/archive'
import { listKept, openKept, removeKept, writeKept } from '@/runtime/impl/archive'

export { encryptReady }

export type Snapshot = {
  name: string
  size: number
  /** ISO 8601, from the file's own mtime. There is no state table; see `lastRunAt`. */
  createdAt: string
}

/**
 * `quire-2026-07-29T2040.tar.gz` — sortable, and unambiguous in a Downloads folder a year
 * later. The minute is in it because a schedule can produce more than one a day and two
 * files named for the same date would be one file.
 *
 * `.enc` when sealed, because the extension is the only thing telling somebody a year later
 * that `tar -xzf` is not going to work and what to reach for instead.
 */
export function snapshotName(now = new Date(), sealed = false): string {
  const p = (n: number) => String(n).padStart(2, '0')
  // THE SECOND TOO, since 2026-09-30. Two runs inside one minute — the button pressed twice,
  // the clock and an external cron, MCP `run_backup` — wrote ONE file, and the failure path of
  // the second deleted the good first one. Names from before keep matching `isSnapshotName`.
  return `quire-${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}`
    + `T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}.tar.gz${sealed ? '.enc' : ''}`
}

/**
 * A name this module produced, and nothing else.
 *
 * Every route that takes a snapshot name goes through here. The name arrives in a query
 * string, and without this a `..` in it reads or deletes a file anywhere the process can
 * reach. An allowlist pattern rather than a check for `..`, because normalising a path and
 * then trusting it is how that check gets got.
 */
/**
 * ⚠️ AND IT IS THREE THINGS AT ONCE, which is why `.enc` had to be added here in the same
 * breath it was added to the name. It is the path-traversal allowlist for the download and
 * delete routes, AND the filter `backup-offsite.ts` prunes the bucket with. Miss the new
 * extension there and remote retention matches nothing, for ever, with no error anywhere:
 * `replicateSnapshot` swallows its failures by design, so the bucket would simply grow.
 */
export const isSnapshotName = (name: string): boolean =>
  /^quire-\d{4}-\d{2}-\d{2}T\d{4}(\d{2})?\.tar\.gz(\.enc)?$/.test(name)

/** Newest first. An unreadable or absent store is an empty list, not an error. */
export async function listSnapshots(): Promise<Snapshot[]> {
  const found = (await listKept())
    .filter((f) => isSnapshotName(f.name))
    .map((f) => ({ name: f.name, size: f.size, createdAt: new Date(f.mtimeMs).toISOString() }))
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
/** The run in progress, which every other caller joins rather than racing. */
let running: Promise<Snapshot> | null = null
/** Set once the owner has confirmed deleting this blog from Cloudflare (`stopBackups`). */
let stopped = false

export function runBackup(): Promise<Snapshot> {
  if (stopped) return Promise.reject(new Error('backups are stopped: this blog is being deleted'))
  // ONE AT A TIME. The button, the clock, an external cron and MCP `run_backup` each started
  // their own, and two at once opened and truncated the same file.
  running ??= takeSnapshot().finally(() => { running = null })
  return running
}

/**
 * No more snapshots in this process, and the one being written, if any, finished first.
 *
 * For leaving Cloudflare (`web/admin/cloudflare-update.ts`): the Worker empties the bucket and
 * then deletes it, and a snapshot the clock started meanwhile landed in the emptied bucket and
 * made Cloudflare refuse the delete as "not empty" — measured 2026-10-03 against a real account,
 * on a blog whose first alarm after an update fell in that minute. Waiting here, before the owner's
 * confirmation is answered, means nothing of this blog is still writing when the emptying starts.
 */
export async function stopBackups(): Promise<void> {
  stopped = true
  await running?.catch(() => undefined)
}

async function takeSnapshot(): Promise<Snapshot> {
  const settings = await getSettings()
  const name = snapshotName(new Date(), encryptReady(settings))
  // All or nothing (`ArchivePort.writeKept`): a failure leaves neither this name nor a half-written
  // file behind. A half-written archive is worse than none: it counts towards retention and it
  // looks like a backup until the day someone opens it.
  const size = await withArchiveRetry(async () => writeKept(name, await archiveStream(settings)))

  const { keep } = (await getSettings()).backups
  for (const old of (await listSnapshots()).slice(Math.max(1, keep))) {
    await removeKept(old.name)
  }

  // And off the machine (ADR 0035): every snapshot the schedule or the button writes is
  // also PUT into the configured bucket. Awaited, so the cron tick's report is truthful —
  // but a bucket outage never fails the backup; the archive above is already kept.
  const kept = await openKept(name)
  if (kept) await replicateSnapshot(name, kept)

  return { name, size, createdAt: new Date().toISOString() }
}

export async function deleteSnapshot(name: string): Promise<boolean> {
  if (!isSnapshotName(name)) return false
  await removeKept(name)
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
  if (!backups.enabled || stopped) return { ran: false }

  const last = await lastRunAt()
  if (last && Date.now() - Date.parse(last) < backups.intervalDays * 86_400_000) {
    return { ran: false }
  }

  try {
    const { name } = await runBackup()
    return { ran: true, name }
  } catch (error) {
    // Reported, not thrown: a failed backup must not take the rest of the cron tick with it.
    // AND REPORTED WHERE THE OWNER LOOKS. A console line reaches a server log nobody reads on a
    // blog; the off-site copy has always written its failures to the activity log, and the
    // scheduled one did not, so a backup could stop for weeks with nothing on any screen.
    console.error(`[ERROR] backup.scheduled: ${(error as Error).message}`)
    void logActivityError('scheduled backup', (error as Error).message)
    return { ran: false, error: (error as Error).message }
  }
}
