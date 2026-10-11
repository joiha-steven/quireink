// The fonts and palettes a page is DRAWN in, from what the settings store and the theme the site
// is wearing (ADR 0072, T2b).
//
// An installed theme adds choices: its reading and chrome fonts join the two font settings, its
// palettes join the palette setting, and its display font becomes `--font-display`. They are
// choices only while that theme is the chosen one. A stored id that names none of them (the theme
// was removed, or another one chosen) is drawn as the default and KEPT in the row, the rule an
// unknown theme id already follows: going back to the theme brings the choice back with it.
//
// Pure: the theme comes in resolved (`content/chosen-theme.ts`), so nothing here reads the
// database, and a write asks the same questions (`content/settings-save.ts`).

import type { SiteSettings, ThemeSettings } from '@/types'
import type { SiteTheme } from '@/content/themes-builtin'
import type { ThemeFont } from '@/theme'
import {
  DEFAULT_CHROME_FONT, DEFAULT_FONT_PRESET, DEFAULT_PRESET_ID, getFontPreset, isChromeFontId,
  isFontPresetId, isPresetId,
} from '@/content/themes'

type Role = ThemeFont['role']

/** The chosen theme's font of `role` named `id`, or null. */
export const themeFont = (theme: SiteTheme, role: Role, id: unknown): ThemeFont | null =>
  theme.package?.fonts.find((f) => f.role === role && f.id === id) ?? null

/** Whether `id` is one of the chosen theme's palettes. */
export const isThemePalette = (theme: SiteTheme, id: unknown): id is string =>
  theme.package?.palettes.some((p) => p.id === id) ?? false

export type DrawnFonts = {
  /**
   * The built-in reading font the page declares: the stored one, or the default when the stored
   * id is not a built-in font. Under a theme's reading font this is its fallback stack.
   */
  readingPreset: string
  /** The theme's reading font, when it is the stored choice. */
  reading: ThemeFont | null
  /** The chrome font as drawn: a built-in id or the theme's chrome font's id. */
  chromeFont: string
  /** The theme's chrome font, when it is the stored choice. */
  chrome: ThemeFont | null
  /** The theme's first display font: the face `--font-display` names. */
  display: ThemeFont | null
}

export function drawnFonts(settings: Pick<SiteSettings, 'fontPreset' | 'chromeFont'>, theme: SiteTheme): DrawnFonts {
  const chrome = themeFont(theme, 'chrome', settings.chromeFont)
  return {
    readingPreset: isFontPresetId(settings.fontPreset) ? settings.fontPreset : DEFAULT_FONT_PRESET,
    reading: themeFont(theme, 'reading', settings.fontPreset),
    chromeFont: chrome ? chrome.id : isChromeFontId(settings.chromeFont) ? settings.chromeFont : DEFAULT_CHROME_FONT,
    chrome,
    display: theme.package?.fonts.find((f) => f.role === 'display') ?? null,
  }
}

/**
 * The CSS family a theme's font is declared under. Prefixed, so an id that happens to be the
 * name of a system face (`georgia`) cannot take that face's place in the engine's own stacks.
 * The id is `[a-z0-9-]` (the checker, and `content/chosen-theme.ts` again on read), so it needs
 * no escaping inside the quotes.
 */
export const themeFamily = (font: ThemeFont): string => `'theme-${font.id}'`

/** The face a theme's chrome font falls back to: the engine's own chrome default. */
const CHROME_FALLBACK = `'Inter', 'Inter Fallback', system-ui, -apple-system, 'Segoe UI', sans-serif`

/**
 * The variables a theme's fonts set, after the engine's own font rules so it wins them, and
 * before the owner's uploaded font, which still wins the reading face as it wins a preset. A
 * missing glyph falls to the stack the setting draws without the theme.
 */
export function themeFontVarsCss(fonts: DrawnFonts): string {
  const vars = [
    fonts.reading ? `--font-reading:${themeFamily(fonts.reading)}, ${getFontPreset(DEFAULT_FONT_PRESET).stack}` : '',
    fonts.chrome ? `--font-sans:${themeFamily(fonts.chrome)}, ${CHROME_FALLBACK}` : '',
  ].filter(Boolean)
  return vars.length ? `:root{${vars.join(';')}}` : ''
}

/** `--font-display`: a built-in theme's headline stack, an installed theme's display font, or the reading face. */
export function displayFontValue(theme: SiteTheme, fonts: DrawnFonts): string {
  if (theme.display) return theme.display.stack
  return fonts.display ? `${themeFamily(fonts.display)}, var(--font-reading)` : 'var(--font-reading)'
}

export type DrawnPalettes = Pick<SiteSettings, 'themePreset' | 'enabledPalettes'> & {
  themes: Record<string, ThemeSettings>
  /** The theme's palettes' names by id, for the reader's palette menu. */
  names: Record<string, string>
}

/**
 * The palettes as drawn: the theme's added to the owner's, the default kept when it is available
 * and the engine's default when it is not. Whichever default is drawn is in the list a reader may
 * switch between, as the stored list always holds a built-in default (`sanitizeEnabledPalettes`):
 * a theme palette chosen as the default is added here, never stored, and so is the engine's
 * default when the stored one is not on offer. With nothing else enabled that is a list of one,
 * and no menu.
 */
export function drawnPalettes(
  settings: Pick<SiteSettings, 'themePreset' | 'enabledPalettes' | 'themes'>,
  theme: SiteTheme,
): DrawnPalettes {
  const own = theme.package?.palettes ?? []
  const themes: Record<string, ThemeSettings> = { ...settings.themes }
  for (const p of own) themes[p.id] = { light: { ...p.light }, dark: { ...p.dark } }
  const chosen = isThemePalette(theme, settings.themePreset)
  const themePreset = chosen || isPresetId(settings.themePreset) ? settings.themePreset : DEFAULT_PRESET_ID
  // A built-in default is always in the stored list already, so a built-in blog's list is untouched.
  const enabledPalettes = settings.enabledPalettes.includes(themePreset)
    ? settings.enabledPalettes
    : [themePreset, ...settings.enabledPalettes]
  return { themePreset, enabledPalettes, themes, names: Object.fromEntries(own.map((p) => [p.id, p.name])) }
}
