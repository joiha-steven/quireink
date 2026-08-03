// The owner's cache switch, driven through real requests.
//
// Its own file rather than another block in `app.test.ts`, which is at the 400-line cap.
// Both layers are pinned here because switching off only one of them is the failure this
// feature exists to avoid: the in-process cache silent and Cloudflare still answering from
// the edge, so the switch appears to do nothing from outside.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { saveSettings } from '@/content/settings'
import { clearCache, pageCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-cache-switch'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)
const PAST = '2020-01-01T00:00:00.000Z'
const CACHED = 'public, s-maxage=60, stale-while-revalidate=600'

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings']) {
    db().run(`delete from ${t}`)
  }
})

describe('the cache switch (Settings -> System)', () => {
  it('caches in memory and lets the edge hold the page, by default', async () => {
    await savePost({ title: 'On', content: 'body', status: 'published', date: PAST })
    const res = await get('/on')
    expect(res.headers.get('cache-control')).toBe(CACHED)
    expect(pageCache.has('/on')).toBe(true)
  })

  describe('switched off', () => {
    beforeEach(async () => {
      await saveSettings({ cache: { enabled: false } })
    })

    it('neither reads nor fills the page cache', async () => {
      await savePost({ title: 'Live edit', content: 'first', status: 'published', date: PAST })
      expect(await get('/live-edit').then((r) => r.text())).toContain('first')
      expect(pageCache.size).toBe(0)
      // Nothing was stored, so nothing can come back stale: changing the row behind the
      // cache's back has to show up on the very next request.
      db().run(`update posts set content = 'second' where slug = 'live-edit'`)
      expect(await get('/live-edit').then((r) => r.text())).toContain('second')
    })

    it('tells a shared cache not to store the page either', async () => {
      await savePost({ title: 'Edge', content: 'body', status: 'published', date: PAST })
      // `no-store`, not `no-cache`: Cloudflare answers from the edge under `no-cache`.
      expect((await get('/edge')).headers.get('cache-control')).toBe('public, no-store')
    })

    it('still keeps the owner out of a shared cache', async () => {
      // The switch is about PUBLIC pages. An admin shell held anywhere shared is a page
      // served to somebody it was not rendered for, whatever the switch says.
      expect((await get('/login')).headers.get('cache-control')).toBe('private, no-store')
    })

    it('goes back to caching when switched on again', async () => {
      await savePost({ title: 'Back on', content: 'body', status: 'published', date: PAST })
      await get('/back-on')
      expect(pageCache.size).toBe(0)
      await saveSettings({ cache: { enabled: true } })
      expect((await get('/back-on')).headers.get('cache-control')).toBe(CACHED)
      expect(pageCache.has('/back-on')).toBe(true)
    })
  })
})
