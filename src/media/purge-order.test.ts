// Purging the Trash takes the bytes before the row (2026-11-04). The row went first and a blob
// delete that failed was swallowed, so the bytes stayed with nothing pointing at them: counted
// against the quota (the store walk counts every blob), listed nowhere, and out of reach of a
// second purge. Now a row whose bytes did not all go stays in the Trash, and purging it again
// finishes the job; a delete of bytes already gone is a no-op on both runtimes.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { chmodSync, existsSync, rmSync } from 'node:fs'
import sharp from 'sharp'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { addMediaBatch, deleteMediaBatch, getTrashedMedia, purgeMediaBatch } from '@/media/media'
import { addFilesBatch, deleteFilesBatch, getTrashedFiles, purgeFilesBatch } from '@/media/files'
import { forgetStorageStats, storageStats } from '@/media/storage-stats'

const DIR = './.tmp/test-purge-order'
const STORE = `${DIR}-uploads`
freshDatabase(DIR)
process.env.STORAGE_LOCAL_DIR = STORE
afterAll(() => {
  for (const d of ['media', 'files']) if (existsSync(`${STORE}/${d}`)) chmodSync(`${STORE}/${d}`, 0o755)
  dropDatabase(DIR)
  rmSync(STORE, { recursive: true, force: true })
  delete process.env.STORAGE_LOCAL_DIR
})
beforeEach(() => { db().run(`delete from media`); db().run(`delete from files`) })

/** The blob delete fails for everything under `dir` while `during` runs: a directory nobody may unlink in. */
async function undeletable(dir: string, during: () => Promise<void>): Promise<void> {
  chmodSync(`${STORE}/${dir}`, 0o555)
  try { await during() } finally { chmodSync(`${STORE}/${dir}`, 0o755) }
}

const storeBytes = async () => { forgetStorageStats(); return (await storageStats()).totalBytes }

// Root unlinks through a read-only directory, so the failure cannot be made that way there.
const asRoot = process.getuid?.() === 0

describe('a purge whose blob delete fails', () => {
  it.skipIf(asRoot)('keeps the picture in the Trash, and a second purge takes it', async () => {
    const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ccc' } }).png().toBuffer()
    const [item] = await addMediaBatch([{ filename: 'kept.png', body: png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer, contentType: 'image/png' }])
    await deleteMediaBatch([item!.url])
    await undeletable('media', () => purgeMediaBatch([item!.url]))
    expect(existsSync(`${STORE}/media/kept.png`)).toBe(true)
    expect((await getTrashedMedia()).map((m) => m.url)).toEqual([item!.url])

    await purgeMediaBatch([item!.url])
    expect(await getTrashedMedia()).toEqual([])
    expect(existsSync(`${STORE}/media/kept.png`)).toBe(false)
    expect(existsSync(`${STORE}/media/kept-thumb.webp`)).toBe(false)
    expect(await storeBytes()).toBe(0)
  })

  it.skipIf(asRoot)('keeps the file in the Trash, and a second purge takes it', async () => {
    const [file] = await addFilesBatch([{ filename: 'notes.pdf', body: new TextEncoder().encode('%PDF-1.4 x').buffer as ArrayBuffer, contentType: 'application/pdf' }])
    await deleteFilesBatch([file!.url])
    await undeletable('files', () => purgeFilesBatch([file!.url]))
    expect((await getTrashedFiles()).map((f) => f.url)).toEqual([file!.url])

    await purgeFilesBatch([file!.url])
    expect(await getTrashedFiles()).toEqual([])
    expect(await storeBytes()).toBe(0)
  })
})
