// A theme whose manifest puts the menu in the header (`layout.menu: "header"`) and writes no CSS
// for the rail: the engine itself keeps the rail's copy of the menu off the screen where the
// header shows it, drops a rail left with nothing else, and keeps the copy for the phone drawer.
// Until 2026-10-19 each such theme had to hide the copy with a `:has()` chain on markup the
// contract did not name; Newspaper did, and so did the first theme written from outside.
import { describe, expect, it } from 'bun:test'
import { getSettings, saveSettings } from '@/content/settings'
import { savePage } from '@/content/pages'
import { savePost } from '@/content/posts'
import { clearCache } from '@/server/cache'
import { SERVED_CSS } from '@/web/served-css'
import { listingRailCss } from '@/render/rail-css'
import { themeZip, MANIFEST } from '@/theme/test-zip'
import { inlineStyle, themeBlog } from '@/test/installed-theme'

const { install, save, page } = themeBlog('./.tmp/test-theme-menu-header')

/** No rule touches the rail: whatever happens to it is the engine's doing. */
const headerMenuTheme = () => install(themeZip({ 'theme.json': { ...MANIFEST, layout: { menu: 'header' } } }))

/** Every `<aside class="rail…">`, as its class list and its inner markup. */
const rails = (html: string): { cls: string; inner: string }[] =>
  [...html.matchAll(/<aside class="(rail[^"]*)">([\s\S]*?)<\/aside>/g)].map((m) => ({ cls: m[1]!, inner: m[2]! }))
/** The header's own menu, when it draws one. */
const headerMenu = (html: string): boolean => /<header class="site[^"]*"[\s\S]*?<nav class="site-menu[\s\S]*?Colophon[\s\S]*?<\/header>/.test(html)
/** The rail's menu nav, with its class attribute if it has one. */
const railMenu = (inner: string): string | null => /<nav( class="[^"]*")? aria-label="[^"]*"><ul>[\s\S]*?Colophon/.exec(inner)?.[0] ?? null
/** The header's drawer button, with its class list. */
const toggle = (html: string): string => /<button type="button" class="(icon-btn rail-toggle[^"]*)"/.exec(html)?.[1] ?? ''

const withFeatures = async (patch: Record<string, boolean>, more: Record<string, unknown> = {}) => {
  const current = await getSettings()
  await saveSettings({ ...more, features: { ...current.features, ...patch } })
  clearCache()
}
/** Every block of the two-rail listing's rails switched off but the ones a case turns on. */
const BARE_RAIL = { sidebar: true, sidebarCategories: false, sidebarTags: false, sidebarArchive: false, sidebarSeries: false, infiniteScroll: false }

