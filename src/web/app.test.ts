// The public router, driven through real HTTP requests against a real database.
//
// The two assertions that matter most are not about markup. One: an article page ships
// ZERO JavaScript, which is the M2 gate and is trivially lost the first time someone
// reaches for a script tag. Two: a draft and a future-dated post are not reachable, which
// is a content leak rather than a bug.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache, pageCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-web'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
// `app.request` is typed `Response | Promise<Response>`; awaiting it once here keeps
// every call site a plain promise.
const get = async (path: string): Promise<Response> => app.request(path)

const PAST = '2020-01-01T00:00:00.000Z'
const FUTURE = '2099-01-01T00:00:00.000Z'

/** The hashed sheet a page links to. */
const sheetHref = (html: string): string =>
  /<link rel="stylesheet" href="([^"]+)">/.exec(html)?.[1] ?? ''

/**
 * The served stylesheet, fetched the way a browser would.
 *
 * The static rules moved out of the page, so an assertion about a CSS rule has to follow
 * them. Asserting against `PUBLIC_CSS` directly would pass even if the route stopped
 * serving it.
 */
const sheetText = async (): Promise<string> => {
  await savePost({ title: 'Sheet Probe', content: 'x', status: 'published', date: PAST })
  const href = sheetHref(await get('/sheet-probe').then((r) => r.text()))
  return get(href).then((r) => r.text())
}

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings', 'media', 'redirects']) {
    db().run(`delete from ${t}`)
  }
})

