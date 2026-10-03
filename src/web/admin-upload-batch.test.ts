// A batch upload holds one file's bytes at a time beside the form, not the whole batch twice.
//
// Both batch routes read every file whole before writing the first: `/api/media/upload` in its
// validation loop, keeping every buffer, and `/api/files/attach` in a `Promise.all`. On Cloudflare
// that is a 25 MB form and a 25 MB copy of it in a 128 MB isolate. These cases watch every full
// read of a file and note how many files the store held at that moment: read one at a time, the
// k-th file is read once the files before it are written. The old routes read them all first.
//
// And the variants of a fresh upload are made from the original the request wrote, not from a
// second read of it from the store: removing it from the store under the request proves it.
import { describe, it, expect, beforeEach, afterAll, afterEach } from 'bun:test'
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { addMediaBatch } from '@/media/media'
import { finalizeVariants } from '@/media/finalize'

const DIR = './.tmp/test-admin-upload-batch'
const STORE = './.tmp/test-admin-upload-batch-store'
process.env.STORAGE_LOCAL_DIR = STORE
try { rmSync(STORE, { recursive: true, force: true }) } catch { /* first run */ }
freshDatabase(DIR)
afterAll(() => {
  dropDatabase(DIR)
  try { rmSync(STORE, { recursive: true, force: true }) } catch { /* test hygiene only */ }
})

const app = createApp()
let cookie = ''
beforeEach(async () => {
  for (const t of ['sessions', 'users', 'media', 'files', 'activity_log']) db().run(`delete from ${t}`)
  try { rmSync(STORE, { recursive: true, force: true }) } catch { /* nothing yet */ }
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'owner', email: 'o@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})

const stored = (): number => {
  if (!existsSync(STORE)) return 0
  const walk = (d: string): number => readdirSync(d).reduce((n, f) => n + (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : 1), 0)
  return walk(STORE)
}

/** Every `arrayBuffer()` of `size` bytes or more, and how many files were stored when it began. */
const reads: number[] = []
const original = Blob.prototype.arrayBuffer
let watchFrom = Infinity
Blob.prototype.arrayBuffer = function (this: Blob) {
  if (this.size >= watchFrom) reads.push(stored())
  return original.call(this)
}
afterEach(() => {
  reads.length = 0
  watchFrom = Infinity
})

/** A noisy PNG, so it is well past the bytes the sniffer reads and every copy is a real one. */
function png(seed: number): Promise<Buffer> {
  let x = seed * 2654435761 >>> 0
  const pixels = Buffer.alloc(64 * 64 * 3)
  for (let i = 0; i < pixels.length; i++) pixels[i] = (x = (x * 1103515245 + 12345) >>> 0) >>> 24
  return sharp(pixels, { raw: { width: 64, height: 64, channels: 3 } }).png().toBuffer()
}

const post = (path: string, files: { name: string; type: string; bytes: Buffer }[]) => {
  const form = new FormData()
  for (const f of files) form.append('file', new File([new Uint8Array(f.bytes)], f.name, { type: f.type }), f.name)
  return app.request(path, { method: 'POST', body: form, headers: { cookie, 'sec-fetch-site': 'same-origin' } })
}

describe('a batch upload', () => {
  it('attaches files one at a time: each is read once the ones before it are written', async () => {
    const bytes = Buffer.alloc(40_000, 7)
    watchFrom = bytes.length
    const res = await post('/api/files/attach', ['a', 'b', 'c'].map((n) => ({ name: `${n}.bin`, type: 'application/octet-stream', bytes })))
    expect(res.status).toBe(201)
    expect(reads).toEqual([0, 1, 2])
  })

  it('takes pictures one at a time, sniffing each from its first bytes only', async () => {
    const pictures = await Promise.all([1, 2, 3].map(png))
    watchFrom = Math.min(...pictures.map((p) => p.length))
    expect(watchFrom).toBeGreaterThan(1024)
    const res = await post('/api/media/upload', pictures.map((bytes, i) => ({ name: `p${i}.png`, type: 'image/png', bytes })))
    expect(res.status).toBe(201)
    // An original and its thumbnail per picture before the next is read.
    expect(reads).toEqual([0, 2, 4])
  })
})

describe('the variants of a fresh upload', () => {
  it('are made from the original the request wrote, not read back from the store, and the same bytes', async () => {
    const picture = sharp({ create: { width: 2600, height: 400, channels: 3, background: '#c63' } }).jpeg()
    const body = (await picture.toBuffer()).buffer as ArrayBuffer
    const kept = new Map<string, Buffer>()
    const [item] = await addMediaBatch([{ filename: 'wide.jpg', body, contentType: 'image/jpeg' }], kept)
    const path = item!.url.replace(/^.*?(media\/)/, '$1')
    expect(kept.has(path)).toBe(true) // capped from 2600 px, so a new, smaller picture worth keeping
    const stem = path.replace(/^media\//, '').replace(/\.[^.]+$/, '')

    // The reference: variants made the old way, from the store.
    expect(await finalizeVariants([path])).toBe(1)
    const variants = readdirSync(join(STORE, 'media')).filter((f) => f.startsWith(stem) && /-\d+\.(webp|avif)$/.test(f)).sort()
    const reference = variants.map((f) => readFileSync(join(STORE, 'media', f)))

    // Now with the original gone from the store: only the bytes in hand can make them.
    db().run(`update media set variants = 0 where path = ?`, [path])
    for (const f of variants) rmSync(join(STORE, 'media', f))
    rmSync(join(STORE, path))
    expect(await finalizeVariants([path], Infinity, kept)).toBe(1)
    expect(kept.size).toBe(0) // let go once used
    const again = variants.map((f) => readFileSync(join(STORE, 'media', f)))
    expect(again.map((b, i) => b.equals(reference[i]!))).toEqual(variants.map(() => true))
  }, 30_000)
})
