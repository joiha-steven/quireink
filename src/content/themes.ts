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
// with nothing to fetch. It emitted all six until 2026-08-11, including on blogs that had
// turned five off — see `themesToCss`.
// Default also lands on :root/.dark (no-JS baseline); mode-qualified
// `[data-palette].dark` has higher specificity so dark resolves correctly.
//
// DARK BEFORE THE ISLAND SPEAKS. `.dark` is applied by `assets/js/theme.ts`, which is a
// deferred module — so a reader whose system is dark, on the default `system` mode, was
// shown a white page for the length of one paint on every single navigation. There was no
// `prefers-color-scheme` rule anywhere in the public sheet: measured at 0 of 429 rules.
//
// `data-scheme`, NOT `data-theme`: `<body data-theme="…">` already exists and holds the
// translated word "Theme" for the island's button label (`assets/js/dom.ts` reads every UI
// string off `body.dataset`). Two attributes of the same name on parent and child, one a
// sentence and one a mode, is a mix-up waiting to be made.
//
// The handoff is `data-scheme` on `<html>`. Nothing server-rendered sets it (the page cache is
// keyed by URL alone, Invariant 1, so a server-rendered mode would be the first visitor's
// mode for everyone), the island sets it to the RESOLVED light/dark the moment it runs, and
// this block applies only while it is absent. So: no script, correct first paint for the
// system-dark reader, and the island still owns every explicit choice.
//
// The honest cost, because there is one: a reader who explicitly chose LIGHT on a dark system
// now gets the inverse flash, for exactly as long as the dark reader used to get theirs.
// `system` is the default and by far the common case, so this moves the flash off the many
// and onto the few. Removing it entirely needs an inline script, which this project does not
// have anywhere and asserts it does not.
//
// `color-scheme` rides along: it is what makes the scrollbar, the form controls and the
// canvas the browser draws follow the page instead of staying light under a dark one.
//
// NOT mirrored per palette, and with the switcher now ported (2026-08-11) that is settled
// rather than deferred. It cannot help. Before the island runs there is no `data-palette` at
// all — the reader's choice is in their own localStorage and the page cache is keyed by URL, so
// the server cannot know it — which means the only palette this block could possibly be about
// is the owner's default, and that is exactly the one `base` already carries.
//
// After the island runs, `data-scheme` exists, this whole block drops out of the cascade, and
// `[data-palette="…"].dark` answers instead. So the cost of mirroring is real and the benefit is
// zero. What remains is one frame of the DEFAULT palette for a reader who chose another and is
// on a dark machine — the same accepted flash the theme control has, for the same reason: no
// inline script.
/**
 * `enabled` is `settings.enabledPalettes`: the palettes a reader may switch between, which is
 * the only set worth emitting rules for.
 *
 * It used to emit all six unconditionally — twelve rule sets, ~2 KB on every page — because
 * `settings.themes` always holds all six so that each is customisable in the admin. Whether a
 * palette is CUSTOMISABLE and whether a reader can REACH it are different questions, and this
 * answered the wrong one. A blog with one palette enabled paid for five it had turned off.
 *
 * Fewer than two enabled means no switcher (the control hides itself), so `:root` already IS
 * the palette and no `[data-palette]` block can ever match: emit none. Two or more emits one
 * per enabled palette, INCLUDING the default — a reader who switches away and back sets
 * `data-palette` to the default's own id, so it needs a rule of its own to return to.
 *
 * Omitting `enabled` keeps every palette, which is what the admin shell wants: its preview
 * renders whatever the owner is editing, enabled or not.
 */
export function themesToCss(
  themes: Record<string, ThemeSettings>,
  defaultId: string,
  enabled?: string[],
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
  css += `@media (prefers-color-scheme:dark){:root:not([data-scheme]){color-scheme:dark;${vars(base.dark)}}}`
  return css
}
