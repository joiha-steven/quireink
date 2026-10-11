// Settings → Appearance → "Theme": the built-in themes as DRAWN tiles, not four words.
//
// It was a segmented strip of four names until 2026-09-23, and a name is the one thing that
// cannot sell a look: "Source code" or "Notebook" says nothing about what a reader will see,
// so the only way to learn was to switch, open the site in another tab, and switch back. The
// first-run step already drew the four (`setup-page.ts`, `lookStepScreen`) with a line under
// each saying who it is for; this is the same answer in the admin's own kit, with the same
// words, so a person who met "Newspaper" at setup finds the same card here.
//
// The drawings are inline SVG in `currentColor` rather than the setup screen's CSS parts: that
// screen has its own sheet (`login.css.ts`), and the admin takes classes from its utilities and
// nothing else (`check:admin-css`). A drawing needs no class at all.
//
// THE PROTOCOL IS THE STRIP'S: `data-choice-track` / `data-choice` / `aria-pressed`, so the
// island's `pickChoice` moves it and the form's diff reads it with no new code — the reading-
// font grid on this same tab is the precedent, and the tile skin is shared with it.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteSettings } from '@/types'
import { BUILTIN_THEMES, isBuiltinThemeId, type SiteTheme } from '@/content/themes-builtin'
import { escapeAttr, escapeHtml } from '@/utils'
import { settingRow } from '@/web/admin/fields'

/**
 * A key pressed into the card, wearing its own specimen. A solid ink tile can show neither
 * relief nor the thing it is selling, so the chosen one is sunk rather than filled.
 */
const TILE_BASE = 'rounded-lg border transition-colors'
const TILE_ON = 'border-neutral-400 bg-neutral-200 font-semibold text-neutral-950'
  + ' shadow-[inset_0_2px_3px_rgba(0,0,0,.18)] dark:border-neutral-500 dark:bg-neutral-950'
  + ' dark:text-white dark:shadow-[inset_0_2px_3px_rgba(0,0,0,.6)]'
const TILE_OFF = 'border-neutral-300 text-neutral-700 hover:border-neutral-500'
  + ' dark:border-neutral-700 dark:text-neutral-300'

/** The classes of one tile, pressed or not. The font grids on this tab wear the same skin. */
export const tileClass = (on: boolean, cls: string): string =>
  `${TILE_BASE} ${cls} ${on ? TILE_ON : TILE_OFF}`

/**
 * Both faces of a tile as `data-on` / `data-off`, which is what the island's `pressKey` swaps.
 * Without them a click moved `aria-pressed` and nothing else: the old tile stayed sunken and
 * the new one showed only its focus outline, so nobody could tell what they had picked.
 */
export const tileFaces = (cls: string): string =>
  ` data-on="${escapeAttr(tileClass(true, cls))}" data-off="${escapeAttr(tileClass(false, cls))}"`

// The drawing on each tile is the theme's own (`art.tile` in `content/themes-builtin.ts`),
// wrapped here in the admin's svg.
const art = (tile: string): string =>
  `<svg viewBox="0 0 160 96" class="mb-2 block w-full text-neutral-500 dark:text-neutral-400"`
  + ` aria-hidden="true" focusable="false">${tile}</svg>`

/**
 * What pressing the tile moves on the rest of the form, as setting key to value: the island
 * reads it (`applySuggests` in `admin/island/lib/settings-controls.ts`) and holds no table of
 * its own. Only the chrome font today: a reading font drags its tuned type sizes along through
 * its own tile's handler, which a moved choice would skip. Written on every tile, `{}` on one
 * that suggests nothing, because pressing that tile is still what puts back a font the
 * previous tile moved.
 */
const suggestsAttr = (suggests: SiteTheme['suggests']): string =>
  ` data-suggests="${escapeAttr(JSON.stringify(suggests.chromeFont ? { chromeFont: suggests.chromeFont } : {}))}"`

/**
 * The settings keys the theme draws itself, which the island reads to hide those controls
 * while the tile is the pressed one (`applyOwned` in `admin/island/lib/settings-controls.ts`).
 * Written on every tile, `[]` on one that owns none.
 */
const ownsAttr = (owns: readonly string[], name: string): string =>
  ` data-owns="${escapeAttr(JSON.stringify(owns))}" data-name="${escapeAttr(name)}"`

/** One tile per built-in theme, two to a row, each saying what it is and who it is for. */
export function lookPicker(t: AdminStrings, s: SiteSettings): string {
  const tiles = BUILTIN_THEMES.map(({ id, nameKey, hintKey, art: { tile }, suggests, ownsSettings }) =>
    `<button type="button" data-choice="${escapeAttr(id)}" aria-pressed="${id === s.theme}"`
    + suggestsAttr(suggests) + ownsAttr(ownsSettings, t[nameKey])
    + `${tileFaces('flex flex-col p-3 text-left')} class="${tileClass(id === s.theme, 'flex flex-col p-3 text-left')}">${art(tile)}`
    + `<span class="block text-sm font-semibold leading-tight">${escapeHtml(t[nameKey])}</span>`
    + `<span class="mt-1 block text-xs font-normal text-neutral-600 dark:text-neutral-300">${escapeHtml(t[hintKey])}</span>`
    + `</button>`).join('')
  return settingRow({
    note: t.lookDesc,
    control: `<div class="grid grid-cols-2 gap-2" data-choice-track data-k="theme"`
      // '' when the stored theme is not one of these tiles (kept from a later build): then no
      // tile is pressed, and a baseline of the id would read as an unsaved change on opening.
      + ` data-was="${escapeAttr(isBuiltinThemeId(s.theme) ? s.theme : '')}">${tiles}</div>`,
  })
}
