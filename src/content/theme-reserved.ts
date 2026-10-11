// The ids a theme installed from a zip may not take, because the engine's own things already have
// them (ADR 0072): the built-in themes, palettes and fonts. One list, read by the installer, which
// refuses a package that takes one (`content/installed-themes.ts`), and by the renderer, which
// draws plain for a stored row that does (`content/chosen-theme.ts`): a backup is loaded without
// being checked again, and a palette named `mono` or a font named `literata` would stand in for
// the built-in one.

import { BUILTIN_THEMES } from '@/content/themes-builtin'
import { CHROME_FONTS, FONT_PRESETS, THEME_PRESETS } from '@/content/themes'

export const RESERVED_THEME_IDS: ReadonlySet<string> = new Set(BUILTIN_THEMES.map((t) => t.id))
export const RESERVED_PALETTE_IDS: ReadonlySet<string> = new Set(THEME_PRESETS.map((p) => p.id))
export const RESERVED_FONT_IDS: ReadonlySet<string> = new Set([...FONT_PRESETS.map((f) => f.id), ...CHROME_FONTS.map((f) => f.id)])
