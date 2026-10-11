// `theme.json` (A6): the parsed JSON in, a typed manifest out, or the list of what is wrong.
//
// Every field is copied into a fresh object rather than the input being cast, so nothing the
// author added (an unknown key, a `__proto__` own property from JSON.parse) survives into the
// value the engine stores. Unknown keys are refused at every level, not ignored: a typo in an
// optional key would otherwise vanish without the author ever learning why it did nothing.
//
// Violations carry the JSON path as their subject (`palettes[1].dark.meta`), line and column 0.

import { contrastRatio } from '@/pen/derive'
import { isSafePackagePath } from '@/theme/package-path'
import type {
  ThemeFont, ThemeFontFace, ThemeManifest, ThemePalette, ThemePaletteColors, Violation,
} from '@/theme/types'

const FILE = 'theme.json'
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/
const HEX = /^#[0-9a-fA-F]{6}$/
const VERSION = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/
const CONTROL = /\p{Cc}/u
/** Control and format characters: bidi overrides (U+202E), zero-width spaces and joiners. */
const INVISIBLE = /[\p{Cc}\p{Cf}]/u
/** At least one character a reader can see. */
const VISIBLE = /[^\s\p{Z}\p{Cc}\p{Cf}]/u
/**
 * A font name becomes a `font-family` string in CSS the engine writes, so it is held to
 * letters, digits, space, `.`, `_` and `-`: no quote, brace or semicolon to close it early.
 */
const FONT_NAME = /^[\p{L}\p{N} ._-]+$/u

const COLOUR_KEYS = ['bg', 'text', 'heading', 'meta', 'link', 'rule', 'accent'] as const

/**
 * The contrast floor every built-in palette clears, from `src/content/palette-contrast.test.ts`
 * ("palette contrast"): each text role against its own page, in light and in dark, at 5.0:1.
 * `rule` is a hairline and `accent` tracks `link`, so neither is read as text there either.
 */
export const PALETTE_MIN_CONTRAST = 5.0
export const PALETTE_TEXT_ROLES = ['text', 'heading', 'meta', 'link'] as const

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

class Reader {
  readonly violations: Violation[] = []
  fail(path: string): void {
    this.violations.push({ rule: 'A6', file: FILE, line: 0, col: 0, subject: path.slice(0, 80) })
  }
  /** Refuses every key of `o` not in `allowed`. */
  only(o: Obj, allowed: readonly string[], path: string): void {
    for (const key of Object.keys(o)) if (!allowed.includes(key)) this.fail(path ? `${path}.${key}` : key)
  }
  /**
   * A string of 1 to `max` code points shown to the owner: no control or format characters
   * (a right-to-left override can make `gnp.exe` read as `exe.png`), and something visible.
   */
  text(v: unknown, path: string, max: number): string | undefined {
    if (typeof v !== 'string' || v.length > max * 2 || INVISIBLE.test(v) || !VISIBLE.test(v)) return void this.fail(path)
    if (Array.from(v).length > max) return void this.fail(path)
    return v
  }
  kebab(v: unknown, path: string): string | undefined {
    if (typeof v !== 'string' || v.length > 40 || !KEBAB.test(v)) return void this.fail(path)
    return v
  }
  list(v: unknown, path: string, max: number): unknown[] | undefined {
    if (!Array.isArray(v) || v.length > max) return void this.fail(path)
    return v
  }
}

export type ManifestOptions = {
  supportedApi: readonly number[]
  /** Theme ids taken by the built-in themes. */
  reservedIds: ReadonlySet<string>
  /** Palette ids taken by the built-in palettes: a theme's palette joins the same menu. */
  reservedPaletteIds: ReadonlySet<string>
  /** Font ids taken by the built-in reading and chrome fonts, which share the font pickers. */
  reservedFontIds: ReadonlySet<string>
  packageFiles: ReadonlySet<string>
}

