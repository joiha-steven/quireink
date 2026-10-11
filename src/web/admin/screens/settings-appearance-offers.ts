// Settings → Appearance: WHAT AN INSTALLED THEME ADDS TO THE PICKERS (ADR 0072, T2c part 2).
//
// A theme from a zip may bring palettes and reading and chrome fonts. They are choices only while
// that theme is the chosen one (`content/theme-choices.ts`), so on this screen they are on offer
// only while its tile is the pressed one, saved or not. ALL OF THEM SHIP DRAWN, every installed
// theme's, each marked `data-theme-option="<theme id>"` and hidden unless its theme is the stored
// one; the island shows the pressed theme's and hides the rest (`admin/island/lib/settings-offers.ts`).
// One DOM per state (`docs/admin-one-dom.md`): a tile built in the browser would be a second copy
// of this markup. They sit in the built-in options' own grids, after them, in the same skin, so they
// line up with them, and each says where it comes from in the admin's own face.
//
// WHAT IS DRAWN PRESSED IS WHAT THE PAGE DRAWS. A stored font or palette an installed theme added,
// with that theme no longer the chosen one, is drawn as the default by the public site and kept in
// the row; here too the default is pressed and is the baseline, so the screen opens with nothing
// unsaved and the stored id stays until the owner picks something else.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteSettings } from '@/types'
import type { ThemeOffer } from '@/content/installed-themes'
import type { ThemeFont } from '@/theme'
import {
  DEFAULT_CHROME_FONT, DEFAULT_FONT_PRESET, DEFAULT_PRESET_ID, isChromeFontId, isFontPresetId, isPresetId,
} from '@/content/themes'
import { packageFaces } from '@/render/font-faces'
import { escapeAttr, escapeHtml } from '@/utils'
import { fill } from '@/web/admin/screens/settings-appearance-installed'

/** The theme the form opens on, when it is installed: the one whose options are drawn showing. */
const openOn = (offers: readonly ThemeOffer[], s: SiteSettings): ThemeOffer | undefined =>
  offers.find((o) => o.id === s.theme)

/** The default palette as the page draws it: the stored one when on offer, else the engine's. */
export function drawnPalette(s: SiteSettings, offers: readonly ThemeOffer[]): string {
  if (isPresetId(s.themePreset)) return s.themePreset
  return openOn(offers, s)?.palettes.some((p) => p.id === s.themePreset) ? s.themePreset : DEFAULT_PRESET_ID
}

/** The reading or chrome font as the page draws it, the same rule. */
export function drawnFont(s: SiteSettings, offers: readonly ThemeOffer[], role: 'reading' | 'chrome'): string {
  const stored = role === 'reading' ? s.fontPreset : s.chromeFont
  if (role === 'reading' ? isFontPresetId(stored) : isChromeFontId(stored)) return stored
  const on = openOn(offers, s)?.fonts.some((f) => f.role === role && f.id === stored)
  return on ? stored : role === 'reading' ? DEFAULT_FONT_PRESET : DEFAULT_CHROME_FONT
}

/** What marks an option as an installed theme's, hidden unless that theme is the stored one. */
export const optionAttrs = (offer: ThemeOffer, s: SiteSettings): string =>
  ` data-theme-option="${escapeAttr(offer.id)}"${offer.id === s.theme ? '' : ' hidden'}`

/**
 * "from <theme>", under the option's name. In the admin's own face (`font-sans`), not the theme
 * font the tile is set in: it is the admin speaking, and it has to read even when that face is
 * a display script or does not load.
 */
export const fromLine = (t: AdminStrings, offer: ThemeOffer, cls = ''): string =>
  `<span class="mt-0.5 block font-sans text-xs font-normal text-neutral-600 break-words dark:text-neutral-300${cls ? ` ${cls}` : ''}">`
  + `${escapeHtml(fill(t.themeOfferFrom, { theme: offer.name }))}</span>`

/**
 * The faces of every font the installed themes offer, so each tile is set in its own face. A
 * declaration is not a download: a face is fetched only when a shown tile asks for it. Inside the
 * part of the Look card a redraw replaces (`settings-themes.ts`), so a theme installed since the
 * page opened brings its faces with its tiles.
 */
export function offerFaces(offers: readonly ThemeOffer[]): string {
  const css = offers.map((o) => packageFaces({ hash: o.hash, fonts: o.fonts }, (f) => `'${offerFamily(o, f)}'`)).join('')
  return css ? `<style>${css}</style>` : ''
}

/**
 * The family a theme font is declared under ON THIS SCREEN: named by its package's hash as well as
 * its id. Two themes are written apart and may both call a font `serif`, and the page declares
 * every installed theme's faces at once, so under the public name (`'theme-<id>'`) one tile drew
 * the other theme's file. The hash is 64 hex digits and the id `[a-z0-9-]` (checked on read in
 * `content/chosen-theme.ts`), so no two packages share a name and none needs escaping.
 */
export const offerFamily = (offer: ThemeOffer, font: ThemeFont): string => `theme-${offer.hash}-${font.id}`

/**
 * The CSS family a theme font's tile is set in. The theme's face, then a generic family rather
 * than Inter: until the face loads the tile must not look like a choice it is not, and if it does
 * not load the island says so and sets the tile in the admin's face (`settings-offers.ts`).
 */
export const offerStack = (offer: ThemeOffer, font: ThemeFont): string =>
  `'${offerFamily(offer, font)}', ${font.role === 'chrome' ? 'sans-serif' : 'serif'}`

/** The line a tile shows in place of its sample when its face did not load. Drawn hidden. */
export const unloadedLine = (t: AdminStrings): string =>
  `<span class="mt-0.5 block font-sans text-xs font-normal text-neutral-600 dark:text-neutral-300"`
  + ` data-theme-face-unloaded hidden>${escapeHtml(t.themeFontUnloaded)}</span>`

/** Every installed theme's fonts of `role`, each with the theme it belongs to. */
export const offerFonts = (offers: readonly ThemeOffer[], role: 'reading' | 'chrome'): [ThemeOffer, ThemeFont][] =>
  offers.flatMap((o) => o.fonts.filter((f) => f.role === role).map((f): [ThemeOffer, ThemeFont] => [o, f]))

/**
 * The key that moves the palette and the two fonts to what the pressed theme suggests, unsaved.
 * Drawn hidden: the island shows it only while a suggestion on offer differs from the pick.
 * Outside the part a redraw replaces, so its listener and its place stay put.
 */
export const suggestKey = (t: AdminStrings, cls: string): string =>
  `<div class="mt-3" data-theme-suggest-row hidden><button type="button" data-theme-suggest class="${cls}">`
  + `${escapeHtml(t.themeSuggestUse)}</button></div>`
