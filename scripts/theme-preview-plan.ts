// What `theme:preview` will photograph: its command line, the pages, and the cells of settings a
// theme's manifest asks for. No side effects, so the tests read it directly.
import type { ThemeManifest } from '@/theme'
import { MATRIX_PAGES, type Page } from './theme-matrix-instance'

export const USAGE = 'usage: bun run theme:preview <theme directory | theme.zip> [--out <dir under .tmp/>] '
  + '[--widths 375,768,1440] [--pages <id,id,...>] [--port <n>] [--force]'

export const DEFAULT_WIDTHS = [375, 768, 1440] as const
export const SCHEMES = ['light', 'dark'] as const
const MIN_WIDTH = 280
const MAX_WIDTH = 3840

/**
 * Every page type a reader can reach: the matrix's, plus what it does not photograph. The second
 * page of the list, a series, a single note, and a post with no title (added by
 * `theme-preview-setup.ts install`, which owns that address).
 */
const EXTRA_PAGES: Page[] = [
  { id: 'home-page-2', path: '/page/2', home: 'list' },
  { id: 'post-untitled', path: '/a-short-post-with-no-title', home: 'list' },
  { id: 'series', path: '/series/ink-and-press', home: 'list' },
  { id: 'note', path: '/notes/where-the-name-comes-from', home: 'list' },
]

/** In the order the contact sheet shows them: the way in first, then a post, then the lists, then the odd ones. */
const ORDER = [
  'home-list', 'home-page-2', 'front-image', 'front-text',
  'post-all-blocks', 'post-series-table-footnote', 'post-untitled', 'post-book', 'page',
  'category', 'tag', 'series', 'archive', 'search', 'notes', 'note', 'not-found',
]

export const PREVIEW_PAGES: Page[] = ORDER.map((id) => {
  const page = [...MATRIX_PAGES, ...EXTRA_PAGES].find((p) => p.id === id)
  if (!page) throw new Error(`theme-preview-plan: no page ${id}`)
  return page
})

export type PreviewArgs = {
  theme: string
  out: string | null
  widths: number[]
  pages: Page[]
  port: number | null
  force: boolean
}

export type Parsed = { ok: true; args: PreviewArgs } | { ok: false; message: string }

const VALUED = new Set(['--out', '--widths', '--pages', '--port'])

/** The command line, or the first thing wrong with it in words. Nothing is read from disk. */
export function parseArgs(argv: readonly string[]): Parsed {
  const fail = (message: string): Parsed => ({ ok: false, message })
  const values = new Map<string, string>()
  const positional: string[] = []
  let force = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--force') force = true
    else if (VALUED.has(a)) {
      const v = argv[i + 1]
      if (v === undefined || v.startsWith('--')) return fail(`${a} needs a value`)
      if (values.has(a)) return fail(`${a} is given twice`)
      values.set(a, v)
      i++
    } else if (a.startsWith('--')) return fail(`unknown option ${a}`)
    else positional.push(a)
  }
  if (positional.length === 0) return fail('no theme given')
  if (positional.length > 1) return fail(`one theme at a time, got ${positional.length}: ${positional.join(' ')}`)

  let widths: number[] = [...DEFAULT_WIDTHS]
  const w = values.get('--widths')
  if (w !== undefined) {
    widths = []
    for (const part of w.split(',')) {
      const n = Number(part.trim())
      if (!Number.isInteger(n) || n < MIN_WIDTH || n > MAX_WIDTH) return fail(`--widths: "${part}" is not a width from ${MIN_WIDTH} to ${MAX_WIDTH}`)
      if (!widths.includes(n)) widths.push(n)
    }
  }

  let pages = PREVIEW_PAGES
  const p = values.get('--pages')
  if (p !== undefined) {
    const ids = [...new Set(p.split(',').map((s) => s.trim()))]
    const unknown = ids.filter((id) => !PREVIEW_PAGES.some((page) => page.id === id))
    if (unknown.length) return fail(`--pages: no page ${unknown.join(', ')}. The pages are: ${PREVIEW_PAGES.map((x) => x.id).join(', ')}`)
    pages = PREVIEW_PAGES.filter((page) => ids.includes(page.id))
  }

  let port: number | null = null
  const portArg = values.get('--port')
  if (portArg !== undefined) {
    port = Number(portArg)
    if (!Number.isInteger(port) || port < 1024 || port > 65535) return fail(`--port: "${portArg}" is not a port from 1024 to 65535`)
  }

  return { ok: true, args: { theme: positional[0]!, out: values.get('--out') ?? null, widths, pages, port, force } }
}

/** One server's worth of settings: which home, which palette. Fonts are the same in every cell. */
export type Cell = { home: Page['home']; palette: string | null }

/** The palettes the theme declares, or the site's default (null) when it declares none. */
export const palettesOf = (m: ThemeManifest): (string | null)[] =>
  m.palettes && m.palettes.length > 0 ? m.palettes.map((p) => p.id) : [null]

/**
 * The reading and chrome faces to draw the theme in: what it suggests, else the first it declares
 * of that role, else the site's own. A theme's reading or chrome font is only drawn when it is the
 * chosen one, so a preview without this would never show the author's fonts.
 */
export function fontsOf(m: ThemeManifest): { reading: string | null; chrome: string | null } {
  const first = (role: 'reading' | 'chrome') => m.fonts?.find((f) => f.role === role)?.id ?? null
  return { reading: m.suggests?.readingFont ?? first('reading'), chrome: m.suggests?.chromeFont ?? first('chrome') }
}

export function cellsFor(m: ThemeManifest, pages: readonly Page[]): Cell[] {
  const homes = (['list', 'front-image', 'front-text'] as const).filter((h) => pages.some((p) => p.home === h))
  return palettesOf(m).flatMap((palette) => homes.map((home) => ({ home, palette })))
}

/** `<page>__<palette>__<width>__<scheme>.png`; `default` when the theme brings no palette. */
export const shotName = (page: string, palette: string | null, width: number, scheme: string): string =>
  `${page}__${palette ?? 'default'}__${width}__${scheme}.png`