describe('article page', () => {
  it('renders a published post: title, body, and the site name', async () => {
    await saveSettings({ title: 'My Blog' })
    await savePost({ title: 'Hello World', content: '## A section\n\nSome **prose**.', status: 'published', date: PAST })
    const res = await get('/hello-world')
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    // The title carries the type-role classes rather than leaning on an element selector,
    // and the meta line sits ABOVE it, so match the classes and not the bare tag.
    expect(html).toContain('class="reading-font mt-2 fs-h1 font-semibold">Hello World</h1>')
    expect(html).toContain('<h2 id="a-section">A section</h2>')
    expect(html).toContain('<strong>prose</strong>')
    expect(html).toContain('My Blog')
  })

  // The licence's only enforcement surface, pinned rather than trusted: §2(c) asks that the
  // software's own name stay visible, and the footer cannot carry that — it is a SETTING, and
  // §2(a) says a setting is not a source change. See ADR 0038.
  it('names itself and its version in a place no setting can edit', async () => {
    await savePost({ title: 'Attributed', content: 'body', status: 'published', date: PAST })
    const html = await get('/attributed').then((r) => r.text())
    const pkg = await Bun.file('package.json').json() as { version: string }
    expect(html).toContain(`<meta name="generator" content="Quire Ink ${pkg.version}">`)
  })

  it('ships TWO deferred scripts and no inline JavaScript at all', async () => {
    await savePost({ title: 'Quiet', content: 'body', status: 'published', date: PAST })
    const html = await get('/quiet').then((r) => r.text())
    // The budget is a number, not a vibe: the moment a third bundle or an inline block
    // appears on an article page, this fails. `core` is the analytics beacon, which every
    // public page carries; `post` is the islands.
    //
    // EXECUTABLE scripts, which is the property the recommended CSP depends on. A
    // `type="application/ld+json"` block is a DATA block: the browser never executes it and
    // `script-src 'self'` does not touch it. Measured 2026-08-25 in a real browser against a
    // page carrying `script-src 'self'` with no `'unsafe-inline'` — the block parsed and the
    // console stayed empty. Counting every `<script` instead made this test fail the day
    // structured data arrived, which is a test failing for being imprecise, not for a bug.
    const executable = html.match(/<script(?![^>]*\btype="application\/ld\+json")/g) ?? []
    expect(executable.length).toBe(2)
    expect(html).toMatch(/<script src="\/assets\/core\.[a-z0-9]+\.js" defer><\/script>/)
    expect(html).toMatch(/<script src="\/assets\/post\.[a-z0-9]+\.js" defer><\/script>/)
    // No inline block that a browser would RUN.
    expect(html).not.toMatch(/<script(?![^>]*\b(?:src=|type="application\/ld\+json"))/)
    expect(html).not.toContain('onload=')
    expect(html).not.toContain('onclick=')
  })

  // The page cache is keyed by URL alone (Invariant 1), so the header cannot branch on the
  // reader's theme: whichever mode the first visitor had would be cached for everyone.
  // Both marks go in the markup and CSS picks. These two assertions are what stops someone
  // "simplifying" that into a server-side conditional.
  describe('the dark logo', () => {
    it('emits both marks when one is set, and only the light one carries fetchpriority', async () => {
      await saveSettings({
        showLogo: true, logoUrl: '/uploads/files/light.svg', logoDarkUrl: '/uploads/files/dark.svg',
      })
      const html = await get('/').then((r) => r.text())
      expect(html).toContain('light.svg')
      expect(html).toContain('dark.svg')
      expect(html).toMatch(/class="logo logo-dark"/)
      // Exactly one LCP candidate, and on a light page it is the light mark.
      expect((html.match(/fetchpriority="high"/g) ?? []).length).toBe(1)
      expect(html).toMatch(/class="logo" src="[^"]*light\.svg"[^>]*fetchpriority="high"/)
    })

    it('emits one mark when no dark twin is set', async () => {
      await saveSettings({ showLogo: true, logoUrl: '/uploads/files/light.svg', logoDarkUrl: '' })
      const html = await get('/').then((r) => r.text())
      expect(html).toContain('light.svg')
      // The class NAME is in the inlined stylesheet either way; what must be absent is a
      // second <img> wearing it.
      expect(html).not.toMatch(/class="logo logo-dark"/)
      expect((html.match(/<img class="logo/g) ?? []).length).toBe(1)
    })
  })

  it('gives a listing the beacon and nothing else', async () => {
    await savePost({ title: 'Listed', content: 'body', status: 'published', date: PAST })
    const html = await get('/').then((r) => r.text())
    expect((html.match(/<script(?![^>]*\btype="application\/ld\+json")/g) ?? []).length).toBe(1)
    expect(html).toMatch(/<script src="\/assets\/core\./)
    expect(html).not.toContain('/assets/post.') // no island code where there are no islands
  })

  it('serves the bundle immutably, and 404s a hash it does not have', async () => {
    await savePost({ title: 'Quiet', content: 'body', status: 'published', date: PAST })
    const html = await get('/quiet').then((r) => r.text())
    const src = /<script src="([^"]+)"/.exec(html)?.[1] ?? ''
    const res = await get(src)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/javascript')
    expect(res.headers.get('cache-control')).toContain('immutable')
    // An unknown hash is a 404, never a stale body under a name that promises otherwise.
    expect((await get('/assets/post.deadbeef.js')).status).toBe(404)
  })

  it('hands the islands their labels, translated, rather than shipping a locale table', async () => {
    // `features` is saved whole, so the other flags have to be carried across: passing a
    // partial object would silently switch twelve of them off.
    const { features } = await getSettings()
    await saveSettings({ language: 'vi', features: { ...features, progressBar: true } })
    await savePost({ title: 'Nhan', content: 'body', status: 'published', date: PAST })
    const html = await get('/nhan').then((r) => r.text())
    expect(html).toContain('data-back-to-top="')
    expect(html).toContain('data-copy-code="')
    // Vietnamese, not the English fallback: the label crossed the language boundary.
    expect(html).not.toContain('data-back-to-top="Back to top"')
  })

  it('renders the progress bar as markup, with no script behind it', async () => {
    const { features } = await getSettings()
    await saveSettings({ features: { ...features, progressBar: true } })
    await savePost({ title: 'Long', content: 'body', status: 'published', date: PAST })
    const html = await get('/long').then((r) => r.text())
    // Server-rendered and driven by a scroll-driven CSS animation, so it works with
    // JavaScript off. If it ever moves back into the bundle, this fails.
    expect(html).toContain('<div class="progress" aria-hidden="true">')
    // The rule lives in the linked sheet now rather than in the page, so the assertion
    // follows it there. What is being pinned is "no script drives this", not "the bytes
    // happen to sit in the HTML".
    expect(await sheetText()).toContain('animation-timeline:scroll(root block)')
  })

  it('leaves the progress bar out when the owner has it off', async () => {
    const { features } = await getSettings()
    await saveSettings({ features: { ...features, progressBar: false } })
    await savePost({ title: 'Plain', content: 'body', status: 'published', date: PAST })
    const html = await get('/plain').then((r) => r.text())
    expect(html).not.toContain('class="progress"')
  })

  it('preloads the reading font, since it is the LCP resource', async () => {
    await savePost({ title: 'Fonted', content: 'body', status: 'published', date: PAST })
    const html = await get('/fonted').then((r) => r.text())
    expect(html).toContain('rel="preload"')
    expect(html).toContain('as="font"')
    expect(html).toContain('crossorigin')
  })

  it('serves a published page from the same /{slug} namespace', async () => {
    await savePage({ title: 'About', content: 'Who I am.', status: 'published' })
    const html = await get('/about').then((r) => r.text())
    expect(html).toContain('class="reading-font fs-h1 font-semibold">About</h1>')
    expect(html).toContain('Who I am.')
  })

  it('escapes a title rather than letting it reach the page as markup', async () => {
    await savePost({ title: '<script>alert(1)</script>', content: 'body', status: 'published', date: PAST })
    const res = await get('/scriptalert1script')
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('sets the language and the canonical URL from settings', async () => {
    await saveSettings({ language: 'vi', siteUrl: 'https://example.com' })
    await savePost({ title: 'Xin chao', content: 'body', status: 'published', date: PAST })
    const html = await get('/xin-chao').then((r) => r.text())
    expect(html).toContain('<html lang="vi"')
    expect(html).toContain('<link rel="canonical" href="https://example.com/xin-chao">')
  })
})

describe('what must NOT be reachable', () => {
  it('404s a draft', async () => {
    await savePost({ title: 'Secret', content: 'unpublished', status: 'draft', date: PAST })
    const res = await get('/secret')
    expect(res.status).toBe(404)
    expect(await res.text()).not.toContain('unpublished')
  })

  it('404s a scheduled post until its date arrives', async () => {
    await savePost({ title: 'Later', content: 'embargoed', status: 'published', date: FUTURE })
    expect((await get('/later')).status).toBe(404)
  })

  it('404s a trashed post', async () => {
    await savePost({ title: 'Gone', content: 'body', status: 'published', date: PAST })
    db().run(`update posts set deleted_at = 1 where slug = 'gone'`)
    expect((await get('/gone')).status).toBe(404)
  })

  it('404s an unknown slug and a draft page', async () => {
    await savePage({ title: 'Hidden', content: 'body', status: 'draft' })
    expect((await get('/nothing-here')).status).toBe(404)
    expect((await get('/hidden')).status).toBe(404)
  })
})

describe('the page cache (Invariant 1)', () => {
  it('serves the second request from memory', async () => {
    await savePost({ title: 'Cached', content: 'v1', status: 'published', date: PAST })
    await get('/cached')
    expect(pageCache.has('/cached')).toBe(true)
    // Change the row behind the cache's back: a cache hit must return the OLD html.
    db().run(`update posts set content = 'v2' where slug = 'cached'`)
    expect(await get('/cached').then((r) => r.text())).toContain('v1')
  })

  it('is emptied COMPLETELY by clearCache, so no write can under-purge', async () => {
    await savePost({ title: 'One', content: 'a', status: 'published', date: PAST })
    await savePost({ title: 'Two', content: 'b', status: 'published', date: PAST })
    await get('/one')
    await get('/two')
    expect(pageCache.size).toBe(2)
    clearCache()
    expect(pageCache.size).toBe(0)
    db().run(`update posts set content = 'c' where slug = 'one'`)
    expect(await get('/one').then((r) => r.text())).toContain('c')
  })

  it('does not cache a 404, so publishing makes the page appear', async () => {
    await savePost({ title: 'Pending', content: 'body', status: 'draft', date: PAST })
    expect((await get('/pending')).status).toBe(404)
    await savePost({ title: 'Pending', content: 'body', status: 'published', date: PAST }, 'pending')
    expect((await get('/pending')).status).toBe(200)
  })
})

describe('the feed hands itself back a chunk at a time', () => {
  // The frozen tree kept the tail of the archive in React state and revealed one page at a
  // time as the reader scrolled. 2.0 rendered all 68 posts at once, which is what the owner
  // meant by "it feels like everything loads in one go". The cards are all rendered — so a
  // crawler and a reader with no JavaScript still get the whole archive — and the ones past
  // the first page are MARKED, for the island to hide and give back.
  it('marks every card past the first page, and guards the hiding with noscript', async () => {
    await saveSettings({ postsPerPage: 2, features: { ...(await getSettings()).features, infiniteScroll: true } })
    for (let i = 0; i < 5; i++) {
      await savePost({ title: `Post ${i}`, content: 'x', status: 'published', date: PAST })
    }
    const html = await (await get('/')).text()
    // Count the ARTICLES, not the string: it also appears in the sheet and in the noscript
    // guard, which is how the first version of this test read five where three were meant.
    const marked = html.match(/<article[^>]*data-more/g)?.length ?? 0
    expect(marked).toBe(3)
    // Hiding content is only safe when the thing that undoes it is guaranteed to exist.
    expect(html).toContain('<noscript>')
    expect(html).toContain('html[data-chunked] .post-list article[data-more]{display:block}')
  })

  it('eases each card in, which nothing in the sheet used to do', async () => {
    await savePost({ title: 'Solo', content: 'x', status: 'published', date: PAST })
    const html = await (await get('/')).text()
    // The class has been on every card since M2; the rule that matches it had not been
    // written, so the cards simply appeared.
    expect(html).toContain('class="reveal"')
    const sheet = await sheetText()
    expect(sheet).toContain('@keyframes reveal-in')
    expect(sheet).toContain('animation-timeline:view()')
  })
})

describe('what a shared cache may do with a page', () => {
  // Nothing was sent at all, so the CDN decided for itself: a staging article came back
  // from the edge two deploys stale. On the live domain that is a published post nobody
  // can see.
  it('lets the edge hold a public page briefly, and refresh behind the reader', async () => {
    await savePost({ title: 'Public', content: 'body', status: 'published', date: PAST })
    const res = await get('/public')
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=600')
  })

  it('never lets a shared cache hold the owner in', async () => {
    // A sign-in page or an admin shell in a shared cache is a page served to somebody it
    // was not rendered for.
    expect((await get('/login')).headers.get('cache-control')).toBe('private, no-store')
  })

  it('does not let a 404 be cached as though it were a page', async () => {
    expect((await get('/nothing-here')).headers.get('cache-control')).toBe('private, no-store')
  })
})

describe('the series card', () => {
  const part = (slug: string, title: string, order: number) =>
    savePost({ title, slug, status: 'published', date: PAST, series: 'Ten Years', seriesOrder: order })

  it('links to the series page, says which part, and marks the current one', async () => {
    await part('one', 'Part One', 1)
    await part('two', 'Part Two', 2)
    await part('three', 'Part Three', 3)

    const html = await (await get('/two')).text()
    // The series page existed and NOTHING on the site linked to it, which is most of why
    // the feature read as missing.
    expect(html).toContain('href="/series/ten-years"')
    expect(html).toContain('2/3')
    // The part you are reading is not a link to itself. "page" rather than "true": the
    // token that tells assistive tech WHAT kind of current this is — the page you are on.
    expect(html).toMatch(/<li aria-current="page">Part Two<\/li>/)
    expect(html).toContain('href="/one"')
  })

  // It belongs above the body: the point of it is knowing where you are BEFORE reading.
  it('sits above the article body, not after it', async () => {
    await part('one', 'Part One', 1)
    await part('two', 'Part Two', 2)
    const html = await (await get('/one')).text()
    expect(html.indexOf('class="series"')).toBeLessThan(html.indexOf('id="post-body"'))
  })

  it('is absent for a post that is alone in its series', async () => {
    await part('only', 'The Only One', 1)
    expect(await (await get('/only')).text()).not.toContain('class="series"')
  })
})

describe('the series block in the sidebar', () => {
  // With a category and a tag, so the ORDER of the three blocks can be asserted.
  const inSeries = (slug: string, title: string, order: number) =>
    savePost({ title, slug, status: 'published', date: PAST, series: 'Ten Years',
      seriesOrder: order, categories: ['Essays'], tags: ['history'] })

  it('lists each series under the categories, with a count and a link', async () => {
    await inSeries('one', 'Part One', 1)
    await inSeries('two', 'Part Two', 2)
    const html = await (await get('/')).text()

    expect(html).toContain('href="/series/ten-years"')
    expect(html).toContain('Ten Years')
    // Under the categories and above the tags: a series is a reading ORDER, not a subject.
    const cats = html.indexOf('>Categories<')
    const series = html.indexOf('>Series<')
    const tags = html.indexOf('>Tags<')
    expect(cats).toBeGreaterThan(-1)
    expect(series).toBeGreaterThan(cats)
    if (tags > -1) expect(tags).toBeGreaterThan(series)
  })

  it('is gone when the owner turns it off, and the rest of the rail stays', async () => {
    await inSeries('one', 'Part One', 1)
    const on = await getSettings()
    await saveSettings({ features: { ...on.features, sidebarSeries: false } })
    clearCache()
    const html = await (await get('/')).text()
    expect(html).not.toContain('href="/series/ten-years"')
    expect(html).toContain('rail')
    await saveSettings({ features: { ...on.features, sidebarSeries: true } })
    clearCache()
  })
})
