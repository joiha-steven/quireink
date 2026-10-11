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
import type { AdminStrings } from '@/i18n/admin-i18n'
import { DISPLAY_SLUG } from '@/content/fonts'
import { LOOK_CODE_RAIL_ASIDE_CSS, LOOK_CODE_RAIL_BAND_CSS } from '@/web/look-code-rail.css'
import {
  CODE_CARD, CODE_TILE, NOTES_CARD, NOTES_TILE, PAPER_CARD, PAPER_TILE, PLAIN_CARD, PLAIN_TILE,
} from '@/content/themes-builtin-art'

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

export type SiteTheme = {
  id: BuiltinThemeId
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
  /** What stands for the theme where the owner picks one (`content/themes-builtin-art.ts`). */
  art: { tile: string; card: string }
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
}

const PLAIN: SiteTheme = {
  id: 'plain', nameKey: 'lookPlain', hintKey: 'lookStepPlainHint',
  sheet: null, dataLook: '', layout: { menu: 'rail', deepenMetaInk: false }, display: null, chromeFace: 'setting', rail: null,
  art: { tile: PLAIN_TILE, card: PLAIN_CARD }, suggests: {}, legacyChromeFont: null,
}

/** In the order the admin and the setup step offer them. */
export const BUILTIN_THEMES: readonly SiteTheme[] = [
  PLAIN,
  {
    id: 'code', nameKey: 'lookCode', hintKey: 'lookStepCodeHint',
    sheet: 'look-code', dataLook: 'code', layout: { menu: 'rail', deepenMetaInk: false }, display: null,
    chromeFace: 'setting',
    rail: { band: LOOK_CODE_RAIL_BAND_CSS, aside: LOOK_CODE_RAIL_ASIDE_CSS },
    art: { tile: CODE_TILE, card: CODE_CARD },
    suggests: { chromeFont: 'jetbrains-mono' }, legacyChromeFont: 'jetbrains-mono',
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
    art: { tile: PAPER_TILE, card: PAPER_CARD },
    suggests: { chromeFont: 'inter' }, legacyChromeFont: 'inter',
  },
  {
    id: 'notes', nameKey: 'lookNotes', hintKey: 'lookStepNotesHint',
    sheet: 'look-notes', dataLook: 'notes', layout: { menu: 'rail', deepenMetaInk: true }, display: null,
    chromeFace: 'setting', rail: null,
    art: { tile: NOTES_TILE, card: NOTES_CARD },
    suggests: { chromeFont: 'inter' }, legacyChromeFont: 'inter',
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
export function builtinTheme(id: string): SiteTheme {
  return BUILTIN_THEMES.find((theme) => theme.id === id) ?? PLAIN
}

/**
 * The shape of ANY theme id, built in or not: lowercase letters and digits in runs joined by
 * single hyphens, at most 40 characters.
 *
 * Wider than the four on purpose. A blog that installs a theme from a zip on a later build and
 * then comes back to this one must not lose the choice at the next save, so an id of this shape
 * already in the row is read and written back as it is (`content/settings.ts`) and only the
 * renderer falls back, through `resolveTheme`. A WRITE cannot choose one: only a built-in theme
 * can be chosen here (`content/settings-save.ts`). Anything not of this shape (a quote, a space,
 * an object) is not an id and is never kept.
 */
export const isThemeId = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 40 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)

/**
 * The theme the public site is wearing. Anything unrecognised (a row written by a newer build
 * naming a theme this one cannot draw) is drawn as plain, rather than as a half-drawn page.
 */
export function resolveTheme(settings: { theme: string }): SiteTheme {
  return builtinTheme(settings.theme)
}
