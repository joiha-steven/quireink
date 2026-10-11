// The theme checker's one door (ADR 0072). Pure functions over strings, bytes and parsed JSON:
// no file system, no network, nothing Bun-only, so the install route on either runtime and
// the `theme:check` command line call the same code.
//
// A theme is accepted only when all three return nothing to report:
//   checkThemeFiles(entries)                         the zip's paths, sizes, SVG content
//   checkThemeManifest(json, opts)                   theme.json
//   checkThemeCss(css, contract, packageFiles)       theme.css, decoded by decodeThemeText

export { checkThemeCss } from '@/theme/check-css'
export { checkThemeManifest, PALETTE_MIN_CONTRAST, PALETTE_TEXT_ROLES } from '@/theme/check-manifest'
export type { ManifestOptions } from '@/theme/check-manifest'
export { checkThemeFiles, SCREENSHOT_SIZE } from '@/theme/check-files'
// The one way theme.css and theme.json bytes become the strings the checkers read.
export { decodeThemeText } from '@/theme/file-content'
export type { ThemeFileEntry } from '@/theme/check-files'
export { THEME_LIMITS } from '@/theme/types'
export type {
  ThemeContract, ThemeFont, ThemeFontFace, ThemeManifest, ThemePalette, ThemePaletteColors,
  ThemeRule, ThemeSurface, Violation,
} from '@/theme/types'
