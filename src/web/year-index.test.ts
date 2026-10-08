// The listing's right-hand rail: a sticky index of the years (with counts and links), then the
// blocks that surface posts, so both gutters carry something on the single layout; and the
// drawer's search box and surface. Driven through real requests, like the sidebar's own tests.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { breakpoint, listingRailCss } from '@/render/rail-css'
import { PUBLIC_CSS } from '@/web/public.css'

const DIR = './.tmp/test-year-index'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<string> => (await app.request(path)).text()

const railOf = (html: string, cls: string): string =>
  new RegExp(`<aside class="rail ${cls}">.*?</aside>`, 's').exec(html)?.[0] ?? ''

const set = async (patch: Record<string, unknown>, features: Record<string, boolean> = {}) => {
  const on = await getSettings()
  await saveSettings({ ...patch, features: { ...on.features, ...features } })
  clearCache()
}

beforeEach(async () => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings', 'media', 'redirects']) {
    db().run(`delete from ${t}`)
  }
  await savePost({ title: 'Newest', slug: 'newest', status: 'published', date: '2025-06-01T12:00:00.000Z', categories: ['Essays'] })
  await savePost({ title: 'Middle', slug: 'middle', status: 'published', date: '2025-03-01T12:00:00.000Z', categories: ['Essays'] })
  await savePost({ title: 'Oldest', slug: 'oldest', status: 'published', date: '2023-05-01T12:00:00.000Z', categories: ['Essays'] })
  await set({ featured: ['middle'] }, { infiniteScroll: false })
})

describe('the year index, single layout', () => {
  it('stands in the right rail with every year, its count, and an archive link for each', async () => {
    const aside = railOf(await get('/'), 'rail-aside')
    expect(aside).toContain('<h2>Archive</h2>')
    expect(aside).toContain('href="/archive#y2025" data-year="2025"><span>2025</span><span class="rail-count">2</span>')
    expect(aside).toContain('href="/archive#y2023" data-year="2023"><span>2023</span><span class="rail-count">1</span>')
    // The newest year first, then the whole of the archive with its total.
    expect(aside.indexOf('2025')).toBeLessThan(aside.indexOf('2023'))
    expect(aside).toContain('href="/archive"')
    expect(aside).toContain('<span class="rail-count">3</span>')
  })

  it('marks the first post of each year that is on the page, and only that one', async () => {
    const html = await get('/')
    expect(html.match(/<article data-yr="2025"/g)?.length).toBe(1)
    expect(html.match(/<article data-yr="2023"/g)?.length).toBe(1)
    expect(html.indexOf('data-yr="2025"')).toBeLessThan(html.indexOf('Middle'))
  })

  it('moves Featured to the right rail and keeps the left one to the menu and the subjects', async () => {
    const html = await get('/')
    expect(railOf(html, 'rail-aside')).toContain('href="/middle"')
    const main = railOf(html, 'rail-main')
    expect(main).toContain('href="/category/essays"')
    // The drawer is this rail, so it keeps a copy that the gutter geometry hides.
    expect(main).toContain('<div class="drawer-only">')
    expect(main.replace(/<div class="drawer-only">.*?<\/div><\/div>/s, '')).not.toContain('href="/middle"')
  })

  it('leaves the right rail out when nothing is switched on to fill it', async () => {
    await set({ featured: [] }, { sidebarArchive: false })
    const html = await get('/')
    expect(html).not.toContain('rail-aside')
    expect(html).toContain('<aside class="rail">')
  })

  it('drops the years with the sidebar-archive switch, or with the archive page, and keeps the rest', async () => {
    await set({}, { sidebarArchive: false })
    let aside = railOf(await get('/'), 'rail-aside')
    expect(aside).not.toContain('data-year')
    expect(aside).toContain('href="/middle"')
    await set({}, { sidebarArchive: true, archive: false })
    aside = railOf(await get('/'), 'rail-aside')
    expect(aside).not.toContain('data-year')
  })

  it('also stands on a taxonomy page, and with infinite scroll on, where it replaces the timeline in that gutter', async () => {
    expect(railOf(await get('/category/essays'), 'rail-aside')).toContain('data-year="2025"')
    await set({}, { infiniteScroll: true })
    const html = await get('/')
    expect(railOf(html, 'rail-aside')).toContain('data-year="2025"')
    // Above the rail breakpoint the spine, the year tag and the month ticks are not drawn.
    expect(html).toContain('.with-rail .tl-feed::after,.with-rail .tl-feed .tl-year,.with-rail .tl-feed article .tl-mark{display:none}')
  })

  it('breaks at the width the layout rail does and leaves the column at its own width', () => {
    const css = listingRailCss(672, { shell: false, left: 'rail-main', right: 'rail-aside' })
    expect(css).toContain(`@media (min-width:${breakpoint(672)}px)`)
    expect(css).not.toContain('--shell-w')
    expect(css).toContain('.rail.rail-aside{')
    expect(css).toContain('.rail.rail-main{')
  })
})

