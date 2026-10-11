// The order a public page's CSS wins in (ADR 0072, decision 3): the base sheet, then the theme,
// then the owner's settings, then the owner's custom CSS, whatever the selectors weigh. Held by
// cascade layers (`web/css-layers.ts`), so what is pinned here is WHERE each piece lands: which
// layer encloses it, or none. That a browser then resolves the cascade that way is the tour's
// half ("custom CSS wins over the theme whatever its specificity", `scripts/tour-flows-looks.ts`).
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { BUILTIN_THEMES } from '@/content/themes-builtin'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { assetBody, PEN_MARKS_SHEET, PEN_LINES_SHEET, PUBLIC_SHEET, themeSheet } from '@/web/assets'
import { pageStyles } from '@/web/layout-styles'
import { BASE_HOLDS_CSS } from '@/web/css-layers'
import { SERVED_CSS } from '@/web/served-css'
import { singleRailCss } from '@/render/rail-css'

const DIR = './.tmp/test-css-layers'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<string> => (await app.request(path)).text()
const OWNER_CSS = '.post-meta{letter-spacing:.3em}'

/**
 * The `@layer` blocks open at `at`, outermost first. Strings and comments are skipped, so a brace
 * inside either does not count; nothing else in these sheets nests.
 */
function layersAt(css: string, at: number): string[] {
  const open: string[] = []
  let i = 0
  while (i < at) {
    const ch = css[i]!
    if (ch === '"' || ch === "'") {
      i = css.indexOf(ch, i + 1) + 1
      continue
    }
    if (css.startsWith('/*', i)) {
      i = css.indexOf('*/', i + 2) + 2
      continue
    }
    if (ch === '{') {
      const head = css.slice(css.lastIndexOf('}', i) + 1, i)
      const named = /@layer\s+([\w-]+)\s*$/.exec(head.slice(Math.max(head.lastIndexOf(';'), head.lastIndexOf('{')) + 1))
      open.push(named ? named[1]! : '')
    }
    if (ch === '}') open.pop()
    i++
  }
  return open.filter(Boolean)
}

/** Where `needle` lands in `css`: the layers around it, or a note that it is not there at all. */
const landsIn = (css: string, needle: string): string[] | 'absent' => {
  const at = css.indexOf(needle)
  return at < 0 ? 'absent' : layersAt(css, at)
}

beforeEach(async () => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'settings']) db().run(`delete from ${t}`)
  await savePost({ title: 'A post', slug: 'a-post', status: 'published', date: '2025-06-01T12:00:00.000Z',
    content: 'A paragraph.\n' })
})

describe('the linked sheets', () => {
  it('the public sheet: the order first, the rules in base, the holds in theme, the !importants in none', () => {
    const css = assetBody(PUBLIC_SHEET)!
    expect(css).toBe(`@layer base,theme;@layer base{${SERVED_CSS.site}}@layer theme{${BASE_HOLDS_CSS}}`
      + SERVED_CSS['site-important'])
    expect(landsIn(css, '.prose')).toEqual(['base'])
    expect(landsIn(css, '#comments h2{font-size:revert-layer')).toEqual(['theme'])
    // Outside every layer, where an !important weighs what it did before the layers: against
    // the owner's !important by specificity and order, and over every normal declaration.
    expect(landsIn(css, '.prose pre.shiki{background:var(--c-code-panel)!important}')).toEqual([])
    expect(landsIn(css, '[hidden]{display:none!important}')).toEqual([])
    const holds = css.indexOf('@layer theme{')
    expect(css.slice(0, holds).includes('!important')).toBe(false)
  })

  it('every built-in theme sheet sits whole in the theme layer, a stale hash included', () => {
    const sheets = BUILTIN_THEMES.filter((t) => t.sheet)
    expect(sheets.length).toBe(3)
    for (const theme of sheets) {
      const css = assetBody(themeSheet(theme))!
      expect(css.startsWith('@layer theme{')).toBe(true)
      expect(layersAt(css, css.length - 1)).toEqual(['theme'])
      expect(assetBody(`/assets/${theme.sheet}.0000000000.css`)).toBe(css)
    }
    expect(assetBody('/assets/site.0000000000.css')).toBe(assetBody(PUBLIC_SHEET))
  })

  it('the pen sheets stay unlayered, where the reader pen links them in front of the settings', () => {
    // They compete with the owner's settings and custom CSS exactly as before: by weight, then
    // by order (`assets/js/reader-pen.ts` inserts them before the first <style>).
    for (const sheet of [PEN_MARKS_SHEET, PEN_LINES_SHEET]) expect(assetBody(sheet)!.startsWith('@layer')).toBe(false)
  })
})

describe('the inline settings block', () => {
  it('custom CSS is last and in no layer; settings in none; theme rules in theme; the geometry in base', async () => {
    await saveSettings({ theme: 'code', contentWidth: 720, customCss: OWNER_CSS })
    const css = pageStyles(await getSettings(), '.page-extra-geometry{display:none}')
    expect(css.trimEnd().endsWith(OWNER_CSS)).toBe(true)
    expect(landsIn(css, OWNER_CSS)).toEqual([])
    // The owner's settings: the type scale, the palette.
    expect(landsIn(css, '--fs-h1:')).toEqual([])
    expect(landsIn(css, '--c-bg:')).toEqual([])
    // The code theme's rail rules, computed from the column.
    expect(landsIn(css, 'html[data-look=code] .rail-aside')).toEqual(['theme'])
    // The geometry is the base sheet's kind: the column, a moved column's rail, the page's own.
    expect(landsIn(css, '.page-extra-geometry')).toEqual(['base'])
    expect(landsIn(css, ':root{--shell-w:720px}')).toEqual(['base'])
    // ...and the rail rule that keeps its weight against a theme, at this column's breakpoint.
    expect(landsIn(css, '{display:revert-layer}')).toEqual(['theme'])
    expect(landsIn(css, singleRailCss(720).slice(0, 60))).toEqual(['base'])
  })

  it('on a page: the notebook ink is in theme, the custom CSS last and unlayered', async () => {
    await saveSettings({ theme: 'notes', customCss: OWNER_CSS })
    clearCache()
    const page = await get('/a-post')
    const ink = /<style data-meta-ink>([\s\S]*?)<\/style>/.exec(page)?.[1] ?? ''
    expect(landsIn(ink, '--meta-deepened:')).toEqual(['theme'])
    const styles = [...page.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]!)
    const last = styles.at(-1) ?? ''
    expect(last.trimEnd().endsWith(OWNER_CSS)).toBe(true)
    expect(landsIn(last, OWNER_CSS)).toEqual([])
  })
})
