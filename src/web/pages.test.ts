// The pages that are not one article: listings, search, the shared chrome and the table of
// contents.
//
// Split from `app.test.ts` to stay under the 400-line rule, and split again on 2026-08-29
// when the four machine-readable documents grew past what it could hold — they are in
// `src/web/feeds.test.ts` now, the same seam their source took. Same harness, its OWN
// database directory: `openDatabases` holds one connection pair per process, so two test
// files sharing a directory would close each other's.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache, pageCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-pages'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
// `app.request` is typed `Response | Promise<Response>`; awaiting it once here keeps
// every call site a plain promise.
const get = async (path: string): Promise<Response> => app.request(path)

const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings', 'media', 'redirects']) {
    db().run(`delete from ${t}`)
  }
})

describe('listings', () => {
  const publish = (title: string, over: Record<string, unknown> = {}) =>
    savePost({ title, content: 'body text here', status: 'published', date: PAST, ...over })

  it('lists posts newest first on the home page, with links and excerpts', async () => {
    await saveSettings({ title: 'My Blog', description: 'A tagline' })
    await publish('Older', { date: '2020-01-01T00:00:00.000Z' })
    await publish('Newer', { date: '2021-01-01T00:00:00.000Z' })
    const html = await get('/').then((r) => r.text())
    expect(html.indexOf('Newer')).toBeLessThan(html.indexOf('Older'))
    expect(html).toContain('href="/newer"')
    expect(html).toContain('A tagline')
  })

  it('paginates, and 404s a page past the end', async () => {
    await saveSettings({ postsPerPage: 2 })
    for (const n of [1, 2, 3]) await publish(`Post ${n}`)
    const first = await get('/').then((r) => r.text())
    expect(first).toContain('rel="next"')
    expect(first).not.toContain('rel="prev"')
    expect((await get('/page/2')).status).toBe(200)
    expect((await get('/page/3')).status).toBe(404)
    expect((await get('/page/zero')).status).toBe(404)
  })

  it('serves a category and a tag page, and 404s an unknown term', async () => {
    await publish('Tagged', { categories: ['Ghi chép'], tags: ['bun'] })
    const cat = await get('/category/ghi-chep').then((r) => r.text())
    expect(cat).toContain('Ghi chép')
    expect(cat).toContain('href="/tagged"')
    expect((await get('/tag/bun')).status).toBe(200)
    expect((await get('/category/nothing')).status).toBe(404)
  })

  it('serves a series in reading order, oldest part first', async () => {
    await publish('Part Two', { series: 'Notes', seriesOrder: 1 })
    await publish('Part One', { series: 'Notes', seriesOrder: 0 })
    const html = await get('/series/notes').then((r) => r.text())
    expect(html.indexOf('Part One')).toBeLessThan(html.indexOf('Part Two'))
    expect((await get('/series/nope')).status).toBe(404)
  })

  it('links a post back to its series and its tags', async () => {
    await publish('Part One', { series: 'Notes', seriesOrder: 0, tags: ['bun'] })
    await publish('Part Two', { series: 'Notes', seriesOrder: 1 })
    const html = await get('/part-one').then((r) => r.text())
    expect(html).toContain('href="/part-two"')
    expect(html).toContain('href="/tag/bun"')
  })
})

describe('search', () => {
  it('finds a post by a word in its body, accent-insensitively', async () => {
    await savePost({ title: 'Lập trình hằng ngày', content: 'viết blog mười năm', status: 'published', date: PAST })
    const html = await get('/search?q=lap%20trinh').then((r) => r.text())
    expect(html).toContain('href="/lap-trinh-hang-ngay"')
  })

  it('does not throw on FTS operator characters', async () => {
    await savePost({ title: 'Punctuated', content: 'about C++', status: 'published', date: PAST })
    for (const q of ['C%2B%2B', '%22', 'OR', 'NEAR(']) {
      expect((await get(`/search?q=${q}`)).status).toBe(200)
    }
  })

  it('shows a prompt with no query and stays out of the page cache', async () => {
    expect((await get('/search')).status).toBe(200)
    expect(pageCache.has('/search')).toBe(false)
  })
})

