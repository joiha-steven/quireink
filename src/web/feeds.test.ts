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

  /**
   * A series is a public address with a feed of its own, and it appeared in no sitemap until
   * 2026-09-19 — a crawler could only reach one by following a link from a post inside it.
   * The Japanese name is the second half: `seriesSlug` keeps the raw letters when nothing can
   * be slugified from them, and a `<loc>` has to carry that percent-encoded.
   */
  it('lists every series, and encodes a name that will not slugify', async () => {
    await saveSettings({ siteUrl: 'https://example.com' })
    await savePost({ title: 'One', content: 'a', status: 'published', date: PAST, series: 'Field notes', seriesOrder: 1 })
    await savePost({ title: 'Two', content: 'b', status: 'published', date: PAST, series: '書体の話', seriesOrder: 1 })
    const xml = await get('/sitemap.xml').then((r) => r.text())
    expect(xml).toContain('https://example.com/series/field-notes')
    expect(xml).toContain(`https://example.com/series/${encodeURIComponent('書体の話')}`)
  })

  it('escapes XML rather than letting a title break the document', async () => {
    await saveSettings({ siteUrl: 'https://example.com' })
    await savePost({ title: 'Tom & Jerry <fight>', content: 'body', status: 'published', date: PAST })
    const xml = await get('/feed.xml').then((r) => r.text())
    expect(xml).toContain('Tom &amp; Jerry &lt;fight&gt;')
    expect(xml).not.toContain('<fight>')
  })
})

describe('the characters XML has no spelling for', () => {
  // ⚠️ A CONFORMING READER REJECTS THE DOCUMENT, NOT THE ITEM. XML 1.0 admits tab, newline and
  // carriage return and nothing else below ` `; a vertical tab, a form feed, an escape, a
  // NUL, half a surrogate pair and `￾` are not characters it can carry at all, and no
  // amount of escaping makes them legal. One post's title stops every subscriber's reader.
  //
  // The owner sees nothing: HTML takes the same character without complaint, so the post's own
  // page is perfect. Measured before the fix: eight of them in `/feed.xml` from four posts.
  // They arrive by import, over MCP, and off a clipboard — a word processor and a terminal both
  // produce them.
  const ch = (c: number): string => String.fromCharCode(c)

  /** Exactly the set XML 1.0 forbids, counted by CHARACTER: a surrogate pair is one of them. */
  const forbidden = (text: string): number[] => {
    const bad: number[] = []
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      if (c >= 0xd800 && c <= 0xdbff) {
        const next = text.charCodeAt(i + 1)
        if (next >= 0xdc00 && next <= 0xdfff) { i += 1; continue }
        bad.push(c)
        continue
      }
      const ok = c === 0x9 || c === 0xa || c === 0xd
        || (c >= 0x20 && c <= 0xd7ff) || (c >= 0xe000 && c <= 0xfffd)
      if (!ok) bad.push(c)
    }
    return bad
  }

  it('the counter-test: this checker reports what it is looking for', () => {
    // Without this, the three below pass on a checker that finds nothing anywhere — which is
    // what the first version did, by calling every emoji illegal and then being loosened.
    expect(forbidden(`a${ch(11)}b`)).toEqual([11])
    expect(forbidden(`a${ch(0)}b`)).toEqual([0])
    expect(forbidden(`a${ch(0xd800)}b`)).toEqual([0xd800])
    expect(forbidden('a\tb\nc\rd')).toEqual([])
    expect(forbidden('Chào 👋🏽 書体')).toEqual([])
  })

  it('are gone from every feed, with the words either side still apart', async () => {
    await saveSettings({ title: `Blog${ch(12)}cua toi`, siteUrl: 'https://example.com' })
    await savePost({
      title: `Tieu de${ch(11)}gay`, content: 'body', status: 'published', date: PAST,
      excerpt: `Tom tat${ch(27)}gay`, categories: ['Muc'], tags: ['The'],
    })
    await savePost({
      title: `Nua cap ${ch(0xd800)} lac`, content: 'body', status: 'published', date: PAST,
      excerpt: `Va ${ch(0xdc00)} nua`, categories: ['Muc'],
    })
    for (const url of ['/feed.xml', '/sitemap.xml', '/category/muc/feed.xml']) {
      const text = await (await get(url)).text()
      expect({ url, bad: forbidden(text) }).toEqual({ url, bad: [] })
    }
    // A space rather than a deletion, so the break the character stood for is still a break.
    expect(await (await get('/feed.xml')).text()).toContain('Tieu de gay')
  })

  it('leaves everything XML does allow exactly alone', async () => {
    await saveSettings({ title: 'Blog', siteUrl: 'https://example.com' })
    await savePost({
      title: 'Chào 👋🏽 書体 & "trích" <thẻ>', content: 'body', status: 'published', date: PAST,
      excerpt: 'Dòng một\nDòng hai\tcách',
    })
    const text = await (await get('/feed.xml')).text()
    // An emoji is a surrogate PAIR and legal; CJK is legal; the five entities are escaped and
    // not stripped. Nothing above is touched by the filter.
    expect(text).toContain('Chào 👋🏽 書体 &amp; &quot;trích&quot; &lt;thẻ&gt;')
    // Tab and newline ARE legal in XML and the filter leaves them — which no field here can
    // show, because `clampExcerpt` collapses an excerpt's whitespace at save time and every
    // other field is a single line by construction. The counter-test above holds that half.
    expect(text).toContain('Dòng một Dòng hai cách')
  })
})
