// What the theme checker is told about this blog, in one place. The install route
// (`installed-themes.ts`) and `bun run theme:check` both read it, so the command an author
// runs can never accept what the installer would refuse, or the other way round.
//
// No database and no settings here: everything is a constant of this build.

import type { PackageOptions } from '@/theme'
import { themeContract } from '@/content/theme-contract'
import { OWNABLE_SETTINGS } from '@/content/themes-builtin'
import { RESERVED_FONT_IDS, RESERVED_PALETTE_IDS, RESERVED_THEME_IDS } from '@/content/theme-reserved'

/** The theme API versions this build reads (ADR 0072, decision 2). */
export const SUPPORTED_THEME_API: readonly number[] = [1]

/**
 * What the checker is told about this blog. The ids a stranger's theme may not take are the
 * built-in ones: its id would shadow a built-in theme, its palettes and fonts join menus that
 * already hold these.
 */
export function packageOptions(): PackageOptions {
  return {
    supportedApi: SUPPORTED_THEME_API,
    reservedIds: RESERVED_THEME_IDS,
    reservedPaletteIds: RESERVED_PALETTE_IDS,
    reservedFontIds: RESERVED_FONT_IDS,
    ownableSettings: new Set(OWNABLE_SETTINGS),
    contract: themeContract(),
  }
}
