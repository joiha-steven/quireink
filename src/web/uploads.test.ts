// GET /uploads/*, over real HTTP against a real file on disk.
//
// The range cases are the ones worth having. Video seeking needs 206 responses and iOS
// Safari will not play a video at all without them, so a regression here looks like
// "video is broken on iPhone" rather than like a failing test.

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { resolveSafe } from '@/media/blob-local'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'

// `blob-local` resolves its root ONCE, at module load, so setting STORAGE_LOCAL_DIR from a
// test is too late: the import is hoisted and the constant is already fixed. So the fixture
// goes into the real configured store, under a directory this file creates and removes.
// `resolveSafe` is the only way to ask the driver where that is.
const FIXTURE_DIR = '.test-uploads'
const ROOT = dirname(resolveSafe(`${FIXTURE_DIR}/probe`))
const FILE = `${FIXTURE_DIR}/photo.jpg`

// The router's catch-all `/:slug` reads posts, so a request that falls through to it needs
// an open database. Without one the traversal test fails with a confusing db error rather
// than the 404 it is actually asserting.
const DB_DIR = './.tmp/test-uploads-db'
freshDatabase(DB_DIR)
afterAll(() => dropDatabase(DB_DIR))

const app = createApp()
const get = async (path: string, headers?: Record<string, string>): Promise<Response> =>
  app.request(path, headers ? { headers } : undefined)

const BODY = 'abcdefghij' // ten bytes, so ranges are easy to read

beforeAll(() => {
  mkdirSync(ROOT, { recursive: true })
  writeFileSync(resolveSafe(FILE), BODY)
})
// Removes only the directory this file created, never the store around it.
afterAll(() => rmSync(ROOT, { recursive: true, force: true }))

describe('GET /uploads/*', () => {
  it('serves the whole file with its type and an immutable cache', async () => {
    const res = await get(`/uploads/${FILE}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('content-length')).toBe('10')
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    // Upload names are content-stable, so caching one forever is safe. This is why media
    // never needs a cache bust.
    expect(res.headers.get('cache-control')).toContain('immutable')
    expect(await res.text()).toBe(BODY)
  })

  it('answers a byte range with 206 and only those bytes', async () => {
    const res = await get(`/uploads/${FILE}`, { range: 'bytes=2-5' })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 2-5/10')
    expect(res.headers.get('content-length')).toBe('4')
    expect(await res.text()).toBe('cdef')
  })

  it('answers an open-ended range', async () => {
    const res = await get(`/uploads/${FILE}`, { range: 'bytes=7-' })
    expect(res.status).toBe(206)
    expect(await res.text()).toBe('hij')
  })

  it('rejects a range past the end with 416, not with the whole file', async () => {
    const res = await get(`/uploads/${FILE}`, { range: 'bytes=50-60' })
    expect(res.status).toBe(416)
    expect(res.headers.get('content-range')).toBe('bytes */10')
  })

  it('404s a file that is not there', async () => {
    expect((await get(`/uploads/${FIXTURE_DIR}/missing.jpg`)).status).toBe(404)
  })

  it('refuses to walk out of the store', async () => {
    // PERCENT-ENCODED, on purpose. A literal `/uploads/../../package.json` is normalised
    // away by the URL parser before the router sees it, so a test written that way passes
    // without the handler ever running and proves nothing. Encoded, it arrives intact and
    // `resolveSafe` inside the driver is what has to reject it.
    for (const attempt of [
      '/uploads/%2e%2e%2f%2e%2e%2fpackage.json',
      '/uploads/..%2f..%2fpackage.json',
    ]) {
      const res = await get(attempt)
      expect(res.status).toBe(404)
      expect(await res.text()).not.toContain('"devDependencies"')
    }
  })
})
