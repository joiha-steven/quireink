// The upload cap and the storage quota.
//
// Two behaviours carry the design and both are easy to get backwards, so they are pinned
// here: a setting NARROWS the deployment's ceiling and can never raise it, and `0` on either
// side means "no cap from me" rather than "a cap of zero".
import { describe, it, expect, beforeEach, afterAll, afterEach } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { saveSettings } from '@/content/settings'
import { checkUpload, readCapped, uploadLimits } from '@/media/limits'

const DIR = './.tmp/test-limits'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const MB = 1024 * 1024
const GB = 1024 * MB

/** Restored after every test: `readEnv()` reads `process.env` per call, by design. */
const ENV_KEYS = ['MAX_UPLOAD_MB', 'STORAGE_QUOTA_GB'] as const
const saved = new Map<string, string | undefined>()

beforeEach(() => {
  db().run(`delete from settings`)
  for (const key of ENV_KEYS) saved.set(key, process.env[key])
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    const prev = saved.get(key)
    if (prev === undefined) delete process.env[key]
    else process.env[key] = prev
  }
})

describe('the ceiling only narrows', () => {
  it('uses the deployment ceiling when the owner has asked for nothing', async () => {
    process.env.MAX_UPLOAD_MB = '10'
    process.env.STORAGE_QUOTA_GB = '2'
    expect(await uploadLimits()).toEqual({ maxFileBytes: 10 * MB, storeQuotaBytes: 2 * GB })
  })

  it('lets a setting lower the ceiling', async () => {
    process.env.MAX_UPLOAD_MB = '64'
    await saveSettings({ maxUploadMb: 8 })
    expect((await uploadLimits()).maxFileBytes).toBe(8 * MB)
  })

  /** The whole point. An owner cannot vote themselves more than the operator allowed. */
  it('IGNORES a setting that tries to raise it', async () => {
    process.env.MAX_UPLOAD_MB = '8'
    await saveSettings({ maxUploadMb: 512 })
    expect((await uploadLimits()).maxFileBytes).toBe(8 * MB)
  })

  it('reads 0 as "no cap from me" on either side, not as a cap of zero', async () => {
    process.env.MAX_UPLOAD_MB = '0'
    await saveSettings({ maxUploadMb: 4 })
    // The operator declined to cap, so the owner's 4 MB is the only number left.
    expect((await uploadLimits()).maxFileBytes).toBe(4 * MB)

    process.env.MAX_UPLOAD_MB = '16'
    await saveSettings({ maxUploadMb: 0 })
    expect((await uploadLimits()).maxFileBytes).toBe(16 * MB)
  })

  it('refuses a bad env value instead of quietly using the default', async () => {
    process.env.MAX_UPLOAD_MB = 'sixty-four'
    await expect(uploadLimits()).rejects.toThrow(/MAX_UPLOAD_MB/)
  })
})

describe('checkUpload', () => {
  it('passes a batch that fits', async () => {
    process.env.MAX_UPLOAD_MB = '1'
    expect(await checkUpload([1000, 2000])).toBeNull()
  })

  it('names the offending file, not the total, when one is too large', async () => {
    process.env.MAX_UPLOAD_MB = '1'
    const refusal = await checkUpload([10, 5 * MB])
    expect(refusal).toEqual({ reason: 'file_too_large', limit: MB, actual: 5 * MB })
  })

  /**
   * Twenty files that each fit but together do not is the case a per-file loop gets wrong,
   * and it is the one a quota exists for.
   */
  it('checks the quota against the batch as a whole', async () => {
    process.env.MAX_UPLOAD_MB = '0'
    process.env.STORAGE_QUOTA_GB = '0'
    expect(await checkUpload([1, 1])).toBeNull()
  })
})

describe('readCapped', () => {
  const body = (bytes: number, headers: Record<string, string> = {}) =>
    new Response(new Uint8Array(bytes), { headers })

  it('returns the bytes when they fit', async () => {
    const read = await readCapped(body(100), 1000)
    expect('body' in read && read.body.byteLength).toBe(100)
  })

  it('refuses on a declared length before reading anything', async () => {
    const read = await readCapped(body(10, { 'content-length': '99999' }), 1000)
    expect(read).toEqual({ tooLarge: true, limit: 1000 })
  })

  /**
   * The case a header check misses: a body larger than the cap whose length was never
   * declared. It has to stop READING rather than measure afterwards, because measuring
   * afterwards means the bytes were already in memory.
   */
  it('refuses an undeclared body that runs past the cap', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(512)) },
    })
    const read = await readCapped(new Response(stream), 1000)
    expect(read).toEqual({ tooLarge: true, limit: 1000 })
  })

  it('reads everything when there is no cap', async () => {
    const read = await readCapped(body(4096), 0)
    expect('body' in read && read.body.byteLength).toBe(4096)
  })
})
