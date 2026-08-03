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
import { warmCache, warmThenPurge } from '@/server/warm'
import { purgeEdge } from '@/server/edge-cache'
import { saveIntegrationKeys } from '@/store/integration-keys'

const DIR = './.tmp-test-cache'
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
