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

/**
 * Pump a stream into a file, with backpressure both ways. Returns the bytes written.
 *
 * Read with a reader, and its lock never released after the last chunk: a request body straight off
 * Bun's server (a part of an incoming archive) threw "undefined is not a function" from Bun 1.3.14's
 * own `releaseLock` once it was read to its end — which `for await` calls on the way out — where the
 * same body through `app.request` did not (2026-10-03). A stream read to its end needs no release.
 */
async function pump(body: ReadableStream<Uint8Array>, path: string): Promise<number> {
  const writer = Bun.file(path).writer()
  const reader = body.getReader()
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      await writer.write(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
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

/** The file itself: a `BunFile` is a `KeptBody`, read only as it streams, and S3 sends it natively. */
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

// ----- the incoming half: an archive arriving in parts (`server/restore-parts.ts`) -----------------

/**
 * BESIDE THE DATA, not in the system's temporary directory: an archive can be gigabytes, `/tmp` is a
 * small RAM disk on many machines and inside most containers, and the data volume is the one the
 * operator sized for the blog. It also survives a restart, so an upload resumes after one.
 */
export const incomingDir = (): string => resolve(join(process.env.DATA_DIR || './data', 'incoming'))

const partFile = (id: string, part: number): string => join(incomingDir(), safe(id), `${part}.part`)

/** Written beside its name and renamed, so a part cut off mid-way is never counted as held. */
export const holdPart: ArchivePort['holdPart'] = async (id, part, body, size) => {
  const dest = partFile(id, part)
  const temp = `${dest}.${crypto.randomUUID()}.tmp`
  try {
    await mkdir(join(incomingDir(), safe(id)), { recursive: true })
    const written = await pump(body, temp)
    if (written !== size) throw new Error(`incoming: part ${part} was ${written} bytes, not the ${size} it said`)
    await rename(temp, dest)
  } catch (error) {
    await body.cancel().catch(() => undefined)
    await rm(temp, { force: true })
    throw error
  }
}

export const heldParts: ArchivePort['heldParts'] = async (id) => {
  const dir = join(incomingDir(), safe(id))
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const out = []
  for (const name of names) {
    const m = /^(\d+)\.part$/.exec(name)
    if (!m) continue
    try {
      out.push({ part: Number(m[1]), size: (await stat(join(dir, name))).size })
    } catch { /* replaced or dropped between the listing and the stat */ }
  }
  return out.sort((a, b) => a.part - b.part)
}

/** One part after another, as a pull stream: the next file is opened only when the last runs out. */
export const readHeld: ArchivePort['readHeld'] = (id, count) => pulled((async function* () {
  for (let part = 1; part <= count; part++) yield* Bun.file(partFile(id, part)).stream()
})())

function pulled(chunks: AsyncGenerator<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await chunks.next()
      if (next.done) controller.close()
      else controller.enqueue(next.value)
    },
    async cancel() { await chunks.return(undefined) },
  })
}

export const dropHeld: ArchivePort['dropHeld'] = async (id) => {
  await rm(join(incomingDir(), safe(id)), { recursive: true, force: true })
}

export const heldIds: ArchivePort['heldIds'] = async () => {
  try {
    return (await readdir(incomingDir(), { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

void ({ listKept, writeKept, openKept, removeKept, stage, holdPart, heldParts, readHeld, dropHeld, heldIds } satisfies ArchivePort)
