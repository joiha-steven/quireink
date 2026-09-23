// The flush and what hangs off it.
//
// Invariant 1 is "one Map, emptied completely on any write". This adds two things AFTER
// that flush — re-filling the cache and purging the CDN — and both of them are things a
// test suite must never actually do, so the seam that keeps them out of a test is itself
// worth a test.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { pageCache, clearCache, onFlush, budgetChars, rereadBudget } from '@/server/cache'
import { warmCache, warmThenPurge, purgeAfterWrite } from '@/server/warm'
import { purgeEdge } from '@/server/edge-cache'
import { saveIntegrationKeys } from '@/store/integration-keys'

const DIR = './.tmp/test-cache'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'settings', 'integration_keys', 'render_cache']) {
    db().run(`delete from ${t}`)
  }
})

describe('the flush', () => {
  it('empties the page cache and runs whatever is hooked to it', () => {
    pageCache.set('/x', '<html>')
    let ran = 0
    onFlush(() => { ran += 1 })
    clearCache()
    expect(pageCache.size).toBe(0)
    expect(ran).toBe(1)
  })

  it('survives a hook that throws, because a save is not a cache', () => {
    // The warmer and the purge are best-effort. A CDN that is down, or a token that was
    // revoked, must not turn "post saved" into a 500 on the owner's screen.
    onFlush(() => { throw new Error('cdn on fire') })
    pageCache.set('/y', '<html>')
    expect(() => clearCache()).not.toThrow()
    expect(pageCache.size).toBe(0)
  })
})

describe('warming', () => {
  it('renders every public post back into the page cache when they all fit, and the homepage', async () => {
    await savePost({ title: 'One', content: 'body text', status: 'published', date: PAST })
    await savePost({ title: 'Two', content: 'body text', status: 'published', date: PAST })
    clearCache()
    expect(pageCache.size).toBe(0)

    const { warmed } = await warmCache()
    // Two posts and `/`. The homepage was claimed by this function's own comment long
    // before it was true, so it is asserted rather than described (ADR 0014).
    expect(warmed).toBe(3)
    expect(pageCache.get('/one')).toContain('One')
    expect(pageCache.get('/two')).toContain('Two')
    expect(pageCache.has('/')).toBe(true)
  })

  it('leaves out a draft and a future-dated post, which are not public', async () => {
    await savePost({ title: 'Live', content: 'body text', status: 'published', date: PAST })
    await savePost({ title: 'Draft', content: 'body text', status: 'draft', date: PAST })
    await savePost({
      title: 'Later', content: 'body text', status: 'published',
      date: '2099-01-01T00:00:00.000Z',
    })
    const { warmed } = await warmCache()
    expect(warmed).toBe(2) // the one live post, plus `/`
    expect(pageCache.has('/draft')).toBe(false)
    expect(pageCache.has('/later')).toBe(false)
  })
})

describe('the budget', () => {
  // An eighth of the budget each, so seven fit and the eighth is the one that cannot. Derived
  // rather than typed: `PAGE_CACHE_MB` moves the number, and a test that hardcodes today's
  // default is a test that goes red on a deployment choice rather than on a defect. Nothing in
  // this block renders anything — the budget is a property of the container, and mixing it
  // with the renderer would test neither.
  const SLICE = 'x'.repeat(Math.floor(budgetChars() / 8))

  it('keeps everything a blog under the budget stores, and evicts nothing', () => {
    for (let i = 0; i < 7; i++) pageCache.set(`/p${i}`, SLICE)
    expect(pageCache.size).toBe(7)
    expect(pageCache.get('/p0')).toBe(SLICE)
    expect(pageCache.chars).toBeLessThan(budgetChars())
  })

  it('drops the oldest READ page, not the oldest stored one', () => {
    for (let i = 0; i < 7; i++) pageCache.set(`/p${i}`, SLICE)
    // `/p0` was stored first and would be the first to go on insertion order alone. Reading
    // it is what a reader asking for the front page does, and it has to survive that.
    expect(pageCache.get('/p0')).toBe(SLICE)
    pageCache.set('/p7', SLICE) // the eighth slice: something has to go
    expect(pageCache.has('/p0')).toBe(true)
    expect(pageCache.has('/p1')).toBe(false)
    expect(pageCache.chars).toBeLessThanOrEqual(budgetChars())
  })

  it('refunds what an overwritten page cost, so re-warming the same paths evicts nothing', () => {
    // The counter rising on every store and never falling is the shape that would make a
    // site re-warming its own 7 paths evict itself down to one.
    for (let round = 0; round < 4; round++) {
      for (let i = 0; i < 7; i++) pageCache.set(`/p${i}`, SLICE)
    }
    expect(pageCache.size).toBe(7)
  })

  it('stores a page bigger than the whole budget rather than evicting it on the way in', () => {
    pageCache.set('/huge', 'y'.repeat(budgetChars() + 10))
    // Evicting until under budget would reach the page just stored and leave nothing at all,
    // so an 8 MB post would be uncacheable AND would empty the cache on every request for it.
    expect(pageCache.has('/huge')).toBe(true)
    expect(pageCache.size).toBe(1)
  })
})