export function checkThemeManifest(
  raw: unknown,
  opts: ManifestOptions,
): { ok: true; manifest: ThemeManifest } | { ok: false; violations: Violation[] } {
  const r = new Reader()
  if (!isObj(raw)) {
    r.fail('')
    return { ok: false, violations: r.violations }
  }
  r.only(raw, ['api', 'id', 'name', 'version', 'author', 'homepage', 'license', 'description',
    'layout', 'palettes', 'fonts', 'suggests'], '')

  const api = raw.api
  if (typeof api !== 'number' || !Number.isInteger(api) || !opts.supportedApi.includes(api)) r.fail('api')
  let id = r.kebab(raw.id, 'id')
  if (id !== undefined && opts.reservedIds.has(id)) {
    r.fail('id')
    id = undefined
  }
  const name = r.text(raw.name, 'name', 60)
  const version = typeof raw.version === 'string' && VERSION.test(raw.version) ? raw.version : void r.fail('version')
  const author = r.text(raw.author, 'author', 80)
  const license = r.text(raw.license, 'license', 40)
  const homepage = raw.homepage === undefined ? undefined : readHomepage(raw.homepage, r)
  const description = raw.description === undefined ? undefined : r.text(raw.description, 'description', 200)
  const layout = raw.layout === undefined ? undefined : readLayout(raw.layout, r)
  const palettes = raw.palettes === undefined ? undefined : readPalettes(raw.palettes, r, opts.reservedPaletteIds)
  const fonts = raw.fonts === undefined ? undefined : readFonts(raw.fonts, r, opts)
  const suggests = raw.suggests === undefined ? undefined : readSuggests(raw.suggests, r, opts, palettes ?? [], fonts ?? [])

  if (r.violations.length > 0 || typeof api !== 'number' || id === undefined || name === undefined ||
    version === undefined || author === undefined || license === undefined) {
    return { ok: false, violations: r.violations }
  }
  const manifest: ThemeManifest = { api, id, name, version, author, license }
  if (homepage !== undefined) manifest.homepage = homepage
  if (description !== undefined) manifest.description = description
  if (layout !== undefined) manifest.layout = layout
  if (palettes !== undefined) manifest.palettes = palettes
  if (fonts !== undefined) manifest.fonts = fonts
  if (suggests !== undefined) manifest.suggests = suggests
  return { ok: true, manifest }
}

function readHomepage(v: unknown, r: Reader): string | undefined {
  if (typeof v !== 'string' || v.length > 200 || !v.startsWith('https://') || CONTROL.test(v)) return void r.fail('homepage')
  try {
    const url = new URL(v)
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return void r.fail('homepage')
  } catch {
    return void r.fail('homepage')
  }
  return v
}

function readLayout(v: unknown, r: Reader): ThemeManifest['layout'] {
  if (!isObj(v)) return void r.fail('layout')
  r.only(v, ['menu'], 'layout')
  if (v.menu === undefined) return {}
  if (v.menu !== 'rail' && v.menu !== 'header') return void r.fail('layout.menu')
  return { menu: v.menu }
}

function readColours(v: unknown, r: Reader, path: string): ThemePaletteColors | undefined {
  if (!isObj(v)) return void r.fail(path)
  r.only(v, COLOUR_KEYS, path)
  const out: Partial<ThemePaletteColors> = {}
  let ok = true
  for (const key of COLOUR_KEYS) {
    const c = v[key]
    if (typeof c === 'string' && HEX.test(c)) out[key] = c.toLowerCase()
    else {
      r.fail(`${path}.${key}`)
      ok = false
    }
  }
  if (!ok) return undefined
  const colours = out as ThemePaletteColors
  for (const role of PALETTE_TEXT_ROLES) {
    if (contrastRatio(colours[role], colours.bg) < PALETTE_MIN_CONTRAST) r.fail(`${path}.${role}`)
  }
  return colours
}

function readPalettes(v: unknown, r: Reader, reserved: ReadonlySet<string>): ThemePalette[] | undefined {
  const list = r.list(v, 'palettes', 8)
  if (!list) return undefined
  const out: ThemePalette[] = []
  const seen = new Set<string>()
  list.forEach((p, i) => {
    const path = `palettes[${i}]`
    if (!isObj(p)) return r.fail(path)
    r.only(p, ['id', 'name', 'light', 'dark'], path)
    const id = r.kebab(p.id, `${path}.id`)
    if (id !== undefined && (seen.has(id) || reserved.has(id))) r.fail(`${path}.id`)
    if (id !== undefined) seen.add(id)
    const name = r.text(p.name, `${path}.name`, 40)
    const light = readColours(p.light, r, `${path}.light`)
    const dark = readColours(p.dark, r, `${path}.dark`)
    if (id && name && light && dark) out.push({ id, name, light, dark })
  })
  return out
}

