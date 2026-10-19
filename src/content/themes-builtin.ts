// THE FOUR THEMES THIS BUILD SHIPS, and the one place that knows how they differ (ADR 0072).
//
// Every difference between them used to be a branch on the look's NAME somewhere in the
// renderer: the newspaper moved the menu into its masthead in three files, declared and
// preloaded a headline face in two more, wrote its figure labels inline, and the source-code
// look asked for its own rail rules and its own letter-spacing. Each of those is now a field
// below, and the engine reads the field rather than the name, so a theme the engine has never
// heard of can ask for the same thing by declaring it. `theme-switches.test.ts` fails the
// build when a comparison with one of these names turns up anywhere else in the renderer.
//
// `settings.theme` holds the id. `settings.look`, the field's name before this file, is still
// read and still written beside it, so an older build reading the same row keeps the choice
// (`content/settings.ts`, `content/settings-save.ts`).

import type { SiteLook } from '@/types'
import type { ThemeFont, ThemePalette } from '@/theme'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { DISPLAY_SLUG } from '@/content/fonts'
import { LOOK_CODE_RAIL_ASIDE_CSS, LOOK_CODE_RAIL_BAND_CSS } from '@/web/look-code-rail.css'

/** A key of the admin's strings whose value is one string (some are tables of them). */
type AdminText = { [K in keyof AdminStrings]: AdminStrings[K] extends string ? K : never }[keyof AdminStrings]

/** The ids of the built-in themes. The same four words `settings.look` always held. */
export type BuiltinThemeId = SiteLook

/** A built-in theme's own stylesheet, by its name in `SERVED_CSS` (`web/served-css.ts`). */
export type ThemeSheet = 'look-code' | 'look-paper' | 'look-notes'

/**
 * Where the site menu lives. `rail` is the engine's own place for it. `header` draws it in the
 * masthead on every page and leaves it out of the rail's gutter; the drawer a phone opens
 * still carries it, because on a phone the masthead has no room for it.
 */
export type MenuPlace = 'rail' | 'header'

/**
 * Which face the theme sets the CHROME in, which is what decides where the tracking
 * correction for a monospace chrome font belongs (`render/font-faces.ts`, `monoTracking`).
 *
 *   setting         the owner's chrome-font choice, which is the engine's own behaviour
 *   own             the theme sets `body` in faces of its own; only what still names
 *                   `var(--font-sans)` is drawn in the chrome font, so only that is corrected
 *   jetbrains-mono  the theme sets the chrome in JetBrains Mono whatever the setting says, so
 *                   that face's correction applies under the theme regardless. No built-in
 *                   theme does since the source-code one gave the chrome back to the setting.
 */
export type ChromeFace = 'setting' | 'own' | 'jetbrains-mono'


/**
 * The settings a theme may draw itself (`ownsSettings`), as the admin names them. Closed: each
 * one needs a control the admin can hide (`ownable` in `web/admin/screens/settings-post.ts`) and
 * a renderer that can draw without its saved value (`tableToCss`). An installed theme's
 * `theme.json` is checked against the same list.
 */
export const OWNABLE_SETTINGS = ['table.head', 'table.grid', 'table.ruleWeight'] as const
export type OwnableSetting = (typeof OWNABLE_SETTINGS)[number]

/**
 * What an installed theme brings beyond plain's fields (`content/chosen-theme.ts` reads it from
 * the current version's row): the package's hash, which names its sheet and font files under
 * `/themes/<hash>/`, and the fonts and palettes its `theme.json` declares.
 */
export type InstalledPackage = {
  hash: string
  fonts: readonly ThemeFont[]
  palettes: readonly ThemePalette[]
}

export type SiteTheme = {
  /** A built-in id, or the id of a theme installed from a zip. */
  id: string
  /** The theme's name and its one line of who it is for, as keys of the admin's strings. */
  nameKey: AdminText
  hintKey: AdminText
  /** Linked after the public sheet, only on a blog that wears the theme. `null`: none. */
  sheet: ThemeSheet | null
  /**
   * The value of `data-look` on `<html>`, which every rule in the three built-in sheets hangs
   * off and which custom CSS in the wild selects on. '' writes no attribute, as on plain.
   */
  dataLook: '' | Exclude<BuiltinThemeId, 'plain'>
  /**
   * `deepenMetaInk`: the theme lays the page on a ground darker than the palette's background
   * (the notebook's desk), where the palette's meta ink falls under AA, so the engine takes it
   * a step toward the text ink for the whole page (`web/layout-styles.ts`, `deepenMetaInkCss`).
   * The same switch a theme.json may declare, because a sheet may not set `--c-meta` itself.
   */
  layout: { menu: MenuPlace; deepenMetaInk: boolean }
  /**
   * The headline face, read through `--font-display`. Declared and preloaded only on a blog
   * wearing the theme; without one, `--font-display` is the reading face.
   */
  display: { slug: string; stack: string } | null
  chromeFace: ChromeFace
  /**
   * Rules that only apply inside the rail's media queries, which are computed from the reading
   * column and so cannot sit in a static sheet (`render/rail-css.ts`, `railThemeCss`). `band`
   * is the width where the rail is a band over the page, `aside` the width where the listing's
   * second rail stands in the right gutter.
   *
   * The one field a theme from a zip has no equivalent of, and the one piece of a built-in
   * theme's CSS the checker does not read (`web/look-code-rail.css.ts` says how it is held).
   */
  rail: { band: string; aside: string } | null
  /**
   * The settings the theme is drawn for, offered to the owner when the theme is switched on
   * and never written over a choice already saved. The same field a theme's `theme.json`
   * carries (THEMES.md section 2). Ids are the engine's (`content/fonts.ts`, `content/themes.ts`).
   */
  suggests: { palette?: string; readingFont?: string; chromeFont?: string }
  /**
   * The chrome font a blog wearing this theme was DRAWN in through 2.2.19, whatever its
   * setting said: each of the three sheets set `body` in a face of its own, which is what left
   * the chrome-font control dead on them. A settings row from then (one with no `theme` key)
   * reads this as its chrome font, so the fix changes nothing on a blog that is already
   * running (`content/settings.ts`). History, not a preference: it never changes, where
   * `suggests` may. `null`: the theme drew the chrome in the setting, or did not exist then.
   */
  legacyChromeFont: string | null
  /**
   * Settings keys the theme decides for itself, as the admin names them (`table.head`). While
   * the theme is the chosen one, the admin hides the control of each and says the theme draws
   * that part, and the page is drawn without the saved value of it. The saved value is never
   * changed: on another theme it applies again. An installed theme declares the same list in
   * `theme.json`, from `OWNABLE_SETTINGS`. Empty: the theme leaves every knob to the owner.
   */
  ownsSettings: readonly OwnableSetting[]
  /** `null` on a built-in theme; an installed one's package (`InstalledPackage`). */
  package: InstalledPackage | null
}

