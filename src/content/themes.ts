// Built-in palettes (6 tokens × light+dark, emitted by `themesToCss`). All live in
// `settings.themes` (id -> ThemeSettings), each owner-customizable; `themePreset`
// names the visitor default; a reader switches with the header control in
// `assets/js/theme.ts` (`palette()`), which renders only above two enabled. `name` is the English
// fallback — the displayed name is localized via `paletteNames`, keyed by id.

import type { ThemeColors, ThemeSettings } from '@/types'

// The palettes' colour VALUES live in `palettes.ts` (split 2026-08-11, by reader — see its
// header). Re-exported here so every existing importer of `themes.ts` is unaffected.
import { THEME_PRESETS } from '@/content/palettes'
export { THEME_PRESETS }

export type ThemePreset = {
  id: string
  name: string
  theme: ThemeSettings
}


// The FONT half lives in `content/fonts.ts` (split 2026-08-15 — see its header). Re-exported
// here so every existing importer of `themes.ts` is unaffected, exactly as `palettes.ts` is
// above. The import is one-way: `fonts.ts` never reads this file.
export {
  TYPE_ROLES, FONT_WEIGHTS, DEFAULT_TYPOGRAPHY, DEFAULT_FONT, fontPreloadHrefs,
  FONT_PRESETS, DEFAULT_FONT_PRESET, getFontPreset, isFontPresetId, fontPresetCss,
  CHROME_FONTS, DEFAULT_CHROME_FONT, getChromeFont, isChromeFontId, chromeFontCss,
} from '@/content/fonts'
export type { FontPreset, ChromeFont } from '@/content/fonts'


export const DEFAULT_PRESET_ID = 'mono'

// The default palette every fresh install starts from (also the globals.css fallback). Read
// off the presets rather than re-naming `MONO`, which is private to `palettes.ts`: one
// definition of "the first palette is the default", not two that can disagree.
export const DEFAULT_THEME: ThemeSettings = THEME_PRESETS[0]!.theme

// Look up a preset by id, falling back to the default. Always returns a value.
export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0]
}

/**
 * The three answers to "what does a first-time visitor open in".
 *
 * 'system' is the default and follows the reader's OS; the other two state a house style,
 * which is why the setting exists — a blog can BE a dark blog or a light one, and before
 * this it could only be whatever each visitor's laptop happened to be set to. A reader's
 * own pick still wins over any of them: this decides the FIRST paint, not the reader's.
 */
export const SCHEMES = ['system', 'light', 'dark'] as const
export type SchemeDefault = (typeof SCHEMES)[number]
export function isScheme(v: unknown): v is SchemeDefault {
  return typeof v === 'string' && (SCHEMES as readonly string[]).includes(v)
}

export function isPresetId(id: unknown): id is string {
  return typeof id === 'string' && THEME_PRESETS.some((p) => p.id === id)
}

// Deep clone a palette so editing one mode never mutates a shared preset object.
export function cloneTheme(t: ThemeSettings): ThemeSettings {
  const copy = (c: ThemeColors): ThemeColors => ({ ...c })
  return { light: copy(t.light), dark: copy(t.dark) }
}

// A fresh id -> palette map seeded from the built-ins (the owner can then
// customize any of them). Cloned so edits never touch the preset constants.
export function defaultThemes(): Record<string, ThemeSettings> {
  const out: Record<string, ThemeSettings> = {}
  for (const p of THEME_PRESETS) out[p.id] = cloneTheme(p.theme)
  return out
}

// The palette a visitor sees by default (owner's `themePreset`), falling back to
// the first preset. Always returns a usable ThemeSettings.
export function getDefaultTheme(themes: Record<string, ThemeSettings>, defaultId: string): ThemeSettings {
  return themes[defaultId] ?? themes[DEFAULT_PRESET_ID] ?? THEME_PRESETS[0].theme
}

// Every built-in palette id, in display order. The default "everything on" set.
export const ALL_PALETTE_IDS: string[] = THEME_PRESETS.map((p) => p.id)

