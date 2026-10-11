// The theme the public site is wearing: one of the four built in, or one installed from a zip
// (ADR 0072, T2b). Server only: the admin's browser half reads the registry
// (`content/themes-builtin.ts`) and never this, because this reads the database.
//
// AN INSTALLED THEME IS PLAIN PLUS ITS MANIFEST. Every registry field is plain's, and the current
// version's `theme.json` adds what a package may: the sheet and fonts under `/themes/<hash>/`, its
// palettes, the two layout switches, the settings it draws itself and what it suggests. Nothing a
// package carries can change the markup, so a theme that is broken in any way is drawn as plain.
//
// ONE SMALL QUERY, THEN NONE. Every page asks `resolveTheme` several times (the header, the rail,
// the sheet, the document), synchronously, from settings it already holds. The current version is
// read once, through the partial index on live versions, and kept here by the theme id it
// answers. It is forgotten on every flush of the page cache (`server/cache.ts`, Invariant 1), and
// installing, rolling back and removing a theme are writes through the owner's gate, which flushes:
// so the next render after any of them reads the row again. The three also forget it themselves
// (`content/installed-themes.ts`), for a caller that reaches them without the gate. On Cloudflare
// the Durable Object is the one place that renders, writes and flushes, so the same holds there;
// an object restarted or restored from a bookmark starts with nothing kept.
//
// A ROW IS READ AS IF IT COULD BE ANYTHING. The installer stored what the checker passed, but a
// backup puts its rows back without checking them again (`docs/theme-install-api.md`), and every
// id, colour and file name below ends up inside CSS the engine writes. So each is held again to
// the shape the checker allows, an id is refused when a built-in already has it
// (`content/theme-reserved.ts`, the installer's own list), and a manifest that does not read is
// drawn as plain.

import {
  builtinTheme, DEFAULT_THEME_ID, isBuiltinThemeId, isThemeId, OWNABLE_SETTINGS,
  type OwnableSetting, type SiteTheme,
} from '@/content/themes-builtin'
import type { ThemeFont, ThemeFontFace, ThemePalette, ThemePaletteColors } from '@/theme'
import { one } from '@/store/query'
import { liveOnly } from '@/store/db'
import { onFlush } from '@/server/cache'
import { currentThemePreview } from '@/server/theme-preview-scope'
import { RESERVED_FONT_IDS, RESERVED_PALETTE_IDS, RESERVED_THEME_IDS } from '@/content/theme-reserved'

export type CurrentRow = { hash: string; manifest: string }

/** The current version of a theme: the newest live row, as the admin's list orders them. */
const currentRow = (themeId: string): CurrentRow | null =>
  one<CurrentRow>(
    `select hash, manifest from themes where ${liveOnly('themes')} and theme_id = ?
     order by installed_at desc, id desc limit 1`,
    themeId,
  )

