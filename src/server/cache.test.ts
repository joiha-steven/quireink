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
import { pageCache, clearCache, onFlush } from '@/server/cache'
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
  it('renders every public post back into the page cache, and the homepage', async () => {
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