function vars(c: ThemeColors): string {
  return `--c-bg:${c.bg};--c-text:${c.text};--c-heading:${c.heading};--c-meta:${c.meta};--c-link:${c.link};--c-accent:${c.accent};--c-rule:${c.rule}`
}

// CSS for every ENABLED palette, so the switcher swaps instantly via `<html data-palette>`
// with nothing to fetch. The default also lands on :root/.dark as the no-JS baseline;
// mode-qualified `[data-palette].dark` has higher specificity so dark resolves correctly.
//
// DARK BEFORE THE ISLAND SPEAKS. `.dark` is applied by `assets/js/theme.ts`, a deferred
// module, so a reader whose system is dark on the default `system` mode was shown a white
// page for one paint on every navigation — measured: 0 `prefers-color-scheme` rules in 429.
//
// ⚠️ `data-scheme`, NOT `data-theme`: `<body data-theme>` already exists and holds the
// translated word "Theme" for the island's button label. Two same-named attributes on parent
// and child, one a sentence and one a mode, is a mix-up waiting to happen.
//
// The handoff is `data-scheme` on `<html>`. Nothing server-rendered sets it — the page cache
// is keyed by URL alone (Invariant 1), so a server-rendered mode would be the first visitor's
// mode for everyone — the island sets it to the RESOLVED light/dark the moment it runs, and
// this block applies only while it is absent.
//
// The honest cost: a reader who explicitly chose LIGHT on a dark system now gets the inverse
// flash, for as long as the dark reader used to get theirs. `system` is the default and by far
// the common case, so this moves the flash off the many onto the few. Removing it entirely
// needs an inline script, which this project asserts it does not have.
//
// `color-scheme` rides along: it is what makes the scrollbar, the form controls and the canvas
// follow the page instead of staying light under a dark one.
//
// NOT mirrored per palette, and that is settled rather than deferred: before the island runs
// there is no `data-palette` at all, so the only palette this block could be about is the
// owner's default — which `base` already carries. After it runs, this whole block drops out of
// the cascade. Real cost, zero benefit.
export function themesToCss(
  themes: Record<string, ThemeSettings>,
  defaultId: string,
  enabled?: string[],
  defaultScheme: SchemeDefault = 'system',
): string {
  const base = getDefaultTheme(themes, defaultId)
  let css = `:root{color-scheme:light;${vars(base.light)}}.dark{color-scheme:dark;${vars(base.dark)}}`
  const reachable = enabled === undefined
    ? Object.keys(themes)
    : enabled.length < 2 ? [] : enabled.filter((id) => id in themes)
  for (const id of reachable) {
    const t = themes[id]
    if (t === undefined) continue
    css += `[data-palette="${id}"]{${vars(t.light)}}[data-palette="${id}"].dark{${vars(t.dark)}}`
  }
  // `:root:not([data-scheme])` is 0,2,0 — above both `:root` and `[data-palette="…"]`, and
  // never in a fight with `.dark`, which only exists once `data-scheme` does.
  //
  // WHICH first paint depends on the owner's `defaultScheme`, and the mechanism is the same
  // in all three cases: a rule that applies only until the island writes `data-scheme`.
  //   'system' — the media query, as before: follow the visitor's OS.
  //   'dark'   — unconditional: the blog IS dark, so every first-time visitor opens dark
  //              whatever their laptop is set to.
  //   'light'  — nothing to emit. `:root` already carries the light palette, and adding a
  //              rule would only be a louder way to say the same thing.
  // A reader who has chosen for themselves is unaffected in every case: their choice is in
  // localStorage, the island writes `data-scheme` from it, and every rule here stops
  // matching the moment that attribute exists.
  if (defaultScheme === 'system') {
    css += `@media (prefers-color-scheme:dark){:root:not([data-scheme]){color-scheme:dark;${vars(base.dark)}}}`
  } else if (defaultScheme === 'dark') {
    css += `:root:not([data-scheme]){color-scheme:dark;${vars(base.dark)}}`
  }
  return css
}
