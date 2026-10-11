// The shapes the theme checker speaks in (ADR 0072). Imported through `src/theme/index.ts`.

/**
 * One code per rule in the theme standard. C1 colour, T1 font size, F1 font family, P1
 * `!important`, S1 selector names, S2 both surfaces styled, S3 no text in `content`, V1 custom
 * properties, A1 forbidden at-rules and properties, A2 URLs, A3 package paths, A4 SVG content,
 * A5 sizes, A6 manifest shape, X1 syntax the browser would drop or read differently.
 */
export type ThemeRule =
  | 'C1' | 'T1' | 'F1' | 'P1' | 'S1' | 'S2' | 'S3' | 'V1'
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'X1'

/**
 * One refusal. No prose: the admin builds the message from `locales/`. `subject` is the
 * offending text, whitespace collapsed and cut to 80 characters. `line` and `col` are 1-based;
 * both are 0 when the finding has no place in a file (a missing surface, a manifest field, a
 * size).
 */
export type Violation = { rule: ThemeRule; file: string; line: number; col: number; subject: string }

export type ThemeSurface = 'blog' | 'front'

export type ThemeContract = {
  /** Class names a theme may select, without the dot: 'post-list'. */
  classes: ReadonlySet<string>
  /** Ids a theme may select, without the hash: 'comments'. */
  ids: ReadonlySet<string>
  /** The `data-*` attribute names a theme may select, lowercase: 'data-palette'. */
  attributes: ReadonlySet<string>
  /** Keyed '.fc' or '#comments'. A name that is absent is shared and counts for neither. */
  surfaceOf: ReadonlyMap<string, ThemeSurface>
  /** Engine variables a theme may read: '--c-bg'. `--t-*` and `--l-*` are always readable. */
  vars: ReadonlySet<string>
}

export const THEME_LIMITS = {
  cssBytes: 65536,
  fontBytes: 409600,
  imageBytes: 1048576,
  totalBytes: 10485760,
  // The zip as uploaded; `totalBytes` bounds what it expands to.
  zipBytes: 5242880,
  files: 64,
} as const

export type ThemePaletteColors = {
  bg: string
  text: string
  heading: string
  meta: string
  link: string
  rule: string
  accent: string
}

export type ThemePalette = { id: string; name: string; light: ThemePaletteColors; dark: ThemePaletteColors }

export type ThemeFontFace = { file: string; weight: number; style: 'normal' | 'italic' }

export type ThemeFont = {
  id: string
  name: string
  role: 'reading' | 'chrome' | 'display'
  faces: ThemeFontFace[]
}

export type ThemeManifest = {
  api: number
  id: string
  name: string
  version: string
  author: string
  homepage?: string
  license: string
  description?: string
  layout?: { menu?: 'rail' | 'header' }
  palettes?: ThemePalette[]
  fonts?: ThemeFont[]
  suggests?: { palette?: string; readingFont?: string; chromeFont?: string }
}
