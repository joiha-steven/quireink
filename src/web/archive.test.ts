// The two ways into an old post that the blog did not have: `/archive`, and a feed per
// archive.
//
// Both are new URLs on a live site, so most of what is asserted here is the NEGATIVE half —
// the switch really turns the page off, a term that does not exist answers 404 rather than
// an empty feed, and a feed's `self` link is the URL it was fetched from. An RSS document
// whose `self` points somewhere else silently re-subscribes the reader to something they
// did not pick, and nothing about the page they clicked from would ever show it.
//
// Its own database directory, like every other file in this harness: `openDatabases` holds
// one connection pair per process.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { byYear } from '@/content/archive'

const DIR = './.tmp/test-archive'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)
const text = async (path: string): Promise<string> => (await get(path)).text()

beforeEach(async () => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'settings']) db().run(`delete from ${t}`)
  await saveSettings({ title: 'My Blog', siteUrl: 'https://example.com' })
})

const publish = (title: string, date: string, over: Record<string, unknown> = {}) =>
  savePost({ title, content: 'body text here', status: 'published', date, ...over })

const off = async (key: 'archive') => {
  const s = await getSettings()
  await saveSettings({ features: { ...s.features, [key]: false } })
  clearCache()
}

describe('grouping', () => {
  it('reads the year off the ISO string, not off a Date in the server zone', () => {
    // 02:00 UTC on 1 January is the previous year on any machine west of Greenwich, which
    // is what `new Date(iso).getFullYear()` would have returned on the deploy host.
    const posts = byYear([
      { title: 'a', slug: 'a', date: '2026-01-01T02:00:00.000Z', status: 'published', categories: [], tags: [] },
    ])
    expect(posts).toHaveLength(1)
    expect(posts[0]?.year).toBe(2026)
  })

  it('sorts years newest first and posts newest first inside a year', async () => {
    const p = (slug: string, date: string) =>
      ({ title: slug, slug, date, status: 'published' as const, categories: [], tags: [] })
    const years = byYear([
      p('mid-2024', '2024-06-01T00:00:00.000Z'),
      p('late-2026', '2026-08-01T00:00:00.000Z'),
      p('early-2026', '2026-02-01T00:00:00.000Z'),
    ])
    expect(years.map((y) => y.year)).toEqual([2026, 2024])
    expect(years[0]?.posts.map((x) => x.slug)).toEqual(['late-2026', 'early-2026'])
  })
})

describe('/archive', () => {
  it('lists every published post, grouped under a heading per year', async () => {
    await publish('From 2024', '2024-03-04T00:00:00.000Z')
    await publish('From 2026', '2026-08-29T00:00:00.000Z')
    const html = await text('/archive')
    expect(html).toContain('id="y2026"')
    expect(html).toContain('id="y2024"')
    expect(html).toContain('From 2024')
    expect(html).toContain('From 2026')
    // Newest year first, which is the whole reading order of the page.
    expect(html.indexOf('id="y2026"')).toBeLessThan(html.indexOf('id="y2024"'))
    // The date column is MM-DD; the year is the heading it sits under.
    expect(html).toContain('<time datetime="2026-08-29">08-29</time>')
  })

  it('does not show a draft, a trashed post or a future one', async () => {
    await publish('Public', '2026-01-01T00:00:00.000Z')
    await savePost({ title: 'Draft', content: 'x', status: 'draft', date: '2026-01-02T00:00:00.000Z' })
    await publish('Tomorrow', '2099-01-01T00:00:00.000Z')
    const html = await text('/archive')
    expect(html).toContain('Public')
    expect(html).not.toContain('Draft')
    expect(html).not.toContain('Tomorrow')
  })

  it('drops the jump row when there is only one year to jump to', async () => {
    await publish('Only', '2026-01-01T00:00:00.000Z')
    expect(await text('/archive')).not.toContain('arc-jump')
    await publish('Older', '2024-01-01T00:00:00.000Z')
    clearCache()
    expect(await text('/archive')).toContain('arc-jump')
  })

  it('is a real page with a heading and its own description, not the site tagline', async () => {
    await saveSettings({ description: 'A tagline' })
    await publish('One', '2026-01-01T00:00:00.000Z')
    const html = await text('/archive')
    expect(html).toContain('<h1>Archive</h1>')
    expect(html).toContain('Every post on My Blog, by year.')
    expect(html).not.toContain('content="A tagline"')
  })

  it('404s when the owner switches it off, and leaves the sitemap', async () => {
    await publish('One', '2026-01-01T00:00:00.000Z')
    expect((await get('/archive')).status).toBe(200)
    expect(await text('/sitemap.xml')).toContain('https://example.com/archive')
    await off('archive')
    expect((await get('/archive')).status).toBe(404)
    // A URL a switched-off feature does not serve must not be advertised to a crawler.
    expect(await text('/sitemap.xml')).not.toContain('https://example.com/archive')
  })

  it('puts the years in the sidebar, pointing at anchors rather than at pages', async () => {
    await publish('One', '2026-01-01T00:00:00.000Z')
    await publish('Two', '2024-01-01T00:00:00.000Z')
    const html = await text('/')
    expect(html).toContain('href="/archive#y2026"')
    expect(html).toContain('href="/archive#y2024"')
    await off('archive')
    expect(await text('/')).not.toContain('/archive#y')
  })
})