describe('a left rail with nothing to show in the gutter', () => {
  it('stays the drawer but is not drawn above the breakpoint', async () => {
    await set({ menu: [] }, { sidebarCategories: false, sidebarTags: false, sidebarSeries: false })
    const html = await get('/')
    expect(html).toContain('<aside class="rail rail-main rail-drawer">')
    expect(html).toContain('.rail.rail-main.rail-drawer{display:none}')
    // Still the drawer: the discovery and the years are in it for the phone.
    expect(railOf(html, 'rail-main rail-drawer')).toContain('href="/middle"')
  })

  it('counts the menu as gutter content, except under the newspaper look which hangs it in the masthead', async () => {
    await set({ menu: [{ label: 'About', href: '/about' }] }, { sidebarCategories: false, sidebarTags: false, sidebarSeries: false })
    expect(await get('/')).not.toContain('rail-main rail-drawer"')
    await set({ look: 'paper' })
    expect(await get('/')).toContain('rail-main rail-drawer"')
  })

  it('is an ordinary rail when it has a subject to show', async () => {
    expect(await get('/')).not.toContain('rail-main rail-drawer"')
  })
})

describe('the two-rail layout is as it was', () => {
  it('keeps discovery on the left and the nav right, with no year index', async () => {
    await set({ sidebarLayout: 'two' })
    const html = await get('/')
    expect(html).not.toContain('rail-aside')
    // The island must not rewrite the plain archive links of this layout.
    expect(railOf(html, 'rail-right')).toContain('href="/archive#y2025"')
    expect(html).not.toContain('data-year')
    expect(railOf(html, 'rail-left')).toContain('href="/middle"')
    expect(railOf(html, 'rail-right')).toContain('href="/category/essays"')
    expect(railOf(html, 'rail-right')).not.toContain('<h2>Archive</h2><ul')
  })
})

describe('the drawer', () => {
  it('opens on a search box, a GET form to /search, only with the search feature on', async () => {
    const on = railOf(await get('/'), 'rail-main')
    expect(on).toContain('<div class="rail-search"><form class="qbox" action="/search" method="get" role="search">')
    expect(on).toContain('name="q"')
    // Ahead of the scrolling body of the rail, so it is the drawer's first stop.
    expect(on.indexOf('rail-search')).toBeLessThan(on.indexOf('rail-inner'))
    expect(railOf(await get('/'), 'rail-aside')).not.toContain('class="rail-search"')

    await set({}, { search: false })
    expect(await get('/')).not.toContain('class="rail-search"')
  })

  it('carries the search box on the two-rail layout and on a rail that holds the menu alone', async () => {
    await set({ sidebarLayout: 'two' })
    expect(railOf(await get('/'), 'rail-right')).toContain('class="rail-search"')
    await set({}, { sidebar: false })
    expect(await get('/')).not.toContain('class="rail-search"') // no menu configured: no rail at all
  })

  it('is drawn in the page tokens and no literal colour, so it follows the palette and the scheme', () => {
    const surface = /\.rail\{position:fixed;[^}]+\}/.exec(PUBLIC_CSS)?.[0] ?? ''
    expect(surface).toContain('background:var(--c-bg)')
    expect(surface).toContain('border-right:1px solid var(--c-rule)')
    expect(surface).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|\bblack\b|\bwhite\b/i)
    // The search box and its hairlines are in tokens as well.
    const search = /\.rail-search[^{]*\{[^}]*\}/g.exec(PUBLIC_CSS)?.join('') ?? ''
    expect(search).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i)
  })

  it('is put away above the breakpoint in both layouts, and the right rail below it', () => {
    expect(PUBLIC_CSS).toContain('.rail-aside{display:none}')
    expect(listingRailCss(672)).toContain('.rail-search{display:none}')
    expect(PUBLIC_CSS).toContain('.rail-toggle,.rail-scrim,.rail-search{display:none}')
  })

  it('takes focus on the container, with no outline, so a touch draws no ring', () => {
    expect(PUBLIC_CSS).toContain('.rail:focus{outline:none}')
  })
})
