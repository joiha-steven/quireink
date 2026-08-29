// The four machine-readable documents: the RSS feed, the sitemap, robots.txt and llms.txt,
// plus the two URLs that are only ever a 301 into one of them.
//
// Split out of `pages.test.ts` on 2026-08-29, when restoring the last of the 1.x SEO
// parity (term entries, image entries, the three crawler groups) took that file past the
// 400-line rule. The seam is the one `web/feed-routes.ts` was cut on: every other case in
// `pages.test.ts` asserts what a person sees, and every case here asserts what a program
// reads. Its OWN database directory, like every web test: `openDatabases` holds one
// connection pair per process, so two files sharing a directory close each other's.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-feeds'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)

const PAST = '2020-01-01T00:00:00.000Z'
const FUTURE = '2099-01-01T00:00:00.000Z'

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings', 'media', 'redirects']) {
    db().run(`delete from ${t}`)
  }
})

describe('machine-readable surfaces', () => {
  it('serves RSS, sitemap, robots and llms.txt', async () => {
    await saveSettings({ title: 'My Blog', siteUrl: 'https://example.com' })
    await savePost({ title: 'Hello', content: 'body', status: 'published', date: PAST, excerpt: 'A summary' })
    await savePage({ title: 'About', content: 'body', status: 'published' })

    const feed = await get('/feed.xml')
    expect(feed.headers.get('content-type')).toContain('application/rss+xml')
    const xml = await feed.text()
    expect(xml).toContain('<link>https://example.com/hello</link>')
    expect(xml).toContain('A summary')

    const sitemap = await get('/sitemap.xml').then((r) => r.text())
    expect(sitemap).toContain('http://www.sitemaps.org/schemas/sitemap/0.9')
    expect(sitemap).toContain('<loc>https://example.com/about</loc>')

    const robots = await get('/robots.txt').then((r) => r.text())
    expect(robots).toContain('Disallow: /admin')
    expect(robots).toContain('Sitemap: https://example.com/sitemap.xml')

    expect(await get('/llms.txt').then((r) => r.text())).toContain('(https://example.com/hello)')
  })

  it('excludes drafts and future posts from every feed', async () => {
    await saveSettings({ siteUrl: 'https://example.com' })
    await savePost({ title: 'Draft', content: 'body', status: 'draft', date: PAST })
    await savePost({ title: 'Later', content: 'body', status: 'published', date: FUTURE })
    for (const path of ['/feed.xml', '/sitemap.xml', '/llms.txt']) {
      const body = await get(path).then((r) => r.text())
      expect(body).not.toContain('/draft')
      expect(body).not.toContain('/later')
    }
  })

  it('404s a feed the owner turned off, rather than serving an empty one', async () => {
    await saveSettings({ seo: { autoSchema: true, sitemap: false, llms: true, robots: true, rss: false, ogImage: true, ogFallbackImage: '' } })
    expect((await get('/feed.xml')).status).toBe(404)
    expect((await get('/sitemap.xml')).status).toBe(404)
    expect((await get('/llms.txt')).status).toBe(200)
  })

  it('names every archive a reader can reach, dated by its newest post', async () => {
    // Restored parity: a blog's category and tag pages appeared in no sitemap at all, so
    // the archives a reader browses by were the pages a crawler had to guess at.
    await saveSettings({ siteUrl: 'https://example.com' })
    await savePost({
      title: 'Older', content: 'body', status: 'published',
      date: '2020-01-01T00:00:00.000Z', categories: ['Ghi chép'], tags: ['bun'],
    })
    await savePost({
      title: 'Newer', content: 'body', status: 'published',
      date: '2021-06-05T00:00:00.000Z', categories: ['Ghi chép'],
    })
    // `savePost` stamps `updated_at` with the wall clock and `lastmod` prefers it, so every
    // entry would read "today" and prove nothing about WHICH post a term follows. Backdating
    // the column to each post's own date is what a blog that has not been edited since
    // publishing actually looks like.
    db().run(`update posts set updated_at = date`)
    clearCache()

    const xml = await get('/sitemap.xml').then((r) => r.text())
    expect(xml).toContain('<loc>https://example.com/tag/bun</loc><lastmod>2020-01-01</lastmod>')
    // The term page IS its posts, so it changed when the NEWEST of them did — not the one
    // that happens to be first in the list.
    expect(xml).toContain('<loc>https://example.com/category/ghi-chep</loc><lastmod>2021-06-05</lastmod>')
    // Once each, even though two posts carry the category.
    expect(xml.match(/category\/ghi-chep/g)?.length).toBe(1)
  })

  it('leaves a term out when only a draft still carries it', async () => {
    // `/category/x` resolves against the PUBLIC posts and 404s otherwise, so a term read
    // off the full index would be a sitemap URL that answers 404.
    await saveSettings({ siteUrl: 'https://example.com' })
    await savePost({ title: 'Unfinished', content: 'body', status: 'draft', date: PAST, tags: ['secret'] })
    expect(await get('/sitemap.xml').then((r) => r.text())).not.toContain('/tag/secret')
  })

  it('carries a post\'s own images, and declares the namespace only when it does', async () => {
    await saveSettings({ siteUrl: 'https://example.com' })
    await savePost({ title: 'Plain', content: 'body', status: 'published', date: PAST })
    const plain = await get('/sitemap.xml').then((r) => r.text())
    expect(plain).not.toContain('image:')

    clearCache()
    await savePost({
      title: 'Illustrated', content: 'body', status: 'published', date: PAST,
      coverImage: '/uploads/media/hero.jpg', featuredImage: 'https://cdn.example.net/card.png',
    })
    const xml = await get('/sitemap.xml').then((r) => r.text())
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
    // Root-relative refs are made absolute; an already-absolute one is left alone.
    expect(xml).toContain('<image:loc>https://example.com/uploads/media/hero.jpg</image:loc>')
    expect(xml).toContain('<image:loc>https://cdn.example.net/card.png</image:loc>')
    // The post with no images gets no empty element on its own entry.
    const plainEntry = xml.split('\n').find((l) => l.includes('/plain</loc>')) ?? ''
    expect(plainEntry).not.toContain('image:')
  })

  it('answers the plural /sitemaps.xml, which 1.x did and some old submissions still use', async () => {
    const res = await get('/sitemaps.xml')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/sitemap.xml')
  })

  it('tells search engines and AI crawlers apart from link miners, and blocks neither AI group', async () => {
    await saveSettings({ siteUrl: 'https://example.com' })
    const robots = await get('/robots.txt').then((r) => r.text())
    // Search and AI share one group, and it is an ALLOW. Whether a blog feeds a model is
    // the owner's call about their own writing, so the default may not be a block.
    expect(robots).toContain('User-agent: Googlebot')
    expect(robots).toContain('User-agent: GPTBot')
    expect(robots).toContain('User-agent: ClaudeBot')
    const allowGroup = robots.split('\n\n')[0] ?? ''
    expect(allowGroup).toContain('User-agent: GPTBot')
    expect(allowGroup).toContain('Allow: /')
    expect(allowGroup).toContain('Disallow: /admin')
    // The SEO/backlink miners are the only group turned away entirely.
    const scraperGroup = robots.split('\n\n')[1] ?? ''
    expect(scraperGroup).toContain('User-agent: AhrefsBot')
    expect(scraperGroup).toContain('Disallow: /')
    expect(scraperGroup).not.toContain('Allow: /')
    // ...and an unknown crawler is still welcome.
    expect(robots).toContain('User-agent: *\nAllow: /')
  })

  it('escapes XML rather than letting a title break the document', async () => {
    await saveSettings({ siteUrl: 'https://example.com' })
    await savePost({ title: 'Tom & Jerry <fight>', content: 'body', status: 'published', date: PAST })
    const xml = await get('/feed.xml').then((r) => r.text())
    expect(xml).toContain('Tom &amp; Jerry &lt;fight&gt;')
    expect(xml).not.toContain('<fight>')
  })
})