describe('the site chrome', () => {
  it('gives every page the same header, and both triggers work without JavaScript', async () => {
    await saveSettings({ title: 'My Blog', description: 'A tagline' })
    await savePost({ title: 'Chromed', content: 'body', status: 'published', date: PAST })

    for (const path of ['/', '/chromed']) {
      const html = await get(path).then((r) => r.text())
      // A LINK, not a button: without JavaScript it goes to the search page, which renders
      // the same results server-side. The island turns it into an overlay.
      expect(html).toContain('href="/search"')
      expect(html).toContain('data-search-open')
      expect(html).toContain('<footer class="site">')
    }
  })

  it('hides the search trigger when the owner turns search off', async () => {
    const { features } = await getSettings()
    await saveSettings({ features: { ...features, search: false } })
    await savePost({ title: 'Quiet', content: 'body', status: 'published', date: PAST })
    expect(await get('/quiet').then((r) => r.text())).not.toContain('data-search-open')
  })

  it('leaves the subscribe trigger out when there is no mail server', async () => {
    // A trigger with nothing behind it is worse than no trigger.
    await savePost({ title: 'Mailless', content: 'body', status: 'published', date: PAST })
    const html = await get('/mailless').then((r) => r.text())
    expect(html).not.toContain('data-subscribe-open')
    expect(html).not.toContain('form class="subscribe"')
  })

  it('renders the owner footer through the markdown sanitiser, not raw', async () => {
    await saveSettings({ title: 'My Blog', footer: '**Bold** and <script>alert(1)</script>' })
    await savePost({ title: 'Footed', content: 'body', status: 'published', date: PAST })
    const html = await get('/footed').then((r) => r.text())
    expect(html).toContain('<strong>Bold</strong>')
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})

describe('the table of contents', () => {
  const LONG = '## First section\n\nText.\n\n### A sub-heading\n\nText.\n\n## Second section\n\nText.'

  it('is server-rendered, so it works with no JavaScript at all', async () => {
    await savePost({ title: 'Long', content: LONG, status: 'published', date: PAST })
    const html = await get('/long').then((r) => r.text())
    // The list is real markup and its links are real anchors. The bundle only adds the
    // active-section highlight, which is the part that genuinely needs a script.
    expect(html).toContain('<nav class="toc"')
    expect(html).toContain('href="#first-section"')
    expect(html).toContain('href="#a-sub-heading"')
    // Nesting survives: a post that MIXES H2 and H3 marks the children as sub-rows.
    expect(html).toContain('rail-sub')
    // ...and it opens with the post's title, so there is always a way back to the top.
    expect(html).toContain('href="#top"')
    expect(html).toContain('id="first-section"') // and the anchors it points at exist
  })

  // A one-heading post STILL gets an index, because the index is not just the headings: it
  // opens with the post's title and closes with a jump to the tags, categories and
  // comments. Rendering only when there were two or more headings dropped the rail from
  // short posts entirely, and with it the only way back to the top.
  it('still renders for a post with one heading, because the title and end rows earn it', async () => {
    await savePost({ title: 'Short', content: '## Only one\n\nText.', status: 'published', date: PAST })
    const html = await get('/short').then((r) => r.text())
    expect(html).toContain('<nav class="toc"')
    expect(html).toContain('href="#only-one"')
  })

  it('leaves it out when the owner turns it off', async () => {
    const { features } = await getSettings()
    await saveSettings({ features: { ...features, toc: false } })
    await savePost({ title: 'Notoc', content: LONG, status: 'published', date: PAST })
    expect(await get('/notoc').then((r) => r.text())).not.toContain('<nav class="toc"')
  })

  it('is a rail, with the breakpoint computed from the reading column', async () => {
    // A media query cannot read a CSS variable, so the width at which the contents list
    // moves into the left gutter is COMPUTED from the owner's column width: 250 + 40 + 10
    // of rail on each side. Change the column and the breakpoint follows, which is the
    // whole reason this CSS is generated rather than written by hand.
    await saveSettings({ contentWidth: 700 })
    await savePost({ title: 'Railed', content: LONG, status: 'published', date: PAST })
    expect(await get('/railed').then((r) => r.text())).toContain('@media (min-width:1300px)')

    clearCache()
    await saveSettings({ contentWidth: 800 })
    expect(await get('/railed').then((r) => r.text())).toContain('@media (min-width:1400px)')
  })

  it('leaves it off a static page, which has no post structure', async () => {
    await savePage({ title: 'About', content: LONG, status: 'published' })
    expect(await get('/about').then((r) => r.text())).not.toContain('<nav class="toc"')
  })
})

// CSS cannot colour half a text node, and it cannot bracket a run of links that has no
// element around it. Three wrappers exist for the IDE chrome alone, and every one of them
// is invisible with the switch off — which is exactly how a wrapper gets "tidied away" and
// takes a feature with it.
describe('the markup hooks the IDE chrome needs', () => {
  it('wraps the figures in a meta line and leaves the units bare', async () => {
    // "1,240 tu - 6 phut doc": the digits are literals and the units are words, so the
    // digits need their own element to be coloured apart from them.
    await savePost({ title: 'Numbers', content: 'body text here', status: 'published', date: PAST })
    expect(await get('/numbers').then((r) => r.text())).toMatch(/<span class="num">\d/)
  })

  it('wraps the run of tags and of categories, so each can be bracketed as an array', async () => {
    await savePost({
      title: 'Termed', content: 'body text here', status: 'published', date: PAST,
      tags: ['one'], categories: ['Two'],
    })
    // Four, not two: tags and categories, in the article footer AND in the right-gutter
    // panel. Exactly one of those pairs has a box at any width.
    const html = await get('/termed').then((r) => r.text())
    expect(html.match(/<span class="term-list">/g)).toHaveLength(4)
  })

  it('puts the same facts in the right gutter, and hides the in-flow pair at that width', async () => {
    // The panel and the originals are the SAME information twice, and exactly one copy has a
    // box at any width — so the rule that hides the other has to travel with it. Both are
    // asserted here because a panel with nothing hidden is the date printed twice, and a
    // hide with no panel is the date gone.
    await savePost({
      title: 'Gutter', content: 'body text here', status: 'published', date: PAST,
      tags: ['one'], categories: ['Two'],
    })
    const html = await get('/gutter').then((r) => r.text())
    expect(html).toContain('<aside class="post-info')
    expect(html).toContain('class="t-small text-meta post-meta"')
    expect(html).toContain('.post-meta,.taxo-rule,.post-taxo{display:none}')
    // Both copies carry the wrappers the IDE chrome needs, or the panel would be the one
    // surface on the site where a date is not a literal.
    expect(html.match(/<span class="term-list">/g)).toHaveLength(4)
    expect(html.match(/<span class="num">/g)!.length).toBeGreaterThanOrEqual(4)
  })

  it('puts the panel\'s one action LAST, after the facts', async () => {
    // Everything above it states something about the post; book mode is the only row that
    // does something. It sat between the reading time and the tags and the owner moved it
    // to the foot, so the order is asserted rather than left to whoever edits next.
    await savePost({
      title: 'Ordered', content: 'body text here', status: 'published', date: PAST,
      tags: ['one'], categories: ['Two'],
    })
    const panel = /<aside class="post-info[^>]*>([\s\S]*?)<\/aside>/.exec(
      await get('/ordered').then((r) => r.text()),
    )?.[1] ?? ''
    expect(panel).toContain('info-action')
    expect(panel.indexOf('info-action')).toBeGreaterThan(panel.lastIndexOf('info-terms'))
  })

  it('anchors the end of the article on its own elements, not on the hidden taxonomy', async () => {
    // The contents list's last row jumps here. The paragraphs it used to point at are
    // display:none in the wide layout, and an anchor with no box cannot be scrolled to — so
    // that row died silently on every desktop until these existed.
    await savePost({
      title: 'Anchored', content: 'body text here', status: 'published', date: PAST,
      tags: ['one'],
    })
    const html = await get('/anchored').then((r) => r.text())
    expect(html).toContain('<span class="anchor" id="post-tags"></span>')
    expect(html).toContain('<span class="anchor" id="post-categories"></span>')
  })

  it('stops a wide image noshing into the gutter while it is level with the panel', async () => {
    // Measured: a post opening on a #wide image printed the panel's tag rows across the
    // picture. The gutter cannot hold both, and text over a photograph is the worse failure.
    await savePost({ title: 'Wide', content: 'body text here', status: 'published', date: PAST })
    expect(await get('/wide').then((r) => r.text()))
      .toContain(':is(figure.img-wide,.video-wide):nth-child(-n+2){width:100%;margin-right:0}')
  })

  it('leaves the panel off a static page, which has no date and no taxonomy', async () => {
    await savePage({ title: 'Colophon', content: 'body text here', status: 'published' })
    expect(await get('/colophon').then((r) => r.text())).not.toContain('<aside class="post-info')
  })

  it('leaves a sidebar count unparenthesised, because the sheet supplies the brackets', async () => {
    // Typed here, the parentheses could not be swapped for square ones, and the taxonomy
    // read "(7)" three lines under a list that read "[7]".
    await savePost({
      title: 'Counted', content: 'body text here', status: 'published', date: PAST,
      categories: ['Two'],
    })
    const html = await get('/').then((r) => r.text())
    expect(html).toContain('<span class="term-count">1</span>')
  })
})
