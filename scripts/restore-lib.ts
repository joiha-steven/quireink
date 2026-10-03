// Restoring a backup archive onto disk, with Quire Ink stopped (ADR 0067, ADR 0035).
//
// The command line is `scripts/restore.ts`; this is the work, kept apart because
// `scripts/restore-check.ts` runs exactly it after every tour — the harness that proves a
// backup restores has to walk the owner's path, or it proves that a different path works.
//
// Both formats:
//
//   quire-rows/1   two NEW database files, each built from the archive's own `schema.sql` (the
//                  shape the rows were written in), every row inserted with foreign keys off
//                  and triggers on so the full-text indexes fill, then checked: every table
//                  dumped again must hash to the manifest's digest, `foreign_key_check` finds
//                  nothing and `integrity_check` says ok. The next boot migrates as on any
//                  upgrade.
//   files          every archive written before ADR 0067: `quire.db` and `analytics.db` copied
//                  out, and opened with `integrity_check` before they are put anywhere.
//
// Built in a staging directory beside the data and renamed into place only once all of it has
// passed, so a restore that fails halfway leaves the data directory as it found it.
import { chownSync, closeSync, createWriteStream, existsSync, mkdirSync, openSync, readSync, renameSync, rmSync, statSync } from 'node:fs'
import { once } from 'node:events'
import { dirname, join, relative, resolve } from 'node:path'
import { Database } from 'bun:sqlite'
import { open } from '@/runtime/impl/db'
import type { Connection } from '@/runtime/ports'
import { classify, openArchive, ArchiveFault, type ArchiveKeys } from '@/server/archive-open'
import { readRows, uploadPath, type RowsReport } from '@/server/archive-rows'
import type { TarItem } from '@/server/tar'
import { digestTable, loadTable, planFor } from '@/store/rows'
import type { Kind } from '@/store/db'

export type RestoreOptions = {
  archive: string
  dataDir: string
  uploadsDir: string
  keys?: ArchiveKeys
  /** One line per step, for the command line. Silent by default. */
  say?: (line: string) => void
}

export type RestoreReport = { format: 'rows' | 'files'; sealed: boolean; version: string | null } & RowsReport

const FILES: Record<Kind, string> = { content: 'quire.db', analytics: 'analytics.db' }

/** Copy a stream to a new file, refusing to replace one that exists. */
async function writeNew(path: string, body: AsyncIterable<Uint8Array>): Promise<void> {
  mkdirSync(dirname(path), { recursive: true })
  const out = createWriteStream(path, { flags: 'wx' })
  try {
    for await (const chunk of body) if (!out.write(chunk)) await once(out, 'drain')
  } finally {
    out.end()
    await once(out, 'close')
  }
}

/**
 * Is the file at `path` exactly these bytes? Read as the archive streams them, a chunk at a time,
 * so an upload is never held whole.
 */
async function sameBytes(path: string, size: number, body: AsyncIterable<Uint8Array>): Promise<boolean> {
  if (statSync(path).size !== size) return false
  const fd = openSync(path, 'r')
  try {
    let at = 0
    for await (const chunk of body) {
      const disk = Buffer.alloc(chunk.length)
      if (readSync(fd, disk, 0, chunk.length, at) !== chunk.length || !disk.equals(chunk)) return false
      at += chunk.length
    }
    return at === size
  } finally {
    closeSync(fd)
  }
}

/** The owner of the nearest directory at or above `path` that exists before anything is written. */
function ownerAbove(path: string): { uid: number; gid: number } {
  let dir = resolve(path)
  while (!existsSync(dir) && dirname(dir) !== dir) dir = dirname(dir)
  const { uid, gid } = statSync(dir)
  return { uid, gid }
}

/** `integrity_check` on a raw read-only open: `db.ts`'s `open` would switch the file to WAL first. */
function integrity(path: string): string {
  const raw = new Database(path, { readonly: true })
  try {
    const row = raw.query('pragma integrity_check').get() as { integrity_check?: string } | null
    return row?.integrity_check ?? 'no answer'
  } finally {
    raw.close()
  }
}

