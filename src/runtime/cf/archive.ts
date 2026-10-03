// Cloudflare: finished backup archives in the R2 bucket, under `private/backups/` — a prefix the
// blob port refuses to serve (`runtime/blob-reserved.ts`), so `/uploads/…` can never hand one out.
//
// WRITTEN AS A MULTIPART UPLOAD, which is what makes it all or nothing: R2 shows the object only
// when the upload completes, so a failure leaves nothing under the name, the same promise Bun keeps
// with a `.part` file and a rename. It also means the archive streams in parts and never sits whole
// in the Worker's 128 MB.
import type { ArchivePort } from '@/runtime/ports'
import { bound } from './bindings'

const PREFIX = 'private/backups/'
const STAGE = 'private/stage/'
/** R2's smallest part but the last is 5 MiB; a little over keeps every part legal. */
const PART = 8 * 1024 * 1024
/**
 * ⚠️ A CEILING, until the port hands out a stream (G4): `openKept` answers a Blob, and a Blob in a
 * Worker is bytes in memory. Past this an archive is refused with a reason rather than taking the
 * isolate down mid-download.
 */
const MAX_IN_MEMORY = 64 * 1024 * 1024

function safe(name: string): string {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error(`archive: not a plain file name: ${JSON.stringify(name)}`)
  }
  return name
}

async function upload(key: string, body: ReadableStream<Uint8Array>): Promise<number> {
  const bucket = bound().env.BLOBS
  const multipart = await bucket.createMultipartUpload(key)
  const parts: R2UploadedPart[] = []
  let held: Uint8Array[] = []
  let heldBytes = 0
  let size = 0
  const flush = async (): Promise<void> => {
    const chunk = new Uint8Array(heldBytes)
    let at = 0
    for (const c of held) { chunk.set(c, at); at += c.length }
    parts.push(await multipart.uploadPart(parts.length + 1, chunk))
    held = []
    heldBytes = 0
  }
  try {
    for await (const chunk of body) {
      held.push(chunk)
      heldBytes += chunk.length
      size += chunk.length
      if (heldBytes >= PART) await flush()
    }
    if (heldBytes > 0 || parts.length === 0) await flush()
    await multipart.complete(parts)
    return size
  } catch (error) {
    await multipart.abort().catch(() => undefined)
    await body.cancel().catch(() => undefined)
    throw error
  }
}

export const listKept: ArchivePort['listKept'] = async () => {
  const out = []
  let cursor: string | undefined
  do {
    const page = await bound().env.BLOBS.list({ prefix: PREFIX, cursor })
    for (const o of page.objects) out.push({ name: o.key.slice(PREFIX.length), size: o.size, mtimeMs: o.uploaded.getTime() })
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return out
}

export const writeKept: ArchivePort['writeKept'] = (name, body) => upload(PREFIX + safe(name), body)

export const openKept: ArchivePort['openKept'] = async (name) => {
  const object = await bound().env.BLOBS.get(PREFIX + safe(name))
  if (!object) return null
  if (object.size > MAX_IN_MEMORY) {
    await object.body.cancel()
    throw new Error(`archive: ${name} is ${object.size} bytes, more than a Worker can hold to send (G4)`)
  }
  return object.blob()
}

export const removeKept: ArchivePort['removeKept'] = async (name) => {
  await bound().env.BLOBS.delete(PREFIX + safe(name))
}

/** Into the bucket, out of the snapshot list (a staged copy is the owner's, not retention's). */
export const stage: ArchivePort['stage'] = async (name, body) => {
  const bucket = bound().env.BLOBS
  const key = `${STAGE}${crypto.randomUUID()}-${safe(name)}`
  const size = await upload(key, body)
  const object = await bucket.get(key)
  if (!object) throw new Error('archive: the staged copy vanished')
  const sweep = (): void => { void bucket.delete(key) }
  const source = object.body.getReader()
  return {
    size,
    body: new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await source.read()
        if (done) { controller.close(); sweep(); return }
        controller.enqueue(value)
      },
      cancel() { source.cancel().catch(() => {}); sweep() },
    }),
  }
}

void ({ listKept, writeKept, openKept, removeKept, stage } satisfies ArchivePort)
