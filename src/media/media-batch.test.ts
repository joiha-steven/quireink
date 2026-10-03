// A batch upload is all or nothing (2026-09-30). A later file refused used to leave the
// earlier ones' blobs on disk with no row: counted against the quota, listed nowhere.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import sharp from 'sharp'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { addMediaBatch } from '@/media/media'

const DIR = './.tmp/test-media-batch'
const STORE = `${DIR}-uploads`
freshDatabase(DIR)
process.env.STORAGE_LOCAL_DIR = STORE
afterAll(() => {
  dropDatabase(DIR)
  rmSync(STORE, { recursive: true, force: true })
  delete process.env.STORAGE_LOCAL_DIR
})
beforeEach(() => db().run(`delete from media`))

describe('a batch with one file refused', () => {
  it('keeps no row and no bytes of the files before it', async () => {
    const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ccc' } }).png().toBuffer()
    const body = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer
    await expect(addMediaBatch([
      { filename: 'kept.png', body, contentType: 'image/png' },
      { filename: 'nope.exe', body: new ArrayBuffer(4), contentType: 'application/x-msdownload' },
    ])).rejects.toThrow('Unsupported')
    expect(db().query(`select count(*) as n from media`).get()).toEqual({ n: 0 })
    expect(existsSync(`${STORE}/media/kept.png`)).toBe(false)
    expect(existsSync(`${STORE}/media/kept-thumb.webp`)).toBe(false)
  })
})
