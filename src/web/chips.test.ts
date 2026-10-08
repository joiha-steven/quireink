// The tablet chip row: categories and series under the header, in the width band where the
// sidebar is a closed drawer. Driven through real requests, like the sidebar's own tests.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { listPageSize } from '@/content/paginate'
import { breakpoint } from '@/render/rail-css'
import { CHIPS_CSS, chipsBandCss } from '@/web/chips.css'
import { LOOK_CODE_CSS } from '@/web/look-code.css'
import { LOOK_NOTES_CSS } from '@/web/look-notes.css'
import { LOOK_PAPER_CSS } from '@/web/look-paper.css'
import { PUBLIC_CSS } from '@/web/public.css'
import { DEFAULT_RAIL_WIDTH } from '@/render/rail-css'

const DIR = './.tmp/test-chips'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)
const PAST = '2020-01-01T00:00:00.000Z'

const chipsOf = (html: string): string => /<nav class="chips[^"]*"[^>]*>.*?<\/nav>/s.exec(html)?.[0] ?? ''

beforeEach(async () => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings', 'media', 'redirects']) {
    db().run(`delete from ${t}`)
  }
  await savePost({ title: 'Part One', slug: 'one', status: 'published', date: PAST, series: 'Ten Years',
    seriesOrder: 1, categories: ['Essays'], tags: ['history'] })
})

const setFeatures = async (patch: Record<string, boolean>) => {
  const on = await getSettings()
  await saveSettings({ features: { ...on.features, ...patch } })
  clearCache()
}

describe('the chip row', () => {
  it('lists the categories and then the series, as links to what the sidebar links to', async () => {
    const chips = chipsOf(await (await get('/')).text())
    expect(chips).toContain('href="/category/essays"')
    expect(chips).toContain('href="/series/ten-years"')
    expect(chips.indexOf('/category/essays')).toBeLessThan(chips.indexOf('/series/ten-years'))
    // Tags are not in it: a tag cloud has no ceiling.
    expect(chips).not.toContain('/tag/')
  })

  it('stands under the header and ahead of the main column', async () => {
    const html = await (await get('/')).text()
    expect(html.indexOf('</header>')).toBeLessThan(html.indexOf('class="chips'))
    expect(html.indexOf('class="chips')).toBeLessThan(html.indexOf('<main'))
  })

  it('marks the term the page is on, and only that one', async () => {
    const chips = chipsOf(await (await get('/category/essays')).text())
    expect(chips).toContain('href="/category/essays" aria-current="page"')
    expect(chips.match(/aria-current/g)?.length).toBe(1)
    const onSeries = chipsOf(await (await get('/series/ten-years')).text())
    expect(onSeries).toContain('href="/series/ten-years" aria-current="page"')
  })

  it('is absent when the sidebar or both of its term blocks are off, and trims one block', async () => {
    await setFeatures({ sidebarSeries: false })
    let chips = chipsOf(await (await get('/')).text())
    expect(chips).toContain('/category/essays')
    expect(chips).not.toContain('/series/')

    await setFeatures({ sidebarSeries: false, sidebarCategories: false })
    expect(chipsOf(await (await get('/')).text())).toBe('')

    await setFeatures({ sidebarSeries: true, sidebarCategories: true, sidebar: false })
    expect(chipsOf(await (await get('/')).text())).toBe('')
    await setFeatures({ sidebar: true })
    chips = chipsOf(await (await get('/')).text())
    expect(chips).not.toBe('')
  })

  it('is absent when there is nothing to list', async () => {
    db().run('delete from posts')
    db().run('delete from post_terms')
    clearCache()
    expect(chipsOf(await (await get('/')).text())).toBe('')
  })

  it('is not drawn on a results page', async () => {
    expect(chipsOf(await (await get('/search?q=part')).text())).toBe('')
  })

  it('keeps the row on a deep page of an infinite feed, which is noindex', async () => {
    const on = await getSettings()
    await saveSettings({ postsPerPage: 1, features: { ...on.features, infiniteScroll: true } })
    const per = listPageSize(await getSettings())
    for (let i = 0; i < per * 2 + 1; i++) {
      await savePost({ title: `Post ${i}`, slug: `p${i}`, status: 'published', date: PAST, categories: ['Essays'] })
    }
    clearCache()
    const res = await get('/page/2')
    const html = await res.text()
    // The precondition, asserted: this is the page the row used to lose.
    expect(res.status).toBe(200)
    expect(html).toContain('noindex')
    expect(chipsOf(html)).toContain('/category/essays')
  })

  it('is always one row, in reading order: no wrapping form, no per-count mode', async () => {
    for (let i = 0; i < 30; i++) {
      await savePost({ title: `Post ${i}`, slug: `p${i}`, status: 'published', date: PAST,
        categories: [`A rather long category name ${i}`] })
    }
    clearCache()
    expect(chipsOf(await (await get('/')).text())).not.toContain('chips-scroll')
    expect(CHIPS_CSS).not.toContain('flex-wrap')
    expect(CHIPS_CSS).not.toContain('column')
  })
})

describe('the chip row rules', () => {
  const at = breakpoint(DEFAULT_RAIL_WIDTH)

  it('are in the hashed sheet: the row is hidden, shown only between 40rem and the rail breakpoint', () => {
    expect(PUBLIC_CSS).toContain(CHIPS_CSS)
    expect(CHIPS_CSS).toContain('.chips{display:none;')
    expect(CHIPS_CSS).toContain(`@media (min-width:40rem) and (max-width:${at - 1}px){.chips{display:flex}}`)
  })

  it('scroll sideways, with trailing room for the fade and for a focused chip', () => {
    expect(CHIPS_CSS).toContain('overflow-x:auto')
    expect(CHIPS_CSS).toContain('padding-inline-end:2.5rem')
    expect(CHIPS_CSS).toContain('scroll-padding-inline-end:2.5rem')
  })

  it('send nothing inline at the default column, and only the band otherwise', () => {
    expect(chipsBandCss(DEFAULT_RAIL_WIDTH)).toBe('')
    const css = chipsBandCss(800)
    expect(css).toContain(`(max-width:${breakpoint(800) - 1}px){html .chips{display:flex}}`)
    expect(css).not.toContain('overflow')
  })

  it('keep the look rules in the look sheets, with no hardcoded colour', () => {
    expect(CHIPS_CSS).not.toContain('data-look')
    expect(LOOK_CODE_CSS).toContain('data-look=code] .chips .chip')
    expect(LOOK_PAPER_CSS).toContain('data-look=paper] .chips .chip')
    expect(LOOK_NOTES_CSS).toContain('data-look=notes] .chips .chip')
    expect(CHIPS_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b|:\s*white\b|:\s*black\b|neutral-/)
  })

  it('follows the owner\'s column width in the page', async () => {
    const on = await getSettings()
    await saveSettings({ contentWidth: 800 })
    clearCache()
    const html = await (await get('/')).text()
    expect(html).toContain(`max-width:${breakpoint(800) - 1}px){html .chips{display:flex}}`)
    await saveSettings({ contentWidth: on.contentWidth })
  })
})