function readFonts(v: unknown, r: Reader, opts: ManifestOptions): ThemeFont[] | undefined {
  const list = r.list(v, 'fonts', 6)
  if (!list) return undefined
  const out: ThemeFont[] = []
  const seen = new Set<string>()
  list.forEach((font, i) => {
    const path = `fonts[${i}]`
    if (!isObj(font)) return r.fail(path)
    r.only(font, ['id', 'name', 'role', 'faces'], path)
    const id = r.kebab(font.id, `${path}.id`)
    if (id !== undefined && (seen.has(id) || opts.reservedFontIds.has(id))) r.fail(`${path}.id`)
    if (id !== undefined) seen.add(id)
    let name = r.text(font.name, `${path}.name`, 60)
    if (name !== undefined && !FONT_NAME.test(name)) {
      r.fail(`${path}.name`)
      name = undefined
    }
    const role = font.role === 'reading' || font.role === 'chrome' || font.role === 'display'
      ? font.role
      : void r.fail(`${path}.role`)
    const faces = readFaces(font.faces, r, `${path}.faces`, opts.packageFiles)
    if (id && name && role && faces) out.push({ id, name, role, faces })
  })
  return out
}

function readFaces(v: unknown, r: Reader, path: string, packageFiles: ReadonlySet<string>): ThemeFontFace[] | undefined {
  const list = r.list(v, path, 4)
  if (!list) return undefined
  if (list.length === 0) return void r.fail(path)
  const out: ThemeFontFace[] = []
  const seen = new Set<string>()
  list.forEach((face, i) => {
    const at = `${path}[${i}]`
    if (!isObj(face)) return r.fail(at)
    r.only(face, ['file', 'weight', 'style'], at)
    const file = typeof face.file === 'string' && /^fonts\/[^/]+\.woff2$/.test(face.file) &&
      isSafePackagePath(face.file) && packageFiles.has(face.file)
      ? face.file
      : void r.fail(`${at}.file`)
    const w = face.weight
    const weight = typeof w === 'number' && Number.isInteger(w) && w >= 100 && w <= 900 && w % 100 === 0
      ? w
      : void r.fail(`${at}.weight`)
    const style = face.style === 'normal' || face.style === 'italic' ? face.style : void r.fail(`${at}.style`)
    // Two faces at one weight and style: the browser would pick one, and which is unspecified.
    if (weight !== undefined && style !== undefined) {
      const key = `${weight}/${style}`
      if (seen.has(key)) r.fail(at)
      seen.add(key)
    }
    if (file && weight !== undefined && style) out.push({ file, weight, style })
  })
  return out
}

/**
 * A suggestion names something that exists: a palette this theme adds or a built-in one, a
 * font of the matching role this theme adds or a built-in one.
 */
function readSuggests(
  v: unknown, r: Reader, opts: ManifestOptions, palettes: readonly ThemePalette[], fonts: readonly ThemeFont[],
): ThemeManifest['suggests'] {
  if (!isObj(v)) return void r.fail('suggests')
  r.only(v, ['palette', 'readingFont', 'chromeFont'], 'suggests')
  const ids = (role: ThemeFont['role']) => fonts.filter((f) => f.role === role).map((f) => f.id)
  const known = {
    palette: new Set([...palettes.map((p) => p.id), ...opts.reservedPaletteIds]),
    readingFont: new Set([...ids('reading'), ...opts.reservedFontIds]),
    chromeFont: new Set([...ids('chrome'), ...opts.reservedFontIds]),
  }
  const out: NonNullable<ThemeManifest['suggests']> = {}
  for (const key of ['palette', 'readingFont', 'chromeFont'] as const) {
    if (v[key] === undefined) continue
    const s = v[key]
    if (typeof s === 'string' && known[key].has(s)) out[key] = s
    else r.fail(`suggests.${key}`)
  }
  return out
}
