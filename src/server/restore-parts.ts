// A backup arriving in parts, for an archive larger than one request may carry (G4).
//
// Cloudflare refuses a request body over 100 MB before the Worker sees it, and a proxy in front of a
// Bun install often refuses far less; an archive with a few years of pictures is gigabytes. So the
// file goes up in numbered parts, each its own request, the store keeps them (`ArchivePort`'s
// incoming half: files beside the data on Bun, `private/` objects in R2 on Cloudflare), and one
// last request loads them, read back in order as one stream, through the same
// `loadBackupIntoEmptyBlog` the single-request form uses. Nothing ever holds the archive whole.
// The routes are `web/setup-restore-parts.ts`; the HTTP API is written out in `docs/backups.md`.
//
// NO STATE BUT THE PARTS. The id carries when the upload began and how many bytes it will be, so
// nothing has to be remembered between requests — which on Cloudflare is not a convenience: a
// Durable Object can be evicted between two parts, and anything kept in memory goes with it. A
// part sent twice replaces itself, and asking which parts are held is how an upload resumes.
import { randomBytes } from 'node:crypto'
import { dropHeld, heldIds, heldParts, holdPart, readHeld } from '@/runtime/impl/archive'
import type { HeldPart } from '@/runtime/ports'

/** What the page sends a part as; the server takes anything from 1 byte to `MAX_PART_BYTES`. */
export const PART_BYTES = 16 * 1024 * 1024
/**
 * The most one part may be: under Cloudflare's 100 MB body limit with room to spare, and streamed
 * straight to the store on both runtimes, so it is never in memory either.
 */
export const MAX_PART_BYTES = 64 * 1024 * 1024
/** Parts are numbered 1 to this. At 16 MiB that is 160 GB, beyond any blog's storage. */
export const MAX_PARTS = 10_000
/**
 * Past this the browser sends the file in parts; at or under it, the one request it always sent
 * (which also works with JavaScript off). Half Cloudflare's limit, so a sealed archive's framing
 * and a form's wrapping never push a file that looked small enough over it.
 */
export const CHUNK_ABOVE_BYTES = 48 * 1024 * 1024
/** An upload nobody has finished is swept this long after it began. */
export const PARTS_TTL_MS = 24 * 60 * 60_000

export type PartsId = { id: string; begunAt: number; size: number }

/** `<when began, base 36>-<total bytes, base 36>-<32 hex>`: a name and nothing else. */
const ID = /^([0-9a-z]{1,11})-([0-9a-z]{1,11})-([0-9a-f]{32})$/

/** The id, read back, or null for anything this module did not make. */
export function parsePartsId(id: string): PartsId | null {
  const m = ID.exec(id)
  if (!m) return null
  const begunAt = parseInt(m[1]!, 36)
  const size = parseInt(m[2]!, 36)
  if (!Number.isSafeInteger(begunAt) || !Number.isSafeInteger(size) || size < 1) return null
  return { id, begunAt, size }
}

/** Expired, or never made here: either way it is not an upload anything may add to. */
export const partsLive = (p: PartsId, now = Date.now()): boolean => now - p.begunAt < PARTS_TTL_MS && p.begunAt <= now + 60_000

/** A new upload of `size` bytes. Sweeps the abandoned ones first, so a retried upload replaces them. */
export async function beginParts(size: number, now = Date.now()): Promise<PartsId> {
  await sweepParts(now)
  const id = `${now.toString(36)}-${size.toString(36)}-${randomBytes(16).toString('hex')}`
  return { id, begunAt: now, size }
}

export class PartRefusal extends Error {
  constructor(readonly code: 'unknown' | 'part-number' | 'part-size' | 'too-much' | 'incomplete', readonly detail = '') {
    super(code)
  }
}

/** Part `part` of the upload, `size` bytes, from `body`. Refuses what could not be part of it. */
export async function putPart(p: PartsId, part: number, size: number, body: ReadableStream<Uint8Array>): Promise<HeldPart> {
  if (!partsLive(p)) throw new PartRefusal('unknown')
  if (!Number.isInteger(part) || part < 1 || part > MAX_PARTS) throw new PartRefusal('part-number', String(part))
  if (!Number.isInteger(size) || size < 1 || size > MAX_PART_BYTES || size > p.size) throw new PartRefusal('part-size', String(size))
  // The parts already held plus this one may not come to more than the upload said it was: a
  // client that keeps sending is refused at the declared size, not at the disk's.
  const held = (await heldParts(p.id)).filter((h) => h.part !== part).reduce((n, h) => n + h.size, 0)
  if (held + size > p.size) throw new PartRefusal('too-much', String(held + size))
  await holdPart(p.id, part, body, size)
  return { part, size }
}

/** What is held so far, for a client resuming after a dropped connection or a reload. */
export async function partsStatus(p: PartsId): Promise<{ id: string; size: number; held: number; parts: HeldPart[] }> {
  const parts = await heldParts(p.id)
  return { id: p.id, size: p.size, held: parts.reduce((n, h) => n + h.size, 0), parts }
}

/**
 * The whole archive as one stream, once parts 1..n are all held and come to exactly the declared
 * size. A gap or a short total is refused with what is missing, before a byte is loaded.
 */
export async function assembled(p: PartsId): Promise<AsyncIterable<Uint8Array>> {
  if (!partsLive(p)) throw new PartRefusal('unknown')
  const parts = await heldParts(p.id)
  const total = parts.reduce((n, h) => n + h.size, 0)
  const gap = parts.findIndex((h, i) => h.part !== i + 1)
  if (parts.length === 0 || gap !== -1 || total !== p.size) {
    const missing = gap === -1 ? parts.length + 1 : gap + 1
    throw new PartRefusal('incomplete', `${total} of ${p.size} bytes held; part ${missing} is the first missing`)
  }
  return chunks(readHeld(p.id, parts.length))
}

/** A stream read as an async iterable, by hand: not every runtime's stream is iterable itself. */
async function* chunks(stream: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      yield value
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

export const dropParts = (p: PartsId): Promise<void> => dropHeld(p.id)

/**
 * Every upload begun more than a day ago, and anything in the store this module could not have
 * named. Run when a new upload begins and from the hourly tick, so parts left behind by a person who
 * closed the tab — or who claimed the blog the other way — do not sit in the store for ever.
 */
export async function sweepParts(now = Date.now()): Promise<number> {
  let swept = 0
  for (const id of await heldIds()) {
    const p = parsePartsId(id)
    if (p && partsLive(p, now)) continue
    await dropHeld(id)
    swept += 1
  }
  return swept
}
