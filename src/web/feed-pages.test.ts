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
import { savePage } from '@/content/pages'
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

// A page's entry point for heading navigation. A listing's own h1 is the lead card, which is
// a switch, so with it off the home page started at h2 and had none at all.
describe('every page has exactly one h1', () => {
  const countH1 = (html: string) => html.match(/<h1[\s>]/g)?.length ?? 0

  it('promotes the site name when the feed has no lead card', async () => {
    const s = await getSettings()
    await saveSettings({ features: { ...s.features, leadPost: false } })
    await savePost({ title: 'Alone', content: 'x', status: 'published', date: PAST })
    const html = await (await get('/')).text()
    expect(countH1(html)).toBe(1)
    expect(html).toContain('<h1 class="site-h1">')
  })

  it('leaves the lead card as the only h1 when there is one', async () => {
    await savePost({ title: 'Lead', content: 'x', status: 'published', date: PAST })
    const html = await (await get('/')).text()
    expect(countH1(html)).toBe(1)
    expect(html).not.toContain('site-h1')
  })

  it('gives an empty feed and a miss one each', async () => {
    expect(countH1(await (await get('/')).text())).toBe(1)
    expect(countH1(await (await get('/nothing-here')).text())).toBe(1)
  })

  it('leaves the article title as the article page heading', async () => {
    await savePost({ title: 'A Post', slug: 'a-post', content: 'x', status: 'published', date: PAST })
    const html = await (await get('/a-post')).text()
    expect(countH1(html)).toBe(1)
    expect(html).not.toContain('site-h1')
  })
})

// One document, one address. Both of these used to answer 200 while naming a DIFFERENT URL
// as their canonical, which is two pages disagreeing about which of them is the page.
describe('a page and its address agree', () => {
  it('sends an old term spelling to the slug, permanently', async () => {
    await savePost({
      title: 'Filed', content: 'x', status: 'published', date: PAST,
      categories: ['Suy nghi'],
    })
    const alias = await get('/category/Suy%20nghi')
    expect(alias.status).toBe(301)
    expect(alias.headers.get('location')).toBe('/category/suy-nghi')
    expect((await get('/category/suy-nghi')).status).toBe(200)
  })

  it('lets the homepage in page mode own the canonical, not the page it renders', async () => {
    await savePage({ title: 'About', slug: 'about', content: 'Hello', status: 'published' })
    await saveSettings({ siteUrl: 'https://example.com', home: { ...(await getSettings()).home, mode: 'page', page: 'about' } })
    clearCache()
    const html = await (await get('/')).text()
    expect(html).toContain('<link rel="canonical" href="https://example.com/">')
    expect(html).not.toContain('canonical" href="https://example.com/about"')
    // ...and the slug still redirects here, which is what made the old canonical a lie.
    expect((await get('/about')).status).toBe(301)
  })
})