describe('what the warmer is offered, against what a reader stores', () => {
  const SLICE = 'x'.repeat(Math.floor(budgetChars() / 8))

  it('refuses a page that would evict, where a reader request takes one', () => {
    for (let i = 0; i < 7; i++) pageCache.set(`/p${i}`, SLICE)
    const before = pageCache.size
    // THE WARM MUST NOT EVICT: it renders in priority order, so the first thing thrown away
    // would be `/`. `set` is the reader's path and evicting there is right — that page was
    // asked for.
    expect(pageCache.offer('/offered', SLICE)).toBe(false)
    expect(pageCache.has('/offered')).toBe(false)
    expect(pageCache.size).toBe(before)
    pageCache.set('/asked-for', SLICE)
    expect(pageCache.has('/asked-for')).toBe(true)
    expect(pageCache.size).toBe(before)
  })

  it('keeps nothing at all when the operator has set the budget to zero', () => {
    // `0` is NO CACHE, which is not how `env.ts`'s other two sizes read `0` — there it means no
    // limit. A box with nothing to spare has to be able to say so, and the difference is
    // written out in `set`.
    const before = process.env.PAGE_CACHE_MB
    process.env.PAGE_CACHE_MB = '0'
    rereadBudget()
    try {
      pageCache.set('/nothing', 'a rendered page')
      expect(pageCache.size).toBe(0)
      expect(pageCache.has('/nothing')).toBe(false)
      expect(pageCache.offer('/nothing', 'a rendered page')).toBe(false)
    } finally {
      if (before === undefined) delete process.env.PAGE_CACHE_MB
      else process.env.PAGE_CACHE_MB = before
      rereadBudget()
    }
    // And back to normal for every test after this one, which is the half of a seam like this
    // that is easy to leave out. Bun runs a file's tests in one process.
    pageCache.set('/again', 'a rendered page')
    expect(pageCache.has('/again')).toBe(true)
  })

  it('takes the offer again once the flush has emptied the cache', () => {
    for (let i = 0; i < 7; i++) pageCache.set(`/p${i}`, SLICE)
    expect(pageCache.offer('/late', SLICE)).toBe(false)
    clearCache()
    expect(pageCache.chars).toBe(0)
    expect(pageCache.offer('/late', SLICE)).toBe(true)
  })
})

describe('warming an archive too big for the budget', () => {
  it('stops at the cache, reports it, and keeps the home page it started with', async () => {
    // Nine posts, each with a body over a megabyte: the budget is reached partway through, and
    // what must not happen is the loop running to the end with every post evicting the last.
    const BIG = 'word '.repeat(220_000)
    for (let i = 0; i < 9; i++) {
      await savePost({ title: `Big ${i}`, content: BIG, status: 'published', date: PAST })
    }
    clearCache()

    const { warmed, capped } = await warmCache()
    expect(capped).toBe(true)
    expect(warmed).toBeLessThan(10) // `/` plus nine posts is what the old loop would render
    // ⚠️ THE ASSERTION THE OFFER EXISTS FOR. With `set` in the loop this was false: `/` goes in
    // first, so it is the least recently used and the first page the warm threw away — the one
    // page certain to be asked for, evicted by the warm meant to have it ready.
    expect(pageCache.has('/')).toBe(true)
    expect(pageCache.chars).toBeLessThanOrEqual(budgetChars())
  })
})

describe('a write that lands while the warmer is already running', () => {
  it('earns a second pass instead of being dropped', async () => {
    // THE BUG THIS EXISTS FOR. The guard was `if (running) return`, which reads like
    // de-duplication and is data loss: a warm walks every public post (8.4s measured on a
    // 77-post site) and a save landing inside that window never reached `purgeEdge`, so the
    // CDN went on serving the old page. Reported as "saving a post does not clear the cache".
    //
    // Counting PASSES, not inspecting the cache at the end. The obvious version — clear the
    // cache mid-flight and assert it comes back full — passes against the broken code too,
    // because the first pass keeps writing after the clear and fills it anyway. That version
    // was written first and could not go red, which is the only thing wrong with a guard.
    await savePost({ title: 'One', content: 'body text', status: 'published', date: PAST })
    await savePost({ title: 'Two', content: 'body text', status: 'published', date: PAST })

    const lines: string[] = []
    const realLog = console.log
    console.log = (...args: unknown[]) => { lines.push(args.join(' ')) }
    try {
      // `running` is set before the first `await` inside warmThenPurge, so by the time the
      // next statement runs the first pass is provably in flight. No timing guess.
      const first = warmThenPurge('first')
      await warmThenPurge('a write during the first pass')
      await first
    } finally {
      console.log = realLog
    }

    const passes = lines.filter((l) => l.startsWith('cache: warmed')).length
    expect(passes).toBe(2)
  })
})

