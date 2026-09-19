// The backup routes: the archive the owner takes by hand, and the ones the schedule leaves
// on the box.
//
//   GET  /api/backup/export     build one now and stream it to the browser
//   GET  /api/export/markdown   the WRITING, as Markdown — a different question (export-md.ts)
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
import { buildExportZip, exportName } from '@/server/export-md'
import { logActivity } from '@/server/activity'
import { fail, json } from '@/web/api'
import { ownerRouter } from '@/web/guard'
import type { Context } from 'hono'
import type { BackupListWire } from '@/admin-shared/wire'

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function backupRoutes() {
  const router = ownerRouter()

  // ----- take a copy away -----------------------------------------------------

  /**
   * Build a file into a staging directory, stream it out, and sweep when the stream ends.
   *
   * ONE of these, for two downloads. The backup archive and the Markdown bundle are different
   * documents answering different questions, but getting them to the browser is the same job,
   * and it is a job with a trap in it that was found the hard way (see below). Two copies of
   * this would be two chances to reintroduce it.
   */
  const streamed = async (
    c: Context,
    kind: string, name: string, type: string,
    build: (path: string) => Promise<unknown>,
    log: (size: number) => void,
  ) => {
    // A temp directory rather than the snapshots directory: this one is the owner's copy, and
    // leaving it behind would make it count towards retention.
    const stage = await mkdtemp(join(tmpdir(), 'quire-export-'))
    const path = join(stage, name)
    try {
      await build(path)
      // STREAMED, with the staging directory swept when the stream ends. Reading the whole
      // archive into memory to send it meant the export held a second copy of a file the
      // build had just held one of; on a store near the 5 GB default quota that is the
      // difference between a download and an OOM. The length is still declared, because a
      // browser download without one has no progress bar.
      const file = Bun.file(path)
      const size = file.size
      const sweep = () => { void rm(stage, { recursive: true, force: true }) }
      const source = file.stream().getReader()
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          const { done, value } = await source.read()
          if (done) { controller.close(); sweep(); return }
          controller.enqueue(value)
        },
        // A reader who cancels the download still gets their temp directory back.
        cancel() { source.cancel().catch(() => {}); sweep() },
      })
      log(size)
      return new Response(body, {
        headers: {
          'content-type': type,
          'content-disposition': `attachment; filename="${name}"`,
          'content-length': String(size),
        },
      })
    } catch (error) {
      // NO `finally`, and that is the trap: the response body is a stream that is read AFTER
      // this handler returns, so sweeping here would delete the file out from under the
      // download. The stream sweeps when it ends or is cancelled; this catches the case where
      // there is no stream because the build threw.
      await rm(stage, { recursive: true, force: true })
      console.error(`[ERROR] ${kind}: ${(error as Error).message}`)
      // ONE SENTENCE FOR BOTH, and the word is 'download' rather than 'archive': this
      // handler now answers for the Markdown bundle too, and a bundle is not an archive.
      return fail(c, 'Could not build the download', 500)
    }
  }

  router.get('/api/backup/export', async (c) =>
    streamed(c, 'backup.export', snapshotName(), 'application/gzip',
      (path) => buildArchive(path), (size) => logActivity('backup.export', mb(size))))

  /**
   * THE WRITING, NOT THE INSTALL.
   *
   * Beside the backup because that is where an owner looks for "give me my things", and
   * separate from it because they are not the same thing: the archive above restores this
   * blog and nothing else can read it, and this one is Markdown that every static site
   * generator, every editor and every person can. `server/export-md.ts` says what is in it.
   */
  router.get('/api/export/markdown', async (c) =>
    streamed(c, 'export.markdown', exportName(), 'application/zip',
      (path) => buildExportZip(path), (size) => logActivity('export.markdown', mb(size))))

  // ----- the copies kept here -------------------------------------------------

  router.get('/api/backup/list', async () => {
    // Annotated so the island's reader and this builder cannot drift; see `admin-shared/wire.ts`.
    const payload: BackupListWire = { snapshots: await listSnapshots(), lastRunAt: await lastRunAt() }
    return json(payload)
  })

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
