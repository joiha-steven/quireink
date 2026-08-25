// The sweep has to STOP. Everything else about it is idempotent and self-healing; the one
// way it fails is by running past the moment the caller is still there to receive an answer.

import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { all } from '@/store/query'
import { finalizePendingVariants, VARIANT_BUDGET_MS } from '@/media/finalize'

const DIR = './.tmp/test-finalize'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const pending = (path: string) =>
  db().run(
    `insert into media (path, filename, size, uploaded_at, variants) values (?, ?, 10, 1, 0)`,
    [path, path.split('/').pop() ?? path],
  )

beforeEach(() => db().run(`delete from media`))

describe('the variant sweep stops when its time is up', () => {
  it('does no work at all on a zero budget, and leaves every row pending', async () => {
    // The guard is checked BEFORE the first encode, so a budget already spent means the
    // sweep is a no-op rather than "one more, then stop".
    for (const p of ['media/a.png', 'media/b.jpg', 'media/c.png']) pending(p)
    expect(await finalizePendingVariants(0)).toBe(0)
    expect(all<{ path: string }>(`select path from media where variants = 0`)).toHaveLength(3)
  })

  it('returns 0 with nothing pending, without opening the store', async () => {
    expect(await finalizePendingVariants(0)).toBe(0)
    expect(await finalizePendingVariants()).toBe(0)
  })

  it('ignores rows that are not raster originals', async () => {
    // An SVG has no display variants to make; a row for one must not keep the sweep busy
    // forever by never becoming `variants = 1`.
    for (const p of ['media/logo.svg', 'media/notes.pdf', 'media/clip.mp4']) pending(p)
    expect(await finalizePendingVariants()).toBe(0)
    expect(all<{ path: string }>(`select path from media where variants = 0`)).toHaveLength(3)
  })

  it('has a default budget that fits inside a request', () => {
    // `Bun.serve`'s own default idle timeout is 10 seconds and the cron tick is the one
    // route that can legitimately run long. This number exists to stay under that on a box
    // where nobody measured anything, so it is worth failing loudly if it ever creeps up.
    expect(VARIANT_BUDGET_MS).toBeLessThan(10_000)
  })
})
