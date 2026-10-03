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
//   POST /api/backup/keys       make the two recipients an archive is sealed to (ADR 0060)
//
// All owner-gated by where they are mounted (Invariant 4). What a snapshot IS, and why it
// is built the way it is, lives in `src/server/backup.ts`.

import {
  deleteSnapshot, encryptReady, isSnapshotName, lastRunAt, listSnapshots, runBackup, snapshotName,
} from '@/server/backup'
import { archiveStream, withArchiveRetry } from '@/server/archive'
import { openKept, stage } from '@/runtime/impl/archive'
import { newIdentity, passphraseRecipient } from '@/server/backup-crypt'
import { getSettings } from '@/content/settings'
import { saveSettings } from '@/content/settings-save'
import { offsiteTest } from '@/server/backup-offsite'
import { buildExportZip, exportName } from '@/server/export-md'
import { logActivity } from '@/server/activity'
import { fail, json } from '@/web/api'
import { ownerRouter, QUIET } from '@/web/guard'
import type { Context } from 'hono'
import type { BackupListWire } from '@/admin-shared/wire'

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function backupRoutes() {
  const router = ownerRouter()

  // ----- take a copy away -----------------------------------------------------

  /**
   * Build a download, hold it until it is whole, then stream it out (`ArchivePort.stage`).
   *
   * ONE of these, for two downloads. The backup archive and the Markdown bundle are different
   * documents answering different questions, but getting them to the browser is the same job,
   * and it is a job with a trap in it that was found the hard way (see below). Two copies of
   * this would be two chances to reintroduce it.
   *
   * Held first rather than piped straight to the response, because the length has to be
   * declared before the first byte — a browser download without one has no progress bar — and
   * because a build that fails halfway must answer 500, not a 200 that stops short. STREAMED
   * from where it is held: reading the whole archive into memory to send it held a second copy
   * of a file the build had just held one of, and on a store near the 5 GB default quota that is
   * the difference between a download and an OOM.
   */
  const streamed = async (
    c: Context,
    kind: string, name: string, type: string,
    build: () => Promise<ReadableStream<Uint8Array>> | ReadableStream<Uint8Array>,
    log: (size: number) => void,
  ) => {
    try {
      const held = await withArchiveRetry(async () => stage(name, await build()))
      log(held.size)
      return new Response(held.body, {
        headers: {
          'content-type': type,
          'content-disposition': `attachment; filename="${name}"`,
          'content-length': String(held.size),
        },
      })
    } catch (error) {
      console.error(`[ERROR] ${kind}: ${(error as Error).message}`)
      // ONE SENTENCE FOR BOTH, and the word is 'download' rather than 'archive': this
      // handler answers for the Markdown bundle too, and a bundle is not an archive.
      return fail(c, 'Could not build the download', 500)
    }
  }

  router.get('/api/backup/export', async (c) => {
    // Asked BEFORE the build rather than sniffed after it, because `streamed` needs the name
    // and the type up front — and the same settings are handed to the builder, so the name and
    // the envelope cannot disagree.
    const settings = await getSettings()
    const sealed = encryptReady(settings)
    return streamed(c, 'backup.export', snapshotName(new Date(), sealed),
      sealed ? 'application/octet-stream' : 'application/gzip',
      () => archiveStream(settings), (size) => logActivity('backup.export', mb(size)))
  })

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
      () => buildExportZip(), (size) => logActivity('export.markdown', mb(size))))

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
  }, QUIET)

  router.get('/api/backup/download', async (c) => {
    const name = c.req.query('name') ?? ''
    // The name arrives in a query string. Without this it is a path, and a path is a way
    // to read any file this process can reach.
    if (!isSnapshotName(name)) return fail(c, 'Unknown snapshot', 400)

    const file = await openKept(name)
    if (!file) return fail(c, 'Unknown snapshot', 404)
    return new Response(file, {
      headers: {
        'content-type': name.endsWith('.enc') ? 'application/octet-stream' : 'application/gzip',
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
  }, QUIET)

  // One marker object written and deleted. The transport's own words come back on
  // failure, because "test failed" teaches the owner nothing about a wrong endpoint.
  router.post('/api/backup/offsite-test', async (c) => {
    try {
      await offsiteTest()
      return json({ ok: true })
    } catch (error) {
      return fail(c, (error as Error).message, 400)
    }
  }, QUIET)

  /**
   * Make the two recipients, and hand the identity over ONCE.
   *
   * ⚠️ THE SECRET IS IN THE ANSWER AND NOWHERE ELSE. It is generated here, returned in this
   * one response and never written down — the `mcp/tokens.ts` bargain, for the same reason:
   * a copy the server keeps is a copy that travels in the very archive it would open.
   *
   * ⚠️ AND THE PASSPHRASE IS NOT STORED EITHER. It is used once, here, to derive a keypair;
   * what is kept is the PUBLIC half and the salt. That is what makes this feature worth having
   * on a machine somebody else might get root on — with the words on disk, an attacker with the
   * box would have the backups too, and the switch would be decoration.
   *
   * Writing both recipients at once is deliberate: an archive sealed to one of them and not the
   * other is an archive with one way in, and the second way in is the whole reason there are two.
   */
  router.post('/api/backup/keys', async (c) => {
    const { passphrase } = (await c.req.json().catch(() => ({}))) as { passphrase?: string }
    if (typeof passphrase !== 'string' || passphrase.trim().length < 12) {
      return fail(c, 'The passphrase needs at least 12 characters', 400)
    }
    const identity = newIdentity()
    const pass = passphraseRecipient(passphrase)
    // The switch is NOT turned on here. Making the keys and deciding to use them are two
    // acts, and the owner has not yet been shown the identity they are about to depend on.
    await saveSettings({
      backups: {
        ...(await getSettings()).backups,
        pubKey: identity.publicKey, passPub: pass.publicKey, passSalt: pass.salt,
      },
    })
    logActivity('backup.keys', 'new recipients')
    return json({ secret: identity.secret, publicKey: identity.publicKey })
  }, QUIET)

  return router
}
