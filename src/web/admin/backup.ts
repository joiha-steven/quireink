// The backup routes: the archive the owner takes by hand, and the ones the schedule leaves
// on the box.
//
//   GET  /api/backup/export     build one now and stream it to the browser
//   GET  /api/backup/list       what is on disk
//   POST /api/backup/run        take one now, keep it here
//   GET  /api/backup/download   fetch one that is already here
//   POST /api/backup/delete     remove one
//   POST /api/backup/offsite-test  prove the bucket paste works, while the owner is still here
//
// All owner-gated by where they are mounted (Invariant 4). What a snapshot IS, and why it
// is built the way it is, lives in `src/server/backup.ts`.

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildArchive, deleteSnapshot, isSnapshotName, lastRunAt, listSnapshots, runBackup,
  snapshotName, snapshotsDir,
} from '@/server/backup'
import { offsiteTest } from '@/server/backup-offsite'
import { logActivity } from '@/server/activity'
import { fail, json } from '@/web/api'
import { ownerRouter } from '@/web/guard'

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function backupRoutes() {
  const router = ownerRouter()

  // ----- take a copy away -----------------------------------------------------

  router.get('/api/backup/export', async (c) => {
    // Built into a temp directory rather than into the snapshots directory: this one is
    // the owner's copy, and leaving it behind would make it count towards retention.
    const stage = await mkdtemp(join(tmpdir(), 'quire-export-'))
    const name = snapshotName()
    const path = join(stage, name)
    try {
      await buildArchive(path)
      // Read fully rather than streaming: the archive has to be complete before the
      // staging directory is removed, and a browser download wants a length anyway.
      const body = await Bun.file(path).arrayBuffer()
      logActivity('backup.export', mb(body.byteLength))
      return new Response(body, {
        headers: {
          'content-type': 'application/gzip',
          'content-disposition': `attachment; filename="${name}"`,
          'content-length': String(body.byteLength),
        },
      })
    } catch (error) {
      console.error(`[ERROR] backup.export: ${(error as Error).message}`)
      return fail(c, 'Could not build the archive', 500)
    } finally {
      await rm(stage, { recursive: true, force: true })
    }
  })

  // ----- the copies kept here -------------------------------------------------

  router.get('/api/backup/list', async () =>
    json({ snapshots: await listSnapshots(), lastRunAt: await lastRunAt() }))

  router.post('/api/backup/run', async (c) => {
    try {
      const snapshot = await runBackup()
      logActivity('backup.run', `${snapshot.name} ${mb(snapshot.size)}`)
      return json({ snapshot })
    } catch (error) {
      console.error(`[ERROR] backup.run: ${(error as Error).message}`)
      return fail(c, 'Could not take the snapshot', 500)
    }
  })

  router.get('/api/backup/download', async (c) => {
    const name = c.req.query('name') ?? ''
    // The name arrives in a query string. Without this it is a path, and a path is a way
    // to read any file this process can reach.
    if (!isSnapshotName(name)) return fail(c, 'Unknown snapshot', 400)

    const file = Bun.file(join(snapshotsDir(), name))
    if (!(await file.exists())) return fail(c, 'Unknown snapshot', 404)
    return new Response(file, {
      headers: {
        'content-type': 'application/gzip',
        'content-disposition': `attachment; filename="${name}"`,
        'content-length': String(file.size),
      },
    })
  })

  router.post('/api/backup/delete', async (c) => {
    const { name } = (await c.req.json().catch(() => ({}))) as { name?: string }
    if (!name || !(await deleteSnapshot(name))) return fail(c, 'Unknown snapshot', 400)
    logActivity('backup.delete', name)
    return json({ deleted: name })
  })

  // One marker object written and deleted. The transport's own words come back on
  // failure, because "test failed" teaches the owner nothing about a wrong endpoint.
  router.post('/api/backup/offsite-test', async (c) => {
    try {
      await offsiteTest()
      return json({ ok: true })
    } catch (error) {
      return fail(c, (error as Error).message, 400)
    }
  })

  return router
}
