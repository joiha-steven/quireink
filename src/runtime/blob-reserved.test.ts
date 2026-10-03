import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { isReservedBlobPath } from '@/runtime/blob-reserved'

const DIR = './.tmp/test-blob-reserved'
mkdirSync(`${DIR}/private/backups`, { recursive: true })
mkdirSync(`${DIR}/media`, { recursive: true })
writeFileSync(`${DIR}/private/backups/quire-x.tar.gz`, 'secret')
writeFileSync(`${DIR}/media/a.jpg`, 'pixels')
process.env.STORAGE_LOCAL_DIR = DIR
const blob = await import('@/runtime/bun/blob')

afterAll(() => {
  delete process.env.STORAGE_LOCAL_DIR
  rmSync(DIR, { recursive: true, force: true })
})

describe('`private/` at the top of the blob store is never an upload', () => {
  it('names the top segment only', () => {
    for (const p of ['private', 'private/aside/x.json', './private/x', '/private/x']) expect(isReservedBlobPath(p)).toBe(true)
    for (const p of ['media/private/x.jpg', 'privateer.jpg', 'media/a.jpg']) expect(isReservedBlobPath(p)).toBe(false)
  })

  // ⚠️ On Cloudflare `/uploads/*` serves whatever the port reads, out of the bucket that also holds
  // the backups; Bun draws the same line so the two never disagree about an upload.
  it('is refused for reading, sizing, writing and deleting, and skipped by a listing', async () => {
    // Inside an async function, so a port that throws at once and one that rejects count alike.
    const attempt = (f: () => unknown) => (async () => f())()
    await expect(attempt(() => blob.read('private/backups/quire-x.tar.gz'))).rejects.toThrow('Invalid blob path')
    await expect(attempt(() => blob.statSize('private/backups/quire-x.tar.gz'))).rejects.toThrow('Invalid blob path')
    await expect(attempt(() => blob.put('private/x.txt', Buffer.from('x')))).rejects.toThrow('Invalid blob path')
    await expect(attempt(() => blob.del('private/backups/quire-x.tar.gz'))).rejects.toThrow('Invalid blob path')
    expect((await blob.list()).map((b) => b.pathname)).toEqual(['media/a.jpg'])
    expect((await blob.read('media/a.jpg')).toString()).toBe('pixels')
  })
})