export async function restoreArchive(opts: RestoreOptions): Promise<RestoreReport> {
  const say = opts.say ?? (() => {})
  // The `-wal` and `-shm` beside each name too, and not for tidiness. A blog that was killed
  // rather than stopped leaves its write-ahead log behind, and moving `quire.db` aside without it
  // puts the restored file next to the OLD blog's log. SQLite does not check that a log belongs
  // to the file beside it: measured with bun:sqlite, a restored 50-row table opened beside a
  // stale 200-row log came up with the 200 old rows and `integrity_check` said ok. The restore
  // would report success and the blog would serve what it was restored away from.
  for (const file of Object.values(FILES)) {
    for (const name of [file, `${file}-wal`, `${file}-shm`]) {
      if (existsSync(join(opts.dataDir, name))) {
        throw new Error(`${join(opts.dataDir, name)} already exists. A restore builds into an empty data directory; move the old files aside first (${file}, ${file}-wal and ${file}-shm).`)
      }
    }
  }
  // WHO THE FILES BELONG TO, read before anything is created. Run as root — `docker exec`, or a
  // root shell on a systemd box — every file this writes would be root's and the blog's own user
  // could not write its database. Measured in the image: the container came up healthy, pages
  // served, and every write failed with `attempt to write a readonly database`. Whoever owns the
  // data directory is who the blog runs as, so that is who gets them.
  const asRoot = process.getuid?.() === 0
  const dataOwner = ownerAbove(opts.dataDir)
  const uploadsOwner = ownerAbove(opts.uploadsDir)
  const stage = join(opts.dataDir, `.restore-${process.pid}`)
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(stage, { recursive: true })
  const written: string[] = []
  // AN UPLOAD ALREADY THERE WITH THE SAME BYTES IS LEFT AS IT IS. Restoring a blog onto the
  // machine it came from — the bad edit, the bad import — finds every picture of the archive
  // already on disk, and refusing the first of them made the documented procedure fail on any
  // blog that had ever had an upload. Different bytes at the same path still stop the restore:
  // nothing is overwritten, ever.
  const upload = async (pathname: string, size: number, body: AsyncIterable<Uint8Array>): Promise<void> => {
    const dest = join(opts.uploadsDir, pathname)
    if (existsSync(dest)) {
      if (await sameBytes(dest, size, body)) return
      throw new Error(`${dest} already exists with different contents; move the uploads directory aside, or restore into an empty one`)
    }
    await writeNew(dest, body)
    written.push(dest)
  }
  const adopt = (): void => {
    if (!asRoot) return
    if (dataOwner.uid !== 0) {
      chownSync(opts.dataDir, dataOwner.uid, dataOwner.gid)
      for (const file of Object.values(FILES)) chownSync(join(opts.dataDir, file), dataOwner.uid, dataOwner.gid)
    }
    if (uploadsOwner.uid === 0) return
    // Each file, and every directory between it and the uploads root, which `writeNew` made.
    const root = resolve(opts.uploadsDir)
    const below = (dir: string): boolean => { const r = relative(root, dir); return r !== '' && !r.startsWith('..') }
    const dirs = new Set<string>(existsSync(root) ? [root] : [])
    for (const path of written) {
      for (let dir = dirname(resolve(path)); below(dir); dir = dirname(dir)) dirs.add(dir)
      chownSync(path, uploadsOwner.uid, uploadsOwner.gid)
    }
    for (const dir of dirs) chownSync(dir, uploadsOwner.uid, uploadsOwner.gid)
  }
  try {
    const { sealed, items } = await openArchive(Bun.file(opts.archive).stream(), opts.keys)
    say(sealed ? '✓ the archive opened (sealed)' : '✓ the archive opened')
    const kind = await classify(items)
    const report: RestoreReport = kind.format === 'rows'
      ? { format: 'rows', sealed, version: kind.manifest.version, ...await rows(items, kind.manifest, stage, upload, say) }
      : { format: 'files', sealed, version: null, ...await files(items, kind.first, stage, upload, say) }
    for (const file of Object.values(FILES)) renameSync(join(stage, file), join(opts.dataDir, file))
    adopt()
    say(`✓ ${Object.values(FILES).join(' and ')} are in ${opts.dataDir}; ${report.uploads} upload(s) in ${opts.uploadsDir}`)
    return report
  } catch (error) {
    // Leave nothing behind that looks like a restore: not the half-built files, not the uploads.
    for (const path of written) rmSync(path, { force: true })
    throw error
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}

async function rows(
  items: AsyncGenerator<TarItem>, manifest: Parameters<typeof readRows>[1], stage: string,
  upload: (p: string, s: number, b: AsyncIterable<Uint8Array>) => Promise<void>, say: (l: string) => void,
): Promise<RowsReport> {
  say(`  format ${manifest.format}, written by Quire Ink ${manifest.version} at ${manifest.createdAt}`)
  const conns = {} as Record<Kind, Connection>
  for (const kind of ['content', 'analytics'] as const) conns[kind] = open(join(stage, FILES[kind]), kind === 'content' ? 'FULL' : 'NORMAL')
  try {
    const report = await readRows(items, manifest, {
      schema: (kind, sql) => {
        conns[kind].transaction(() => conns[kind].exec(sql))
        // OFF while the rows go in: tables arrive in name order, not in the order their
        // references need. Checked as a whole once they are all in.
        conns[kind].exec('pragma foreign_keys = OFF')
      },
      table: (kind, entry, lines) => loadTable(conns[kind], entry.name, entry.columns, lines),
      upload,
    })
    for (const kind of ['content', 'analytics'] as const) {
      const conn = conns[kind]
      conn.exec('pragma foreign_keys = ON')
      const broken = conn.all<{ table: string }>('pragma foreign_key_check')
      if (broken.length > 0) throw new ArchiveFault(`${FILES[kind]}: ${broken.length} row(s) point at a row that is not there (first in ${broken[0]!.table})`)
      // Dumped again from the file just built: what a restore GOT, not what it was handed.
      for (const t of manifest.databases[kind].tables) {
        const noRowid = conn.one<{ sql: string }>('select sql from sqlite_master where name = ?', t.name)
        const again = digestTable(conn, planFor(conn, t.name, /without\s+rowid\s*$/i.test(noRowid?.sql ?? '')))
        if (again.sha256 !== t.sha256) throw new ArchiveFault(`${FILES[kind]}: ${t.name} does not dump back to the manifest's digest`)
      }
    }
    say(`✓ ${report.tables.length} table(s) rebuilt, each hashing back to the manifest; foreign keys whole`)
    // Back to a single file before it is moved: `open` made it WAL, and a database renamed away
    // from its `-wal` beside it is the torn state this whole procedure exists to avoid. The
    // service sets WAL again when it opens it.
    for (const conn of Object.values(conns)) {
      conn.exec('pragma journal_mode = DELETE')
      conn.close()
    }
    for (const kind of ['content', 'analytics'] as const) {
      const verdict = integrity(join(stage, FILES[kind]))
      if (verdict !== 'ok') throw new ArchiveFault(`${FILES[kind]} fails integrity_check: ${verdict}`)
    }
    say('✓ both rebuilt databases pass integrity_check')
    return report
  } finally {
    // Closing twice is harmless; closing never is a held file on Windows and a leaked handle anywhere.
    for (const conn of Object.values(conns)) { try { conn.close() } catch { /* already closed */ } }
  }
}

/** An archive from before ADR 0067: two database files, then the uploads tree. */
async function files(
  items: AsyncGenerator<TarItem>, first: TarItem, stage: string,
  upload: (p: string, s: number, b: AsyncIterable<Uint8Array>) => Promise<void>, say: (l: string) => void,
): Promise<RowsReport> {
  say('  format: database files (an archive written before quire-rows/1)')
  const report: RowsReport = { tables: [], uploads: 0, bytes: 0 }
  const take = async (item: TarItem): Promise<void> => {
    const name = item.name.replace(/^\.\//, '')
    const base = name.split('/').pop() ?? ''
    // Directories, and the `._name` resource forks a Mac's tar adds beside every file it packs.
    if (item.kind !== 'file' || base.startsWith('._')) return
    if (name === 'quire.db' || name === 'analytics.db') return writeNew(join(stage, name), item.body())
    // The tree went in under the uploads directory's OWN name (`tar -C <parent> <name>`), which
    // is `uploads` on every documented install and was whatever `STORAGE_LOCAL_DIR` ended in.
    if (!name.includes('/')) return
    const path = uploadPath(`uploads/${name.split('/').slice(1).join('/')}`)
    if (path === null) return
    await upload(path, item.size, item.body())
    report.uploads++
    report.bytes += item.size
  }
  await take(first)
  for await (const item of items) await take(item)
  for (const file of Object.values(FILES)) {
    const path = join(stage, file)
    if (!existsSync(path)) throw new ArchiveFault(`the archive carries no ${file}`)
    const verdict = integrity(path)
    if (verdict !== 'ok') throw new ArchiveFault(`${file} fails integrity_check: ${verdict}`)
  }
  say('✓ both databases pass integrity_check')
  return report
}
