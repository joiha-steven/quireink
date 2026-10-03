// Bun: where finished backup archives live, a directory on the box (ADR 0067). What an archive
// IS is `server/archive.ts`, and the schedule and retention are `server/backup.ts`; this is the
// part that needs a disk.
import { mkdir, mkdtemp, readdir, rename, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import type { ArchivePort } from '@/runtime/ports'

/** Beside the data by default, so one volume holds both. Read at use: the tests move it. */
export const snapshotsDir = (): string =>
  resolve(process.env.BACKUP_DIR || join(process.env.DATA_DIR || './data', 'backups'))

/**
 * A name and nothing else. `isSnapshotName` has already been asked by the caller; this is the
 * second lock on the same door, because a path that reaches `rm` is not worth one mistake.
 */
function safe(name: string): string {
  if (name === '' || name !== basename(name) || name.includes('..') || /[\\/]/.test(name)) {
    throw new Error(`archive: not a plain file name: ${JSON.stringify(name)}`)
  }
  return name
}

/** Pump a stream into a file, with backpressure both ways. Returns the bytes written. */
async function pump(body: ReadableStream<Uint8Array>, path: string): Promise<number> {
  const writer = Bun.file(path).writer()
  let size = 0
  try {
    for await (const chunk of body) {
      size += chunk.length
      await writer.write(chunk)
    }
  } finally {
    await writer.end()
  }
  return size
}

export const listKept: ArchivePort['listKept'] = async () => {
  const dir = snapshotsDir()
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return [] // no directory yet is no snapshots, not an error
  }
  const out = []
  for (const name of names) {
    try {
      const info = await stat(join(dir, name))
      if (info.isFile()) out.push({ name, size: info.size, mtimeMs: info.mtimeMs })
    } catch { /* vanished between the listing and the stat */ }
  }
  return out
}

/**
 * WRITTEN BESIDE ITS NAME, then renamed: a failure removes only its own `.part`, never a
 * finished snapshot that happens to share the name, and `.part` is not a snapshot name, so a
 * half-written one is never listed, pruned into retention or offered for download.
 */
export const writeKept: ArchivePort['writeKept'] = async (name, body) => {
  const dir = snapshotsDir()
  const dest = join(dir, safe(name))
  const part = `${dest}.part`
  try {
    await mkdir(dir, { recursive: true })
    const size = await pump(body, part)
    await rename(part, dest)
    return size
  } catch (error) {
    await body.cancel().catch(() => undefined)
    await rm(part, { force: true })
    throw error
  }
}

export const openKept: ArchivePort['openKept'] = async (name) => {
  const file = Bun.file(join(snapshotsDir(), safe(name)))
  return (await file.exists()) ? file : null
}

export const removeKept: ArchivePort['removeKept'] = async (name) => {
  await rm(join(snapshotsDir(), safe(name)), { force: true })
}

/**
 * A temporary directory rather than the snapshots directory: this copy is the owner's, and
 * leaving it there would count it towards retention. Swept when the body ends or is cancelled.
 */
export const stage: ArchivePort['stage'] = async (name, body) => {
  const dir = await mkdtemp(join(tmpdir(), 'quire-export-'))
  const sweep = (): void => { void rm(dir, { recursive: true, force: true }) }
  try {
    const path = join(dir, safe(name))
    const size = await pump(body, path)
    const source = Bun.file(path).stream().getReader()
    const out = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await source.read()
        if (done) { controller.close(); sweep(); return }
        controller.enqueue(value)
      },
      // A reader who cancels the download still gets the temporary directory back.
      cancel() { source.cancel().catch(() => {}); sweep() },
    })
    return { size, body: out }
  } catch (error) {
    await body.cancel().catch(() => undefined)
    sweep()
    throw error
  }
}

void ({ listKept, writeKept, openKept, removeKept, stage } satisfies ArchivePort)
