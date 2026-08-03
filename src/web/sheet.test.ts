// The public stylesheet: one hashed, immutable request, and the settings layer inline.
//
// Split out of `app.test.ts` at the 400-line limit. The seam holds because these two
// assertions are about a CACHING contract rather than about any page: one URL for the
// whole site, and a body that may be held for a year because its name changes when it does.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-sheet'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)
const PAST = '2020-01-01T00:00:00.000Z'

const sheetHref = (html: string): string =>
  /<link rel="stylesheet" href="([^"]+)">/.exec(html)?.[1] ?? ''

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings', 'media', 'redirects']) {
    db().run(`delete from ${t}`)
  }
})

describe('the public stylesheet', () => {
  it('links the static sheet and inlines only what the settings decide', async () => {
    await savePost({ title: 'Styled', content: 'body', status: 'published', date: PAST })
    await savePost({ title: 'Styled Two', content: 'body', status: 'published', date: PAST })
    const html = await get('/styled').then((r) => r.text())
    // The static half: one request, hashed, and therefore cacheable for a year. The whole
    // sheet used to be inlined into every page, which re-sent 13.8 KB gzipped on every
    // navigation for information that had not changed.
    expect(html).toMatch(/<link rel="stylesheet" href="\/assets\/site\.[a-z0-9]+\.css">/)
    // The settings half stays inline, AFTER the link, because it is allowed to win.
    expect(html.indexOf('rel="stylesheet"')).toBeLessThan(html.indexOf('<style>'))
    expect(html).toContain('--c-bg:') // theme tokens really reached the page
    expect(html).toContain('--fs-body:') // and so did the typography settings

    // One URL for the whole site: two pages must not each mint their own, or the caching
    // this exists for never happens.
    const other = await get('/styled-two').then((r) => r.text())
    expect(sheetHref(other)).toBe(sheetHref(html))
  })

  it('serves the sheet as immutable CSS', async () => {
    await savePost({ title: 'Styled', content: 'body', status: 'published', date: PAST })
    const href = sheetHref(await get('/styled').then((r) => r.text()))
    const res = await get(href)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/css')
    // `immutable` is only honest because the URL carries the content hash: change the
    // sheet and the path changes with it, so no reader is ever held on a stale one.
    expect(res.headers.get('cache-control')).toContain('immutable')
    expect(await res.text()).toContain('.prose')
  })

  it('answers a hash from the PREVIOUS deploy with the current sheet, not a 404', async () => {
    // HTML is held by a shared cache for up to eleven minutes (s-maxage + swr), so after a
    // deploy that changes the sheet, real readers are handed the old page — whose only
    // stylesheet URL this process no longer has. A 404 there is an unstyled site.
    const res = await get('/assets/site.0000000000.css')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/css')
    expect(await res.text()).toContain('.prose')
  })

  it('still refuses a bundle it does not have, because stale JS is a real mismatch', async () => {
    // The opposite call from the sheet: a bundle from another deploy can call into markup
    // that moved. Doing nothing beats doing the wrong thing.
    expect((await get('/assets/core.0000000000.js')).status).toBe(404)
  })
})

describe('font preloads', () => {
  it('preloads the CHROME face as well, when it is a family of its own', async () => {
    // The rule used to be "never — chrome is not the LCP", written when the chrome font was
    // Inter and the fallback was a system sans. It is a monospace on any site that picks
    // one, and the header, the meta line and both rails all re-flow when it lands.
    //
    // MEASURED at the origin, cold, 4x CPU throttle, median of five runs:
    //   no chrome preload      LCP 472ms, CLS 0.0004 on four runs of five
    //   chrome preloaded       LCP 472ms, CLS 0 on all five
    // Free in LCP, and it removes the shift.
    await saveSettings({ fontPreset: 'literata', chromeFont: 'jetbrains-mono', language: 'vi' })
    await savePost({ title: 'Fonts', content: 'body', status: 'published', date: PAST })
    const page = await get('/fonts').then((r) => r.text())
    expect(page).toContain('/fonts/literata-latin.woff2')
    expect(page).toContain('/fonts/jetbrainsmono-latin.woff2')
    expect(page).toContain('/fonts/jetbrainsmono-vietnamese.woff2')
  })

  it('preloads no SECOND face when the chrome font follows the reading font', async () => {
    // "reading" is not a family, it is `--font-reading` again — already preloaded. Fetching
    // a second file for it would be 44 KB the page never paints a glyph in, which is what
    // the measurement above cost when the fallback-to-Inter default did exactly that.
    clearCache()
    await saveSettings({ fontPreset: 'literata', chromeFont: 'reading', language: 'vi' })
    await savePost({ title: 'Nochrome', content: 'body', status: 'published', date: PAST })
    const page = await get('/nochrome').then((r) => r.text())
    const preloads = [...page.matchAll(/rel="preload" href="([^"]+)"/g)].map((m) => m[1])
    expect(preloads).toEqual(['/fonts/literata-latin.woff2', '/fonts/literata-vietnamese.woff2'])
  })
})
