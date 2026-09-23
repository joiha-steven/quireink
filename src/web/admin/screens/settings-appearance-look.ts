// Settings → Appearance → "Looks like": the four dialects as DRAWN tiles, not four words.
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
import type { SiteLook, SiteSettings } from '@/types'
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

// --- The four drawings -----------------------------------------------------------------------
// 160 × 96, filled in currentColor: the headline strong, the running lines faint. What separates the four at this size is the same few marks the setup
// step draws: a gutter of numbers, a masthead over columns, a sheet of dotted paper.

const bar = (x: number, y: number, w: number, h = 3, o = 0.35): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="currentColor" fill-opacity="${o}"/>`
// Each run of lines is its own <g>: a drawing is one picture, not a stack of rows, and the
// admin's evenness pass (tour-flows-even.ts) measures any three same-kind siblings stacked in
// a column - a headline bar over five text bars read to it as a list with one wide gap.
const lines = (x: number, y: number, widths: number[], step = 8): string =>
  `<g>${widths.map((w, i) => bar(x, y + i * step, w)).join('')}</g>`

const ART: Record<SiteLook, string> = {
  // The words and nothing else.
  plain: bar(16, 14, 78, 7, 0.8) + lines(16, 32, [128, 128, 128, 128, 84]),
  // Numbers down a gutter, a hairline beside them, the headline in the same heavy mono.
  code: `<g>${[0, 1, 2, 3, 4, 5].map((i) => bar(12, 14 + i * 12, 6, 3, 0.3)).join('')}</g>`
    + `<rect x="24" y="10" width="1" height="74" fill="currentColor" fill-opacity=".25"/>`
    + bar(32, 12, 92, 8, 0.85) + lines(32, 32, [112, 96, 112, 70, 104], 9),
  // A nameplate over a heavy rule, then three columns with a rule in each gutter.
  paper: bar(46, 8, 68, 9, 0.85)
    + `<rect x="12" y="24" width="136" height="2" fill="currentColor" fill-opacity=".8"/>`
    + [12, 60, 108].map((x) => bar(x, 33, 40, 5, 0.7) + lines(x, 44, [40, 40, 40, 28], 7)).join('')
    + [55, 103].map((x) => `<rect x="${x}" y="33" width="1" height="50" fill="currentColor" fill-opacity=".2"/>`).join(''),
  // A sheet lying on a darker desk, dot grid printed on it, a heading underlined by hand.
  notes: `<rect x="0" y="0" width="160" height="96" fill="currentColor" fill-opacity=".08"/>`
    + `<rect x="26" y="9" width="110" height="82" fill="currentColor" fill-opacity=".1"/>`
    + `<rect x="24" y="6" width="110" height="82" fill="Canvas"/>`
    + `<g>${Array.from({ length: 6 }, (_, r) => Array.from({ length: 12 }, (_, c) =>
      `<circle cx="${30 + c * 9}" cy="${12 + r * 13}" r=".75" fill="currentColor" fill-opacity=".25"/>`).join('')).join('')}</g>`
    + bar(34, 16, 58, 7, 0.85) + bar(34, 25, 58, 1.2, 0.85) + lines(34, 38, [88, 88, 64, 88], 9),
}

const art = (look: SiteLook): string =>
  `<svg viewBox="0 0 160 96" class="mb-2 block w-full text-neutral-500 dark:text-neutral-400"`
  + ` aria-hidden="true" focusable="false">${ART[look]}</svg>`

/** The four tiles, two to a row, each saying what it is and who it is for. */
export function lookPicker(t: AdminStrings, s: SiteSettings): string {
  const options: [SiteLook, string, string][] = [
    ['plain', t.lookPlain, t.lookStepPlainHint],
    ['code', t.lookCode, t.lookStepCodeHint],
    ['paper', t.lookPaper, t.lookStepPaperHint],
    ['notes', t.lookNotes, t.lookStepNotesHint],
  ]
  const tiles = options.map(([v, name, hint]) =>
    `<button type="button" data-choice="${escapeAttr(v)}" aria-pressed="${v === s.look}"`
    + ` class="${tileClass(v === s.look, 'flex flex-col p-3 text-left')}">${art(v)}`
    + `<span class="block text-sm font-semibold leading-tight">${escapeHtml(name)}</span>`
    + `<span class="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">${escapeHtml(hint)}</span>`
    + `</button>`).join('')
  return settingRow({
    note: t.lookDesc,
    control: `<div class="grid grid-cols-2 gap-2" data-choice-track data-k="look"`
      + ` data-was="${escapeAttr(s.look)}">${tiles}</div>`,
  })
}
