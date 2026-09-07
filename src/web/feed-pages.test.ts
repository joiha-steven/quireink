// The feed's pages: how much of the archive one page carries, how a reader reaches the
// rest, and which day a card is filed under.
//
// Split out of `app.test.ts` on 2026-09-07, when capping the page put that file over the
// 400-line ceiling. The seam is the subject: everything here is about the LIST across more
// than one page, and nothing else in `app.test.ts` needs more than one.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-feed-pages'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)
const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(() => {
  for (const t of ['posts', 'pages', 'post_terms', 'settings']) db().run(`delete from ${t}`)
  clearCache()
})

/** A timeline feed of `n` posts, `perChunk` to a chunk. */
const feedOf = async (n: number, perChunk = 2): Promise<void> => {
  await saveSettings({
    postsPerPage: perChunk,
    features: { ...(await getSettings()).features, infiniteScroll: true },
  })
  for (let i = 0; i < n; i++) {
    await savePost({ title: `Post ${i}`, content: 'x', status: 'published', date: PAST })
  }
  clearCache()
}

describe('a page of the feed', () => {
  // The card and the marker above it have to name the same year. The marker sliced the
  // stored UTC string while the card printed `settings.timezone`, so for the first hours of
  // every January in Hanoi a post dated 1 January sat under a heading reading the year
  // before.
  it('puts a card under the year marker its own printed date names', async () => {
    await saveSettings({
      timezone: 'Asia/Ho_Chi_Minh',
      features: { ...(await getSettings()).features, infiniteScroll: true },
    })
    // 02:00 on 1 January 2026 in Hanoi, which is still 2025 in UTC.
    await savePost({ title: 'New Year', content: 'x', status: 'published', date: '2025-12-31T19:00:00.000Z' })
    const html = await (await get('/')).text()
    expect(html).toContain('>2026</span>')
    expect(html).not.toContain('>2025</span>')
    expect(html).toContain('January 1, 2026')
  })

  // The whole archive used to be in the HTML. That is fine at thirty posts and is not what
  // a blog becomes, so a timeline page is three chunks and the rest is fetched.
  it('caps the HTML at three chunks and leaves a real link to the rest', async () => {
    await feedOf(20)
    const html = await (await get('/')).text()
    expect(html.match(/<article/g)?.length).toBe(6)
    expect(html).toContain('<nav class="feed-more" data-feed-more')
    expect(html).toContain('href="/page/2"')
  })

  it('serves the deeper pages it links to, and keeps them out of the index', async () => {
    await feedOf(20)
    const two = await get('/page/2')
    expect(two.status).toBe(200)
    const html = await two.text()
    expect(html.match(/<article/g)?.length).toBe(6)
    // `follow`, so the posts on it are still reached; `noindex`, so an infinite feed does
    // not become one indexed URL per thirty posts.
    expect(html).toContain('name="robots" content="noindex, follow"')
    expect(html).toContain('href="/page/3"')
    // ...and the walk ends rather than running forever.
    const last = await get('/page/4')
    expect(last.status).toBe(200)
    expect(await last.text()).not.toContain('data-feed-more')
    expect((await get('/page/5')).status).toBe(404)
  })

  // The link is what a reader with no JavaScript follows, so the walk has to reach every
  // post the archive holds.
  it('reaches every post by following the link alone', async () => {
    await feedOf(20)
    const seen = new Set<string>()
    let path: string | undefined = '/'
    for (let hop = 0; path && hop < 20; hop++) {
      const html: string = await (await get(path)).text()
      for (const m of html.matchAll(/<a class="link-accent" href="\/(post-\d+)"/g)) seen.add(m[1]!)
      path = /<nav class="feed-more"[^>]*><a rel="next" href="([^"]+)"/.exec(html)?.[1]
    }
    expect(seen.size).toBe(20)
  })
})