describe('a page the owner already publishes at that slug', () => {
  it('keeps the URL, and the year index gives way', async () => {
    await publish('A post', '2026-01-01T00:00:00.000Z')
    await savePage({
      title: 'My own archive', slug: 'archive', status: 'published',
      content: 'Everything here, by subject.',
    })
    clearCache()
    const html = await text('/archive')
    // The owner's words, not ours. This repository's own demo had exactly this page.
    expect(html).toContain('Everything here, by subject.')
    expect(html).not.toContain('arc-jump')
    expect(html).not.toContain('id="y2026"')
    // ...and the sitemap names the URL once, as the page it really is.
    const xml = await text('/sitemap.xml')
    expect(xml.split('https://example.com/archive<').length - 1).toBe(1)
  })
})

describe('the feed for one archive', () => {
  const withTerms = (title: string, date: string) =>
    publish(title, date, { categories: ['Money'], tags: ['edc'], series: 'A Series', seriesOrder: 1 })

  it('serves a category, a tag and a series, each naming itself', async () => {
    await withTerms('Filed', '2026-01-01T00:00:00.000Z')
    for (const [path, name] of [
      ['/category/money/feed.xml', 'Money'],
      ['/tag/edc/feed.xml', 'edc'],
      ['/series/a-series/feed.xml', 'A Series'],
    ] as const) {
      const res = await get(path)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('application/rss+xml')
      const xml = await res.text()
      expect(xml).toContain(`<title>${name} · My Blog</title>`)
      expect(xml).toContain('<title>Filed</title>')
      // The self link IS the URL this document was fetched from. Pointing it at the site
      // feed would swap the reader's subscription for the whole blog without a word.
      expect(xml).toContain(`href="https://example.com${path}" rel="self"`)
    }
  })

  it('carries only that archive\'s posts', async () => {
    await withTerms('Filed', '2026-01-01T00:00:00.000Z')
    await publish('Unfiled', '2026-02-01T00:00:00.000Z')
    const xml = await text('/category/money/feed.xml')
    expect(xml).toContain('Filed')
    expect(xml).not.toContain('Unfiled')
  })

  it('404s for a term that does not exist, rather than serving an empty channel', async () => {
    await withTerms('Filed', '2026-01-01T00:00:00.000Z')
    // An empty feed reads as a broken site to an aggregator; a 404 reads as what it is.
    expect((await get('/category/nothing-here/feed.xml')).status).toBe(404)
    expect((await get('/tag/nothing-here/feed.xml')).status).toBe(404)
    expect((await get('/series/nothing-here/feed.xml')).status).toBe(404)
  })

  it('goes when RSS goes, because that switch is an answer about feeds', async () => {
    await withTerms('Filed', '2026-01-01T00:00:00.000Z')
    const s = await getSettings()
    await saveSettings({ seo: { ...s.seo, rss: false } })
    clearCache()
    expect((await get('/category/money/feed.xml')).status).toBe(404)
    expect((await get('/feed.xml')).status).toBe(404)
    // ...and the page stops advertising it in the same breath.
    expect(await text('/category/money')).not.toContain('/category/money/feed.xml')
  })

  it('is advertised on its own archive page, beside the site feed', async () => {
    await withTerms('Filed', '2026-01-01T00:00:00.000Z')
    const html = await text('/category/money')
    expect(html).toContain('href="/feed.xml"')
    expect(html).toContain('title="Money · My Blog" href="/category/money/feed.xml"')
  })
})