/** Whether `themeId` has a live version installed: what a settings write may choose. */
export function isLiveInstalledTheme(themeId: unknown): themeId is string {
  if (!isThemeId(themeId) || isBuiltinThemeId(themeId)) return false
  return one<{ n: number }>(`select 1 as n from themes where ${liveOnly('themes')} and theme_id = ? limit 1`, themeId) !== null
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const HASH = /^[0-9a-f]{64}$/
const HEX = /^#[0-9a-f]{6}$/
/** `fonts/<name>.woff2`, a name the package path rules allow (`theme/package-path.ts`). */
const FACE_FILE = /^fonts\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.woff2$/
const COLOUR_KEYS = ['bg', 'text', 'heading', 'meta', 'link', 'rule', 'accent'] as const

/** Thrown inside `readManifest` when one field is not what the checker would have passed. */
class Unreadable extends Error {}
const need = <T>(value: T | undefined | null | false, what: string): T => {
  if (value === undefined || value === null || value === false) throw new Unreadable(what)
  return value
}
const list = (v: unknown, what: string): unknown[] => (v === undefined ? [] : need(Array.isArray(v) && v, what))

function colours(v: unknown, what: string): ThemePaletteColors {
  const o = need(isObj(v) && v, what)
  const out = {} as ThemePaletteColors
  for (const key of COLOUR_KEYS) out[key] = need(typeof o[key] === 'string' && HEX.test(o[key]) && o[key], `${what}.${key}`)
  return out
}

function palette(v: unknown, i: number): ThemePalette {
  const o = need(isObj(v) && v, `palettes[${i}]`)
  return {
    id: need(isThemeId(o.id) && !RESERVED_PALETTE_IDS.has(o.id) && o.id, `palettes[${i}].id`),
    name: need(typeof o.name === 'string' && o.name, `palettes[${i}].name`),
    light: colours(o.light, `palettes[${i}].light`),
    dark: colours(o.dark, `palettes[${i}].dark`),
  }
}

function face(v: unknown, what: string): ThemeFontFace {
  const o = need(isObj(v) && v, what)
  const w = o.weight
  return {
    file: need(typeof o.file === 'string' && FACE_FILE.test(o.file) && o.file, `${what}.file`),
    weight: need(typeof w === 'number' && Number.isInteger(w) && w >= 100 && w <= 900 && w % 100 === 0 && w, `${what}.weight`),
    style: need((o.style === 'normal' || o.style === 'italic') && o.style, `${what}.style`),
  }
}

function font(v: unknown, i: number): ThemeFont {
  const o = need(isObj(v) && v, `fonts[${i}]`)
  return {
    id: need(isThemeId(o.id) && !RESERVED_FONT_IDS.has(o.id) && o.id, `fonts[${i}].id`),
    name: need(typeof o.name === 'string' && o.name, `fonts[${i}].name`),
    role: need((o.role === 'reading' || o.role === 'chrome' || o.role === 'display') && o.role, `fonts[${i}].role`),
    faces: list(o.faces, `fonts[${i}].faces`).map((f, j) => face(f, `fonts[${i}].faces[${j}]`)),
  }
}

const isOwnable = (key: unknown): key is OwnableSetting =>
  (OWNABLE_SETTINGS as readonly unknown[]).includes(key)

type Drawn = Pick<SiteTheme, 'layout' | 'suggests' | 'ownsSettings'> & { fonts: ThemeFont[]; palettes: ThemePalette[] }

/** What the renderer takes from `theme.json`, or an `Unreadable` naming the first bad field. */
function readManifest(json: string, themeId: string, base: SiteTheme): Drawn {
  const raw: unknown = JSON.parse(json)
  const m = need(isObj(raw) && raw, 'manifest')
  // The row's own id, which the installer wrote from this field, and never a built-in one.
  need(m.id === themeId && !RESERVED_THEME_IDS.has(themeId), 'id')
  const layout = m.layout === undefined ? {} : need(isObj(m.layout) && m.layout, 'layout')
  const menu = layout.menu ?? base.layout.menu
  const deepen = layout.deepenMetaInk ?? base.layout.deepenMetaInk
  const suggests = m.suggests === undefined ? {} : need(isObj(m.suggests) && m.suggests, 'suggests')
  const suggested: SiteTheme['suggests'] = {}
  for (const key of ['palette', 'readingFont', 'chromeFont'] as const) {
    const id = suggests[key]
    if (id !== undefined) suggested[key] = need(isThemeId(id) && id, `suggests.${key}`)
  }
  return {
    layout: {
      menu: need((menu === 'rail' || menu === 'header') && menu, 'layout.menu'),
      deepenMetaInk: typeof deepen === 'boolean' ? deepen : need(false, 'layout.deepenMetaInk'),
    },
    suggests: suggested,
    // Only keys the engine can draw without: an unknown one is dropped rather than refused, as a
    // later build's list may be longer than this one's.
    ownsSettings: list(m.ownsSettings, 'ownsSettings').filter(isOwnable),
    fonts: list(m.fonts, 'fonts').map(font),
    palettes: list(m.palettes, 'palettes').map(palette),
  }
}

/**
 * The installed theme `themeId` drawn from one of its rows, or why it cannot be. Reads nothing and
 * says nothing: the renderer warns (`load`), and the admin's list reads every theme's current row
 * through here so that what it offers is exactly what a page would draw
 * (`content/installed-themes.ts`).
 */
export function themeFromRow(themeId: string, row: CurrentRow): { theme: SiteTheme } | { why: string } {
  const base = builtinTheme(DEFAULT_THEME_ID)
  try {
    if (!HASH.test(row.hash)) throw new Unreadable('hash')
    const { fonts, palettes, ...drawn } = readManifest(row.manifest, themeId, base)
    return { theme: { ...base, ...drawn, id: themeId, package: { hash: row.hash, fonts, palettes } } }
  } catch (error) {
    return { why: error instanceof Unreadable ? `the field ${error.message} does not read` : (error as Error).message }
  }
}

/** The installed theme `themeId` as the page draws it, or null (and one warning) when it cannot be. */
function load(themeId: string): SiteTheme | null {
  let row: CurrentRow | null
  try {
    row = currentRow(themeId)
  } catch (error) {
    console.warn(`[WARN] theme ${themeId}: the current version could not be read (${(error as Error).message}); the site is drawn as the default theme`)
    return null
  }
  if (!row) {
    console.warn(`[WARN] theme ${themeId}: no live version is installed; the site is drawn as the default theme`)
    return null
  }
  const read = themeFromRow(themeId, row)
  if ('theme' in read) return read.theme
  console.warn(`[WARN] theme ${themeId}: the current version's manifest is unreadable (${read.why}); the site is drawn as the default theme`)
  return null
}

/**
 * The answers so far, by id. `null` is kept too: a broken theme warns once until the next flush.
 *
 * BY ID, NOT ONE ENTRY. While the owner previews one installed theme and readers are drawn in
 * another (`server/theme-preview-scope.ts`), a single kept answer flipped on every interleaved
 * request: a query and a parse each time, and a broken theme's warning on each flip. Held small:
 * an id gets here only as the stored theme or one the signed-in owner previews, and a flush empties it.
 */
const kept = new Map<string, SiteTheme | null>()
const KEPT_MAX = 16

/** The installed theme by id, or null when no live version reads. Built-in ids are not looked up. */
export function installedTheme(themeId: string): SiteTheme | null {
  if (isBuiltinThemeId(themeId) || !isThemeId(themeId)) return null
  if (kept.has(themeId)) return kept.get(themeId) ?? null
  const theme = load(themeId)
  if (kept.size >= KEPT_MAX) kept.clear()
  kept.set(themeId, theme)
  return theme
}

/** Drop what is kept, so the next render reads the rows again. */
export function forgetInstalledTheme(): void {
  kept.clear()
}

onFlush(forgetInstalledTheme)

/**
 * The theme `settings.theme` names. A built-in id is that theme; a live installed one is plain
 * with its package; anything else (removed, never installed here, unreadable) is plain, never a
 * half-drawn page. What a settings save and the newsletter read: the stored choice, never a preview.
 */
export function savedTheme(settings: { theme: string }): SiteTheme {
  return isBuiltinThemeId(settings.theme)
    ? builtinTheme(settings.theme)
    : installedTheme(settings.theme) ?? builtinTheme(DEFAULT_THEME_ID)
}

/** Whether the owner may preview `themeId`: a built-in id, or an installed one whose current version reads. */
export function isPreviewableTheme(themeId: unknown): themeId is string {
  return isBuiltinThemeId(themeId) || (isThemeId(themeId) && installedTheme(themeId) !== null)
}

/**
 * The theme the page being drawn wears: the saved one, or the one the owner is previewing in
 * this request (`server/theme-preview-scope.ts`, opened only by `web/theme-preview.ts` after it
 * has checked the owner and the id). Every renderer asks here, so a preview needs no argument
 * threaded through them; a request with no preview open reads exactly `savedTheme`.
 */
export function resolveTheme(settings: { theme: string }): SiteTheme {
  const preview = currentThemePreview()
  return savedTheme(preview && isPreviewableTheme(preview.themeId) ? { theme: preview.themeId } : settings)
}
