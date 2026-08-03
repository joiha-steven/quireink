// The document shell every public page is rendered into, and the one page that had none.
//
// Separate from `app.test.ts` because the subject is different: that file drives the router
// and asserts what a URL RESOLVES to, this one asserts what wraps the answer. It exists as
// its own file because a miss used to escape the shell entirely — `text/plain` carries no
// viewport meta, so a phone laid the two words out at the default 980px desktop width and
// let the reader pan the page sideways. Measured at 390px: the document was 980px wide.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache, pageCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-shell'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)

const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(async () => {
  db().run('delete from posts')
  clearCache()
  await savePost({
    title: 'A Published Post', slug: 'published', content: 'Body.',
    status: 'published', date: PAST, categories: ['Essays'],
  })
})

describe('a URL that is not here', () => {
  it('is a page in the site shell, with the viewport meta a phone needs', async () => {
    const res = await get('/khong-co-trang-nay')
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('name="viewport"')
    expect(html).toContain('width=device-width')
    // Dressed as an empty listing rather than as a new kind of page, and it offers the
    // way back, which the two words did not.
    expect(html).toContain('listing-head')
    expect(html).toContain('href="/"')
  })

  it('is refused by a shared cache, because a cached miss outlives its reason', async () => {
    const res = await get('/khong-co-trang-nay')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  // `paginate` CLAMPS an out-of-range page, so these two took a different path to the same
  // bare-text answer and have to be checked separately.
  it('answers a malformed page number the same way', async () => {
    for (const path of ['/page/abc', '/category/essays/page/abc']) {
      const res = await get(path)
      expect(res.status).toBe(404)
      expect(res.headers.get('content-type')).toContain('text/html')
    }
  })

  it('is never written to the page cache', async () => {
    await get('/khong-co-trang-nay')
    expect(pageCache.get('/khong-co-trang-nay')).toBeUndefined()
  })
})

describe('the head of every public page', () => {
  it('points at the feed, so an aggregator can find it', async () => {
    const html = await (await get('/')).text()
    expect(html).toContain('rel="alternate"')
    expect(html).toContain('type="application/rss+xml"')
    expect(html).toContain('href="/feed.xml"')
  })

  it('does not advertise the feed when the owner has it switched off', async () => {
    const on = await getSettings()
    await saveSettings({ seo: { ...on.seo, rss: false } })
    clearCache()
    const html = await (await get('/')).text()
    expect(html).not.toContain('application/rss+xml')
    await saveSettings({ seo: { ...on.seo, rss: true } })
    clearCache()
  })
})

describe('the first tab stop on every public page', () => {
  // Without it a keyboard reader tabs through four header controls, the whole contents rail
  // and the info panel before reaching the article.
  it('is a skip link that lands on the main element', async () => {
    const html = await (await get('/')).text()
    const skip = html.indexOf('class="skip-link" href="#content"')
    expect(skip).toBeGreaterThan(-1)
    // FIRST, ahead of the header's own controls: a skip link after them skips nothing.
    expect(skip).toBeLessThan(html.indexOf('class="site-bar"'))
    expect(html).toContain('<main id="content"')
  })

  it('is on an article too, not only a listing', async () => {
    const html = await (await get('/published')).text()
    expect(html).toContain('class="skip-link" href="#content"')
    expect(html).toContain('<main id="content"')
  })
})

describe('what a shared cache is told about the machine-readable surfaces', () => {
  // These sent no cache-control at all, so every poll rebuilt the document at the origin.
  it('lets the edge hold the feeds', async () => {
    for (const path of ['/feed.xml', '/sitemap.xml', '/robots.txt', '/llms.txt']) {
      const res = await get(path)
      expect(res.status).toBe(200)
      expect(res.headers.get('cache-control')).toContain('s-maxage=300')
    }
  })

  // The blanket rule refuses a shared cache anything under /api. This is the one thing
  // under there that is public by design, and it was being rebuilt on every request.
  it('lets the edge hold the public search index', async () => {
    const res = await get('/api/search/index')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('s-maxage=300')
  })

  it('still refuses the edge everything else under /api', async () => {
    const res = await get('/api/search?q=published')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })
})

describe('the reader\'s own text, put back into the page', () => {
  // A live reflected XSS, found on 2026-07-30 and reproduced against a local instance before
  // it was fixed: `search-page.ts` had grown its own escaper covering `& < >` and nothing
  // else, and it interpolated the query into value="…". The response carried
  // `value="" onfocus=alert(1) autofocus x=""` — an event handler that fires on load, on a
  // public page, from a link anybody can send.
  it('cannot break out of the search field to add an event handler', async () => {
    const res = await get('/search?q=' + encodeURIComponent('" onfocus=alert(1) autofocus x="'))
    expect(res.status).toBe(200)
    const html = await res.text()
    const input = /<input type="search"[^>]*>/.exec(html)?.[0] ?? ''
    // The whole payload is INSIDE the value, entities and all, so `onfocus=` is text the
    // reader typed rather than an attribute the browser will honour.
    expect(input).toContain('value="&quot; onfocus=alert(1) autofocus x=&quot;"')
    // Four attributes (type, name, value, aria-label), so eight quote characters. Breaking out
    // of the value adds more, which is the failure this asserts against without depending on
    // what the payload happens to be.
    expect((input.match(/"/g) ?? []).length).toBe(8)
  })

  it('escapes a tag in the query rather than rendering it', async () => {
    const html = await (await get('/search?q=' + encodeURIComponent('<img src=x onerror=alert(1)>'))).text()
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })
})

describe('the owner menu on the header row', () => {
  // The menu lives at the top of the listing rail and that is the ONLY place it renders —
  // except on a page that has no rail to hold it, which today is the composed front page
  // alone (ADR 0014). It briefly rendered on every page, which put the same links twice on
  // every listing; the owner called that wrong on 2026-08-03.
  const menu = [{ label: 'Essays', href: '/category/essays' }, { label: 'About', href: '/about' }]

  /** Put the site into newspaper mode and fetch `/`, which is the one rail-less layout. */
  const front = async (): Promise<string> => {
    const s = await getSettings()
    await saveSettings({ home: { ...s.home, mode: 'front' } })
    clearCache()
    return (await get('/')).text()
  }

  const navOf = (html: string) => /<nav class="site-menu[^>]*>.*?<\/nav>/s.exec(html)?.[0] ?? ''

  it('renders the owner links in the header of the newspaper front page', async () => {
    await saveSettings({ menu })
    const nav = navOf(await front())
    expect(nav).toContain('href="/category/essays"')
    expect(nav).toContain('>Essays<')
    expect(nav).toContain('href="/about"')
  })

  it('keeps the header clear on an article, where the menu is not the header\'s job', async () => {
    // The regression this guards: the menu on every page. An article has a rail (its table
    // of contents) and a drawer below the breakpoint, and neither is the header.
    await saveSettings({ menu })
    clearCache()
    expect(await (await get('/published')).text()).not.toContain('site-menu')
  })

  it('keeps the header clear on a listing, where the rail already carries it', async () => {
    const s = await getSettings()
    await saveSettings({ menu, home: { ...s.home, mode: 'list' } })
    clearCache()
    const html = await (await get('/')).text()
    expect(html).not.toContain('site-menu')
    // …and it really is in the rail on that page, so the links did not simply vanish.
    expect(html).toContain('href="/category/essays"')
  })

  it('renders nothing at all when the owner has configured no menu', async () => {
    await saveSettings({ menu: [] })
    expect(await front()).not.toContain('site-menu')
  })

  it('opens an external link in a new tab and an internal one in place', async () => {
    await saveSettings({ menu: [{ label: 'Group', href: 'https://example.com/g' }, ...menu] })
    const nav = navOf(await front())
    expect(nav).toContain('href="https://example.com/g" target="_blank" rel="noopener"')
    // The internal one carries no target, or every in-site click would spawn a tab.
    expect(/href="\/about"(?! target)/.test(nav)).toBe(true)
  })

  it('escapes a label and an href rather than letting them close the tag', async () => {
    await saveSettings({ menu: [{ label: '<img src=x onerror=alert(1)>', href: '/"onmouseover="alert(1)' }] })
    const html = await front()
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('onmouseover="alert(1)"')
  })
})
