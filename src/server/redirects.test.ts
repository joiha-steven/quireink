// Redirect rows. The validation is the interesting half: a self-redirect is a loop the
// router would follow forever, and it is easy to create by renaming a slug back.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one } from '@/store/query'
import {
  getRedirects, saveRedirect, deleteRedirect, clearRedirectForPath, RedirectInputError,
} from '@/server/redirects'

const DIR = './.tmp/test-redirects'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => db().run(`delete from redirects`))

describe('saveRedirect', () => {
  it('normalizes both sides and defaults to a permanent redirect', async () => {
    await saveRedirect({ source: 'old-slug/', destination: '/new-slug' })
    const [r] = await getRedirects()
    expect(r).toMatchObject({ source: '/old-slug', destination: '/new-slug', permanent: true })
  })

  it('round-trips permanent: false through the 0/1 column as a boolean', async () => {
    await saveRedirect({ source: '/a', destination: '/b', permanent: false })
    expect((await getRedirects())[0]!.permanent).toBe(false)
    expect(one<{ permanent: number }>(`select permanent from redirects`)!.permanent).toBe(0)
  })

  it('keeps an absolute destination as-is', async () => {
    await saveRedirect({ source: '/a', destination: 'https://example.com/x' })
    expect((await getRedirects())[0]!.destination).toBe('https://example.com/x')
  })

  it('replaces an existing rule for the same source instead of duplicating it', async () => {
    await saveRedirect({ source: '/a', destination: '/b' })
    await saveRedirect({ source: '/a', destination: '/c', permanent: false })
    const rows = await getRedirects()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ destination: '/c', permanent: false })
  })

  it('rejects an empty source, a bad destination, and a self-redirect loop', async () => {
    await expect(saveRedirect({ source: '', destination: '/b' })).rejects.toBeInstanceOf(RedirectInputError)
    await expect(saveRedirect({ source: '/a', destination: 'javascript:alert(1)' })).rejects.toBeInstanceOf(RedirectInputError)
    await expect(saveRedirect({ source: '/a', destination: '/a' })).rejects.toBeInstanceOf(RedirectInputError)
    expect(await getRedirects()).toHaveLength(0)
  })

  it('rejects a rule that would lead back to its own source', async () => {
    // ⚠️ THE SELF-REDIRECT CHECK ABOVE IS THE SAME REFUSAL ONE STEP SHORT. Two rules pointing
    // at each other were accepted in silence and a visitor walked `/a` to `/b` to `/a` until
    // the browser gave up — measured at twelve hops before this refused. The cost outlives the
    // mistake: these are 301s, and a browser caches a permanent redirect hard, so the loop goes
    // on running for a reader who met it once after the owner has already fixed the rule.
    await saveRedirect({ source: '/a', destination: '/b' })
    await expect(saveRedirect({ source: '/b', destination: '/a' })).rejects.toBeInstanceOf(RedirectInputError)

    // A ring of three, which reasoning about pairs alone would let through.
    await saveRedirect({ source: '/x', destination: '/y' })
    await saveRedirect({ source: '/y', destination: '/z' })
    await expect(saveRedirect({ source: '/z', destination: '/x' })).rejects.toBeInstanceOf(RedirectInputError)

    // Replacing a rule is judged on what it WOULD leave behind, not on what is there now.
    await expect(saveRedirect({ source: '/a', destination: '/b' })).resolves.toBeUndefined()
    expect((await getRedirects()).map((r) => `${r.source}->${r.destination}`).sort())
      .toEqual(['/a->/b', '/x->/y', '/y->/z'])
  })

  it('still allows a chain that ends somewhere', async () => {
    // The counter-test: a rule that refused every chain would pass the one above too.
    await saveRedirect({ source: '/cu', destination: '/moi' })
    await expect(saveRedirect({ source: '/moi', destination: '/dich' })).resolves.toBeUndefined()
    await expect(saveRedirect({ source: '/ra-ngoai', destination: 'https://example.com/x' }))
      .resolves.toBeUndefined()
    expect(await getRedirects()).toHaveLength(3)
  })
})

describe('removal', () => {
  it('deletes by id', async () => {
    await saveRedirect({ source: '/a', destination: '/b' })
    await deleteRedirect((await getRedirects())[0]!.id)
    expect(await getRedirects()).toHaveLength(0)
  })

  it('clears by path, normalizing first, and ignores a path that normalizes to nothing', async () => {
    await saveRedirect({ source: '/a', destination: '/b' })
    await clearRedirectForPath('a/')
    expect(await getRedirects()).toHaveLength(0)
    await saveRedirect({ source: '/a', destination: '/b' })
    await clearRedirectForPath('')
    expect(await getRedirects()).toHaveLength(1)
  })
})
