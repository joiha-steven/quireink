// The snapshot that leaves the machine.
//
// `backup.ts` answers "I broke something an hour ago"; this answers "the machine is gone",
// and until now that answer was an ops script with a crontab (`scripts/ops/quire-backup.sh`)
// — real, documented, and never once written by anyone who installed with one command.
// ADR 0035 moves the SHIPPING of a snapshot into the software: every archive the schedule
// writes is also PUT into any S3-compatible bucket (R2, S3, MinIO — one protocol), and the
// remote copies are pruned to the same retention as the local ones.
//
// What deliberately does NOT move in: restore. Parity exception 1 removed an application
// that could overwrite every table in itself, and it is not coming back through a bucket.
// Restoring stays a shell act on a stopped service (`docs/backups.md`), which is also why
// this module needs only three verbs: write, list, delete.
//
// Failure here never fails the backup. The local snapshot is already on disk and is the
// more likely one to be needed; a bucket outage must not turn a good backup into an error.

import { getIntegrationKeys } from '@/store/integration-keys'
import { getSettings } from '@/content/settings'
import { isSnapshotName } from '@/server/backup'
import { logActivity } from '@/server/activity'

/** The three verbs this module needs — Bun's S3Client has them; a test fakes them. */
export type OffsiteClient = {
  write(key: string, data: Blob | ArrayBuffer | string): Promise<number>
  list(opts?: { prefix?: string }): Promise<{ contents?: { key: string }[] } | null>
  delete(key: string): Promise<void>
}

export type OffsiteTarget = { client: OffsiteClient; prefix: string }

/** `photos` -> `photos/`, `/a/b/` -> `a/b/` — a folder name, never a rooted path. */
export function normalizePrefix(raw: string): string {
  const trimmed = raw.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  return trimmed ? `${trimmed}/` : ''
}

/**
 * The configured bucket, or null. Bucket + both keys make it configured; the endpoint is
 * optional (empty = AWS), and an empty region is R2's own word for it: `auto`.
 */
export async function offsiteTarget(): Promise<OffsiteTarget | null> {
  const k = await getIntegrationKeys()
  if (!k.s3Bucket || !k.s3AccessKeyId || !k.s3SecretAccessKey) return null
  const client = new Bun.S3Client({
    accessKeyId: k.s3AccessKeyId,
    secretAccessKey: k.s3SecretAccessKey,
    bucket: k.s3Bucket,
    region: k.s3Region || 'auto',
    ...(k.s3Endpoint ? { endpoint: k.s3Endpoint } : {}),
  })
  return { client, prefix: normalizePrefix(k.s3Prefix) }
}

/**
 * Ship one finished archive, then prune the bucket to the same `keep` as the local
 * directory. Never throws: the report goes to the activity log either way, and the
 * caller's snapshot is already safe on disk.
 *
 * Pruning trusts nothing in the bucket but our own shape: only keys under OUR prefix
 * whose basename `isSnapshotName` are counted or deleted, so a shared bucket keeps
 * everything else it holds.
 */
export async function replicateSnapshot(
  localPath: string,
  name: string,
  target?: OffsiteTarget | null,
): Promise<boolean> {
  const t = target !== undefined ? target : await offsiteTarget()
  if (!t) return false
  try {
    await t.client.write(`${t.prefix}${name}`, Bun.file(localPath) as unknown as Blob)

    const { keep } = (await getSettings()).backups
    const listed = (await t.client.list({ prefix: t.prefix }))?.contents ?? []
    const ours = listed
      .map((o) => o.key)
      .filter((key) => key.startsWith(t.prefix) && isSnapshotName(key.slice(t.prefix.length)))
      .sort((a, b) => b.localeCompare(a)) // the name is the time it was taken
    for (const key of ours.slice(Math.max(1, keep))) {
      await t.client.delete(key)
    }
    void logActivity('backup.offsite', `${name} -> bucket`)
    return true
  } catch (error) {
    console.error(`[ERROR] backup.offsite(${name}): ${(error as Error).message}`)
    void logActivity('backup.offsite', `FAILED: ${(error as Error).message}`)
    return false
  }
}

/**
 * Prove the paste works while the owner is still at the keyboard: write one marker
 * object and delete it. Throws with the transport's own words — the route turns that
 * into the sentence the admin shows.
 */
export async function offsiteTest(target?: OffsiteTarget | null): Promise<void> {
  const t = target !== undefined ? target : await offsiteTarget()
  if (!t) throw new Error('not configured')
  const key = `${t.prefix}quire-connection-test.txt`
  await t.client.write(key, `quire ink reached this bucket at ${new Date().toISOString()}\n`)
  await t.client.delete(key)
}
