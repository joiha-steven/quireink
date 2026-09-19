// THE FOUR SUBSCRIPTION DOCUMENTS: the blog and the notebook, each as RSS and as JSON Feed.
//
// `feeds.test.ts` already holds the post feed's own cases and is near the 400-line rule, so
// what is new lives here: the JSON format, the notebook's pair, and the one law that binds
// all four — a note is never in the post feed and a post is never in the notebook's
// (ADR 0044). That law is asserted in BOTH directions on purpose. "The post feed holds no
// note" is also true of a post feed that failed to render, and this file would have believed
// it; the counter-test is the same document being asked to prove it does hold the post.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { saveNote } from '@/content/notes'
import { saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-feed-json'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)
const text = async (path: string): Promise<string> => get(path).then((r) => r.text())
const PAST = '2020-01-01T00:00:00.000Z'
const FUTURE = '2099-01-01T00:00:00.000Z'

type JsonFeed = {
  version: string
  title: string
  home_page_url: string
  feed_url: string
  language: string
  authors?: { name: string; url?: string }[]
  items: { id: string; url: string; title: string; date_published: string; summary?: string }[]
}
const json = async (path: string): Promise<JsonFeed> => get(path).then((r) => r.json()) as Promise<JsonFeed>

beforeEach(async () => {
  // ⚠️ The page cache is per process and the test files share one, so without this `/notes`
  // is served from whatever the file that ran before rendered, against ITS database.
  clearCache()
  for (const t of ['posts', 'post_terms', 'pages', 'notes', 'redirects', 'settings']) {
    db().run(`delete from ${t}`)
  }
  await saveSettings({ title: 'My Blog', siteUrl: 'https://example.com' })
})

describe('JSON Feed', () => {
  it('is a valid 1.1 document carrying the same entries as the RSS', async () => {
    await savePost({ title: 'Hello', content: 'body', status: 'published', date: PAST, excerpt: 'A summary' })

    const res = await get('/feed.json')
    expect(res.headers.get('content-type')).toContain('application/feed+json')
    const feed = await json('/feed.json')
    expect(feed.version).toBe('https://jsonfeed.org/version/1.1')
    expect(feed.title).toBe('My Blog')
    expect(feed.home_page_url).toBe('https://example.com')
    expect(feed.feed_url).toBe('https://example.com/feed.json')
    expect(feed.items).toHaveLength(1)
    expect(feed.items[0]).toMatchObject({
      id: 'https://example.com/hello',
      url: 'https://example.com/hello',
      title: 'Hello',
      summary: 'A summary',
      date_published: PAST,
    })
    // The two formats are one subscription in two spellings. A reader who takes either must
    // get the same list, in the same order — which is what one builder and one item shape buys.
    const xml = await text('/feed.xml')
    for (const item of feed.items) expect(xml).toContain(`<link>${item.id}</link>`)
    expect((xml.match(/<item>/g) ?? []).length).toBe(feed.items.length)
  })

  it('omits an empty summary rather than sending one, and omits the author block with no name', async () => {
    // A NOTE, not a post: `savePost` fills an empty excerpt from the first paragraph, so a
    // post always has a summary and can never reach this branch. A note with nothing kept
    // has nothing to summarise, which is the real shape of the empty case.
    await saveNote({ title: 'Bare', content: 'body', status: 'published', date: PAST })
    const feed = await json('/notes/feed.json')
    expect(feed.items[0]!.summary).toBeUndefined()
    expect(feed.authors).toBeUndefined()

    // The counter-test for the summary: a note WITH a passage carries one, so the line above
    // is about the empty case rather than about a builder that never emits a summary.
    await saveNote({ title: 'Kept', content: 'b', status: 'published', date: '2021-01-01T00:00:00.000Z',
      quote: 'every stroke starts wet' })
    clearCache()
    expect((await json('/notes/feed.json')).items[0]!.summary).toBe('every stroke starts wet')

    // The counter-test: with a name set, the block IS there. Without this, the line above
    // passes on a builder that never emits an author at all.
    await saveSettings({ author: { name: 'A. Writer', url: 'https://example.com/me', bio: '', avatarUrl: '' } })
    clearCache()
    expect((await json('/notes/feed.json')).authors).toEqual([{ name: 'A. Writer', url: 'https://example.com/me' }])
  })

  it('stays parseable when a title carries a lone surrogate, and leaves a real emoji alone', async () => {
    // Half a surrogate pair is not a character. XML has no spelling for it at all, which is
    // why `feeds.ts` sweeps it; JSON escapes it and stays well-formed, which is why this file
    // does not. Both halves are asserted, because "the feed still parsed" is also true of a
    // builder that dropped the title.
    await savePost({ title: 'Broken \ud800 half', content: 'b', status: 'published', date: PAST })
    await savePost({ title: 'Whole 🌊 wave', content: 'b', status: 'published', date: '2021-01-01T00:00:00.000Z' })
    const feed = await json('/feed.json')
    const titles = feed.items.map((i) => i.title)
    expect(titles).toContain('Whole 🌊 wave')
    expect(titles.some((t) => t.startsWith('Broken '))).toBe(true)
  })
})

describe('the notebook subscribes too', () => {
  it('serves the notebook at its own address, not as a note called feed', async () => {
    await saveNote({ title: 'A kept thought', content: 'x', status: 'published', date: PAST,
      sourceUrl: 'https://example.com/reed', sourceTitle: 'The reed pen', quote: 'every stroke starts wet' })

    // The route-ordering case: `/notes/feed.xml` is registered before `/notes/:slug`, and a
    // static segment beating a parameter is a property of the router, not of our wishes.
    const rss = await get('/notes/feed.xml')
    expect(rss.headers.get('content-type')).toContain('application/rss+xml')
    const xml = await rss.text()
    expect(xml).toContain('<link>https://example.com/notes/a-kept-thought</link>')
    // The kept passage is the summary, the same choice the notebook's cards and llms.txt make.
    expect(xml).toContain('every stroke starts wet')

    const feed = await json('/notes/feed.json')
    expect(feed.feed_url).toBe('https://example.com/notes/feed.json')
    expect(feed.items[0]!.url).toBe('https://example.com/notes/a-kept-thought')
  })

  it('names a clip after where it came from when it has no title of its own', async () => {
    await saveNote({ content: 'x', status: 'published', date: PAST,
      sourceUrl: 'https://example.com/reed', sourceTitle: 'The reed pen', quote: 'wet' })
    expect((await json('/notes/feed.json')).items[0]!.title).toBe('The reed pen')
  })

  it('keeps notes out of the post feed and posts out of the notebook, both directions', async () => {
    await savePost({ title: 'A published post', content: 'b', status: 'published', date: PAST })
    await saveNote({ title: 'A published note', content: 'x', status: 'published', date: PAST })

    const posts = await json('/feed.json')
    const notes = await json('/notes/feed.json')
    const postTitles = posts.items.map((i) => i.title)
    const noteTitles = notes.items.map((i) => i.title)
    // Each document HOLDS its own kind — without these two lines the two below are satisfied
    // by any pair of empty feeds.
    expect(postTitles).toEqual(['A published post'])
    expect(noteTitles).toEqual(['A published note'])
    expect(postTitles).not.toContain('A published note')
    expect(noteTitles).not.toContain('A published post')
  })

  it('leaves a draft or a future-dated note out of both of its feeds', async () => {
    await saveNote({ title: 'Live note', content: 'x', status: 'published', date: PAST })
    await saveNote({ title: 'Draft note', content: 'x', status: 'draft', date: PAST })
    await saveNote({ title: 'Tomorrow note', content: 'x', status: 'published', date: FUTURE })
    for (const path of ['/notes/feed.xml', '/notes/feed.json']) {
      const body = await text(path)
      expect(body).toContain('Live note')
      expect(body).not.toContain('Draft note')
      expect(body).not.toContain('Tomorrow note')
    }
  })

  it('gives each of the four documents its own self link', async () => {
    await savePost({ title: 'P', content: 'b', status: 'published', date: PAST })
    await saveNote({ title: 'N', content: 'x', status: 'published', date: PAST })
    // An aggregator follows `self`/`feed_url` to subscribe. Two documents sharing one would
    // quietly swap a reader's subscription for the other feed.
    expect(await text('/feed.xml')).toContain('href="https://example.com/feed.xml" rel="self"')
    expect(await text('/notes/feed.xml')).toContain('href="https://example.com/notes/feed.xml" rel="self"')
    expect((await json('/feed.json')).feed_url).toBe('https://example.com/feed.json')
    expect((await json('/notes/feed.json')).feed_url).toBe('https://example.com/notes/feed.json')
  })

  it('refuses a note the name of any route under /notes/', async () => {
    for (const slug of ['clip', 'feed.xml', 'feed.json']) {
      // `slugify` strips the dot, so the two feed names arrive as `feedxml`/`feedjson` and
      // are saved — what matters is not which guard fires but that the DOCUMENT still answers.
      await saveNote({ title: 'Impostor', slug, content: 'x', status: 'published', date: PAST })
        .catch(() => undefined)
    }
    clearCache()
    expect((await get('/notes/feed.xml')).headers.get('content-type')).toContain('application/rss+xml')
    expect((await get('/notes/feed.json')).headers.get('content-type')).toContain('application/feed+json')
    expect(await text('/notes/clip')).not.toContain('Impostor')
  })
})

describe('discovery', () => {
  const SEO_OFF = { autoSchema: true, sitemap: true, llms: true, robots: true, rss: false, ogImage: true, ogFallbackImage: '' }

  it('advertises the site pair everywhere and the notebook pair on /notes', async () => {
    await savePost({ title: 'Hello', content: 'b', status: 'published', date: PAST })
    const post = await text('/hello')
    expect(post).toContain('type="application/rss+xml" title="My Blog" href="/feed.xml"')
    expect(post).toContain('type="application/feed+json" title="My Blog" href="/feed.json"')
    // A post page advertises the site's two and nothing else: an archive it is not in has no
    // business appearing in its head.
    expect(post).not.toContain('/notes/feed')

    const notes = await text('/notes')
    for (const href of ['/feed.xml', '/feed.json', '/notes/feed.xml', '/notes/feed.json']) {
      expect(notes).toContain(`href="${href}"`)
    }
  })

  it('advertises nothing and serves nothing when the owner turns the feed off', async () => {
    await savePost({ title: 'Hello', content: 'b', status: 'published', date: PAST })
    await saveNote({ title: 'N', content: 'x', status: 'published', date: PAST })
    await saveSettings({ seo: SEO_OFF })
    clearCache()
    // One switch, four documents — `feed-routes.ts` says why there is not one switch each.
    for (const path of ['/feed.xml', '/feed.json', '/notes/feed.xml', '/notes/feed.json']) {
      expect((await get(path)).status).toBe(404)
    }
    for (const page of ['/hello', '/notes']) {
      expect(await text(page)).not.toContain('rel="alternate"')
    }
  })
})