describe('a publish reaches readers before the warm finishes', () => {
  // MEASURED ON THE LIVE SITE, from the owner's own publish on 2026-08-21:
  //
  //     14:44:00  PUT /api/posts/…          published
  //     14:44:09  cache: warmed 79 pages    6.5s of rendering, after a 3s debounce
  //     14:44:09  edge-cache: purged        readers stop seeing the old page HERE
  //
  // Nine seconds, growing with the archive, because the purge was the last step of the warm.
  // The owner refreshed inside that window, did not see his post on the home page, and pressed
  // Clear cache — a route that purges in 183ms because it calls `purgeEdge()` directly. The
  // manual path was fast and the automatic one was not, and that gap IS the bug report.
  //
  // What is asserted here is the separation: the purge no longer waits for anything.

  it('purges on the leading edge, and holds the next one for a moment', async () => {
    // A burst is one purge, not one per write: Cloudflare rate-limits purge-everything and an
    // import is a thousand saves. The FIRST write of a burst is the one that fires.
    //
    // The clock is passed in rather than slept through: a three-second sleep in a suite is a
    // three-second sleep on every run forever, and a reset function would be an export that
    // exists only for this file.
    const t = Date.now() + 600_000
    expect(await purgeAfterWrite(t)).toBe('purged')
    expect(await purgeAfterWrite(t + 100)).toBe('held')
    expect(await purgeAfterWrite(t + 2_999)).toBe('held')
    // And the gap is a gap, not a lock: the next burst purges again.
    expect(await purgeAfterWrite(t + 3_000)).toBe('purged')
  })

  it('never lets the trailing purge be held, because it carries the last write', async () => {
    // The tail is what the 2026-08-19 fix added and it must stay unconditional: a burst's last
    // save arrives inside the gap, so a shared rate limit between the two would drop exactly
    // the write that mattered and leave the CDN serving the previous version.
    await savePost({ title: 'One', content: 'body text', status: 'published', date: PAST })
    await purgeAfterWrite() // put the gap in force

    const lines: string[] = []
    const realLog = console.log
    console.log = (...args: unknown[]) => { lines.push(args.join(' ')) }
    try {
      await warmThenPurge('immediately after a leading purge')
    } finally {
      console.log = realLog
    }
    // It ran the whole pass rather than returning early on the clock.
    expect(lines.some((l) => l.startsWith('cache: warmed'))).toBe(true)
  })

  it('is wired to the flush, not to the warm', async () => {
    // The seam, asserted against the source: the ordering is the fix, and a refactor that puts
    // `purgeAfterWrite` back inside `warmThenPurge` would restore the nine seconds while every
    // other test in this file stayed green.
    const source = await Bun.file('src/server/warm.ts').text()
    const hook = source.indexOf('onFlush(')
    const leading = source.indexOf('void purgeAfterWrite()')
    const debounce = source.indexOf('setTimeout')
    expect(hook).toBeGreaterThan(-1)
    expect(leading).toBeGreaterThan(hook)
    // Before the timer is armed, so it cannot be mistaken for part of the debounced work.
    expect(leading).toBeLessThan(source.indexOf('setTimeout', hook))
    expect(debounce).toBeGreaterThan(-1)
  })
})

describe('the edge purge', () => {
  it('does nothing at all when no Cloudflare keys are set', async () => {
    // The normal case for a self-hosted install with no CDN, and the state every test runs
    // in. `skipped` rather than a thrown error or a fetch to nowhere.
    expect(await purgeEdge()).toBe('skipped')
  })

  it('stays skipped when only half the pair is configured', async () => {
    // A zone id with no token is what a half-finished settings page looks like, and firing
    // an unauthenticated purge at Cloudflare on every write is not a useful answer to it.
    await saveIntegrationKeys({ cloudflareZoneId: 'abc123' })
    expect(await purgeEdge()).toBe('skipped')
  })
})

describe('storing a page again', () => {
  // ⚠️ Found in the release review of 2026-09-23. `Map.set` on a present key keeps its place,
  // so the page just refreshed stayed the OLDEST, was the next one evicted, and the eviction
  // loop stopped at it with the cache still over budget.
  it('makes it the newest, so the next eviction takes the least recently used instead', () => {
    clearCache()
    const third = Math.floor(budgetChars() / 3) - 4
    const body = (c: string) => c.repeat(third)
    pageCache.set('/a', body('a'))
    pageCache.set('/b', body('b'))
    pageCache.set('/c', body('c'))
    pageCache.set('/a', body('A'))
    pageCache.set('/d', body('d'))
    expect(pageCache.has('/a')).toBe(true)
    expect(pageCache.has('/b')).toBe(false)
    clearCache()
  })
})
