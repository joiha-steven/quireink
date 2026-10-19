// The pictures of the built-in themes, where the owner chooses one: the tiles on Settings →
// Appearance → Theme and the cards on the first-run look step.
//
// Each is a photograph of the showcase blog's front page wearing the theme, light and dark,
// written by `bun run theme:tiles` (`scripts/theme-tiles.ts`) into `assets/static/theme-shots/`
// and served beside the fonts (`web/static.ts`), immutable for a year. That generator also writes
// `versions.json`, the first characters of each file's SHA-256, which goes in the URL here: a
// regenerated picture is a new URL, so a browser that kept the old one for its year still asks.
//
// Only these two screens name the URLs. No reader page links one (`theme-shots.test.ts`).
//
// A module of its own, with no file imports, because the admin's island bundle reaches the
// theme registry and must not carry the server's static files with it.
import type { BuiltinThemeId } from '@/content/themes-builtin'
import versions from '@/assets/static/theme-shots/versions.json' with { type: 'json' }

export type ShotScheme = 'light' | 'dark'

/** The served path of one picture, without its version. `web/static.ts` registers the same paths. */
export const themeShotPath = (id: BuiltinThemeId, scheme: ShotScheme): string => `/theme-shots/${id}-${scheme}.webp`

/** The URL a page links: the path, and the picture's version so a new file is a new URL. */
export const themeShotUrl = (id: BuiltinThemeId, scheme: ShotScheme): string =>
  `${themeShotPath(id, scheme)}?v=${versions[`${id}-${scheme}`]}`