/** A theme this build ships. */
export type BuiltinTheme = SiteTheme & { id: BuiltinThemeId }

const PLAIN: BuiltinTheme = {
  id: 'plain', nameKey: 'lookPlain', hintKey: 'lookStepPlainHint',
  sheet: null, dataLook: '', layout: { menu: 'rail', deepenMetaInk: false }, display: null, chromeFace: 'setting', rail: null,
  suggests: {}, legacyChromeFont: null, ownsSettings: [], package: null,
}

/** In the order the admin and the setup step offer them. */
export const BUILTIN_THEMES: readonly BuiltinTheme[] = [
  PLAIN,
  {
    id: 'code', nameKey: 'lookCode', hintKey: 'lookStepCodeHint',
    sheet: 'look-code', dataLook: 'code', layout: { menu: 'rail', deepenMetaInk: false }, display: null,
    chromeFace: 'setting',
    rail: { band: LOOK_CODE_RAIL_BAND_CSS, aside: LOOK_CODE_RAIL_ASIDE_CSS },
    suggests: { chromeFont: 'jetbrains-mono' }, legacyChromeFont: 'jetbrains-mono', ownsSettings: [], package: null,
  },
  {
    id: 'paper', nameKey: 'lookPaper', hintKey: 'lookStepPaperHint',
    sheet: 'look-paper', dataLook: 'paper', layout: { menu: 'header', deepenMetaInk: false },
    // The stack the newspaper's sheet named by hand before `--font-display` existed, to the
    // character, so its headlines resolve to the same faces they always did.
    display: {
      slug: DISPLAY_SLUG,
      stack: "'Source Serif 4','Source Serif 4 Fallback','Source Serif 4 Fallback 2',Georgia,'Times New Roman',serif",
    },
    // `own`: the sheet sets the chrome in the reading face, and only its labels (kickers,
    // dates, section heads) in the chrome font.
    chromeFace: 'own', rail: null,
    suggests: { chromeFont: 'inter' }, legacyChromeFont: 'inter',
    // The sheet rules its own tables like a printed page (`web/look-paper.css.ts`): borders and
    // header ground are set there, so these three knobs have nothing to act on.
    ownsSettings: ['table.head', 'table.grid', 'table.ruleWeight'], package: null,
  },
  {
    id: 'notes', nameKey: 'lookNotes', hintKey: 'lookStepNotesHint',
    sheet: 'look-notes', dataLook: 'notes', layout: { menu: 'rail', deepenMetaInk: true }, display: null,
    chromeFace: 'setting', rail: null,
    suggests: { chromeFont: 'inter' }, legacyChromeFont: 'inter', ownsSettings: [], package: null,
  },
]

export const DEFAULT_THEME_ID: BuiltinThemeId = 'plain'

/** What a row from before `look` existed meant by `ideChrome: true` (`content/settings.ts`). */
export const IDE_CHROME_THEME_ID: BuiltinThemeId = 'code'

export const isBuiltinThemeId = (value: unknown): value is BuiltinThemeId =>
  typeof value === 'string' && BUILTIN_THEMES.some((theme) => theme.id === value)

/**
 * What `settings.look`, the old name, holds for a theme id: the id itself when it is built in,
 * and plain otherwise, because plain is all a build from before ADR 0072 could draw for it.
 */
export const legacyLook = (id: string): BuiltinThemeId => (isBuiltinThemeId(id) ? id : DEFAULT_THEME_ID)

/** The theme by id, and plain for an id this build does not ship. */
export function builtinTheme(id: string): BuiltinTheme {
  return BUILTIN_THEMES.find((theme) => theme.id === id) ?? PLAIN
}

/**
 * The shape of ANY theme id, built in or not: lowercase letters and digits in runs joined by
 * single hyphens, at most 40 characters. The theme checker holds an installed theme's id, and
 * the ids of its fonts and palettes, to the same shape (`theme/check-manifest.ts`).
 *
 * Wider than the four on purpose. A row may name a theme this build cannot draw: one installed
 * from a zip and since removed, or one a later build installed. It is read and written back as it
 * is (`content/settings.ts`), so a save never loses the choice, and only the renderer falls back
 * to plain (`content/chosen-theme.ts`, `resolveTheme`). A WRITE can choose only a built-in theme
 * or a live installed one (`content/settings-save.ts`). Anything not of this shape (a quote, a
 * space, an object) is not an id and is never kept.
 */
export const isThemeId = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 40 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