describe('a theme with the menu in the header', () => {
  it('draws the menu in the header and marks the rail copy on a post with contents', async () => {
    await savePost({ title: 'Sections', slug: 'sections', status: 'published', date: '2025-06-02T12:00:00.000Z',
      content: '## One\n\nWords.\n\n## Two\n\nMore words.\n' })
    await headerMenuTheme()
    await save({ theme: 'broadsheet' })
    const { html } = await page('/sections')
    expect(headerMenu(html)).toBe(true)
    const [rail, ...more] = rails(html)
    expect(more).toEqual([])
    // The copy stays in the rail, which is the phone drawer below 60rem...
    expect(railMenu(rail!.inner)).toStartWith('<nav class="rail-menu-copy"')
    // ...and the rail keeps its contents, so it is not a menu-only rail.
    expect(rail!.inner).toContain('<nav class="toc"')
    expect(rail!.cls).not.toContain('rail-menu-only')
    expect(toggle(html)).toBe('icon-btn rail-toggle')
  })

  it('marks a rail with nothing but the menu on a page, so it is not drawn from 60rem up', async () => {
    await savePage({ title: 'Colophon', slug: 'colophon', status: 'published', content: 'About this blog.' })
    await headerMenuTheme()
    await save({ theme: 'broadsheet' })
    const { status, html } = await page('/colophon')
    expect(status).toBe(200)
    expect(headerMenu(html)).toBe(true)
    const [rail] = rails(html)
    expect(rail!.cls).toBe('rail rail-toc rail-menu-only')
    expect(railMenu(rail!.inner)).toStartWith('<nav class="rail-menu-copy"')
    // The button that opens it goes with it from 60rem up.
    expect(toggle(html)).toBe('icon-btn rail-toggle rail-menu-only')
  })

  it('marks a listing rail that holds only the menu and puts its drawer button away from 60rem up', async () => {
    await headerMenuTheme()
    await save({ theme: 'broadsheet' })
    await withFeatures({ sidebar: false })
    const { html } = await page('/')
    expect(headerMenu(html)).toBe(true)
    const [rail, ...more] = rails(html)
    expect(more).toEqual([])
    expect(rail!.cls).toBe('rail rail-menu-only')
    expect(railMenu(rail!.inner)).toStartWith('<nav class="rail-menu-copy"')
    expect(toggle(html)).toBe('icon-btn rail-toggle rail-menu-only')
  })

  it('keeps a listing rail that has subjects of its own, with the copy marked', async () => {
    await savePost({ title: 'Filed', slug: 'filed', status: 'published', date: '2025-06-03T12:00:00.000Z',
      content: 'Words.', categories: ['Essays'] })
    await headerMenuTheme()
    await save({ theme: 'broadsheet' })
    await withFeatures({ sidebar: true, sidebarCategories: true })
    const { html } = await page('/')
    const main = rails(html).find((r) => r.inner.includes('Colophon'))!
    expect(main.cls).not.toContain('rail-menu-only')
    expect(railMenu(main.inner)).toStartWith('<nav class="rail-menu-copy"')
    expect(main.inner).toContain('Essays')
    expect(toggle(html)).toBe('icon-btn rail-toggle')
  })

  it('draws a two-rail listing with nothing but the menu as one menu-only rail, in the narrower column', async () => {
    await headerMenuTheme()
    await save({ theme: 'broadsheet' })
    await withFeatures(BARE_RAIL, { sidebarLayout: 'two', featured: [], mostViewedCount: 0 })
    const { html } = await page('/')
    const all = rails(html)
    // No empty left rail beside it, and the layout's own geometry still narrows the column.
    expect(all.map((r) => r.cls)).toEqual(['rail rail-menu-only'])
    expect(toggle(html)).toBe('icon-btn rail-toggle rail-menu-only')
    expect(inlineStyle(html)).toContain(`--shell-w:${Math.round(672 * 0.8)}px`)
  })

  it('keeps a two-rail right rail that has only drawer copies as the drawer, not drawn in the gutter', async () => {
    await headerMenuTheme()
    await save({ theme: 'broadsheet' })
    await withFeatures(BARE_RAIL, { sidebarLayout: 'two', featured: ['a-post'], mostViewedCount: 0 })
    const { html } = await page('/')
    const all = rails(html)
    expect(all.map((r) => r.cls)).toEqual(['rail rail-left', 'rail rail-right rail-drawer'])
    // The left rail carries the featured block; the right one holds the menu copy and the
    // drawer's copy of that block, so below the breakpoint the drawer still has both.
    expect(all[0]!.inner).toContain('A post')
    expect(railMenu(all[1]!.inner)).toStartWith('<nav class="rail-menu-copy"')
    expect(all[1]!.inner).toContain('<div class="drawer-only">')
    expect(toggle(html)).toBe('icon-btn rail-toggle')
    expect(inlineStyle(html)).toContain('.rail.rail-right.rail-drawer{display:none}')
  })
})

describe('a theme with the menu in the rail', () => {
  it('leaves the rail menu unmarked: it is the only menu on the page at every width', async () => {
    await savePage({ title: 'Colophon', slug: 'colophon', status: 'published', content: 'About this blog.' })
    await install(themeZip())
    await save({ theme: 'broadsheet' })
    for (const path of ['/colophon', '/a-post']) {
      const { html } = await page(path)
      expect(headerMenu(html)).toBe(false)
      for (const rail of rails(html)) {
        expect(rail.cls).not.toContain('rail-menu-only')
        const nav = railMenu(rail.inner)
        if (nav) expect(nav).not.toContain('rail-menu-copy')
      }
      expect(html).not.toContain('rail-menu-copy')
      expect(toggle(html)).toBe('icon-btn rail-toggle')
    }
    // A two-rail right rail keeps its menu in the gutter, so it is never only the drawer.
    await withFeatures(BARE_RAIL, { sidebarLayout: 'two', featured: ['a-post'], mostViewedCount: 0 })
    expect(rails((await page('/')).html).map((r) => r.cls)).toEqual(['rail rail-left', 'rail rail-right'])
  })
})

describe('the base sheet', () => {
  const css = SERVED_CSS.site
  const block = '@media (min-width:60rem){.rail-menu-copy,.rail.rail-menu-only,.rail-toggle.rail-menu-only{display:none}'
    + '.rail .rail-inner > :nth-child(1 of :not(.rail-menu-copy)){margin-top:0}}'

  it('hides the copy, a menu-only rail and its button from 60rem up, and nowhere below', () => {
    expect(css).toContain(block)
    // Every rule naming them is in that block, so the phone drawer keeps the menu.
    const outside = css.replace(block, '')
    expect(outside).not.toContain('rail-menu-copy')
    expect(outside).not.toContain('rail-menu-only')
  })

  it('takes the space after a hidden copy away, heavier than the band spreads its blocks', () => {
    // The band spreads blocks with `.rail-toc .rail-inner > * + *` (0,2,0); this is (0,4,0), so
    // the first block drawn sits at the top of the rail, level with the facts panel.
    expect(css).toContain('.rail .rail-inner > :nth-child(1 of :not(.rail-menu-copy)){margin-top:0}')
    // Above the breakpoint a listing's drawer-only copies are not drawn either.
    expect(listingRailCss(672)).toContain('.rail .rail-inner > :nth-child(1 of :not(.rail-menu-copy,.drawer-only)){margin-top:0}')
  })
})
