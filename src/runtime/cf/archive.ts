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
const INCOMING = 'private/incoming/'
/** R2's smallest part but the last is 5 MiB; a little over keeps every part legal. */
const PART = 8 * 1024 * 1024

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

/**
 * A `head` now and a `get` per `stream()`, so nothing is read until something reads it — and then a
 * chunk at a time. Until G4 this answered `object.blob()`, the whole archive in the isolate's 128 MB,
 * and refused one past 64 MB rather than run out mid-download. Measured under `wrangler dev`
 * (2026-10-03, `cloudflare-dev.ts` with BIG=1): a 123.7 MB snapshot downloaded in 0.9 s and copied
 * off-site in 8 parts in 5.6 s, the isolate's live heap (collected, sampled every 100 ms) never above
 * the 55–127 MB it started each step at; a Blob would have added the 123.7 MB to it.
 */
export const openKept: ArchivePort['openKept'] = async (name) => {
  const key = PREFIX + safe(name)
  const head = await bound().env.BLOBS.head(key)
  if (!head) return null
  return { size: head.size, stream: () => objectStream(key, head.size, `archive: ${name} went away before it was read`) }
}

/**
 * An R2 object's body as a stream returned at once, the `get` made on the first read. Through a
 * `FixedLengthStream`, because workerd sends a response whose body is a stream of unknown length
 * chunked and DROPS the `Content-Length` the route set — measured under `wrangler dev`, the download
 * arrived whole with no length, which is a browser download with no progress bar.
 */
function objectStream(key: string, size: number, missing: string): ReadableStream<Uint8Array> {
  const { readable, writable } = new FixedLengthStream(size)
  void (async () => {
    const object = await bound().env.BLOBS.get(key)
    if (!object) return writable.abort(new Error(missing))
    await object.body.pipeTo(writable)
  })().catch((error: unknown) => writable.abort(error).catch(() => undefined))
  return readable
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
  const swept = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await source.read()
      if (done) { controller.close(); sweep(); return }
      controller.enqueue(value)
    },
    cancel() { source.cancel().catch(() => {}); sweep() },
  })
  // Known length, so the download says how big it is (see `objectStream`).
  return { size, body: swept.pipeThrough(new FixedLengthStream(size)) }
}

// ----- the incoming half: an archive arriving in parts (`server/restore-parts.ts`) -----------------
//
// ONE OBJECT PER PART, not an R2 multipart upload. Resuming needs "which parts do you have, and how
// big", and the binding has no ListParts: a multipart upload would have needed its part list kept
// somewhere beside it, in the database the load is about to fill. A listing of `<id>/` answers the
// question, a part sent twice simply replaces itself, and the parts need not share one size the way
// R2's multipart parts must. The load reads them back in order, which is the same one pass a
// completed multipart object would have been read in.

const partKey = (id: string, part: number): string => `${INCOMING}${safe(id)}/${String(part).padStart(5, '0')}`

/**
 * Streamed straight into R2 with its length declared: a part is up to 64 MB, half the isolate, and
 * is never held. `FixedLengthStream` is what lets R2 take a stream (it needs the length up front),
 * and it also errors when the body ends short or runs long — R2 then keeps nothing, which is the
 * all-or-nothing the port promises.
 */
export const holdPart: ArchivePort['holdPart'] = async (id, part, body, size) => {
  const fixed = new FixedLengthStream(size)
  const piped = body.pipeTo(fixed.writable)
  try {
    await Promise.all([bound().env.BLOBS.put(partKey(id, part), fixed.readable), piped])
  } catch (error) {
    await body.cancel().catch(() => undefined)
    throw new Error(`incoming: part ${part} did not arrive whole (${(error as Error).message})`)
  }
}

async function listUnder(prefix: string): Promise<R2Object[]> {
  const out: R2Object[] = []
  let cursor: string | undefined
  do {
    const page = await bound().env.BLOBS.list({ prefix, cursor })
    out.push(...page.objects)
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return out
}

export const heldParts: ArchivePort['heldParts'] = async (id) =>
  (await listUnder(`${INCOMING}${safe(id)}/`))
    .map((o) => ({ part: Number(o.key.slice(o.key.lastIndexOf('/') + 1)), size: o.size }))
    .filter((p) => Number.isInteger(p.part) && p.part > 0)
    .sort((a, b) => a.part - b.part)

/** One part after another, as a pull stream: the next object is asked for only when the last runs out. */
export const readHeld: ArchivePort['readHeld'] = (id, count) => pulled((async function* () {
  for (let part = 1; part <= count; part++) {
    const object = await bound().env.BLOBS.get(partKey(id, part))
    if (!object) throw new Error(`incoming: part ${part} of ${count} is missing`)
    const reader = object.body.getReader()
    let ended = false
    try {
      for (;;) {
        const next = await reader.read()
        if (next.done) { ended = true; break }
        yield next.value
      }
    } finally {
      // Left part-way (the load failed, or the reader went): let R2 stop sending this part.
      if (!ended) await reader.cancel().catch(() => undefined)
    }
  }
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
  const keys = (await listUnder(`${INCOMING}${safe(id)}/`)).map((o) => o.key)
  // R2 deletes up to 1,000 keys in one call.
  for (let i = 0; i < keys.length; i += 1000) await bound().env.BLOBS.delete(keys.slice(i, i + 1000))
}

export const heldIds: ArchivePort['heldIds'] = async () => {
  const ids = new Set<string>()
  for (const o of await listUnder(INCOMING)) ids.add(o.key.slice(INCOMING.length).split('/')[0]!)
  return [...ids]
}

void ({ listKept, writeKept, openKept, removeKept, stage, holdPart, heldParts, readHeld, dropHeld, heldIds } satisfies ArchivePort)
