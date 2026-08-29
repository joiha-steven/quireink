// How a table in an article is drawn, and the CSS variables that carry it.
//
// A file of its own for the reason `settings-shape.ts` is one: `settings-sanitize.ts` was at
// 364 of its 400 lines, and the seam is real either way — everything here answers "what does
// a table look like", and all of it turns into custom properties rather than into markup.
//
// WHY A SETTING AT ALL. A table was four declarations: collapse the borders, fill the column,
// box every cell in a hairline, pad it. A `<th>` had no ground, no weight of its own beyond
// the browser's bold, and no rule under it — so a header row was one more row. Nothing here
// could be said in Markdown either, because GFM has no syntax for a tint or a rule, which is
// also why this is ONE SET FOR THE WHOLE BLOG: an attribute carried in the source would make
// the table stop being something anybody can paste in or out.
//
// The numbers below were chosen against a real article of six tables (2026-08-29) — one
// timeline of three short columns, five reference tables of two columns with cells past 150
// characters — and then measured on the rendered page rather than picked by eye.

import type { TableSettings } from '@/types-settings'

const HEADS = ['plain', 'tint', 'rule', 'ink'] as const
const GRIDS = ['all', 'rows', 'none'] as const
const WEIGHTS = ['hairline', 'bold'] as const
const COLUMNS = ['normal', 'strong'] as const
const PADDINGS = ['tight', 'normal', 'roomy'] as const
const NARROWS = ['fit', 'scroll'] as const

/**
 * ⚠️ `head: 'tint'` is the one default in this product that does not reproduce today.
 *
 * Every other settings group shipped defaults that moved nothing on upgrade, and that rule is
 * worth keeping precisely because this is an exception to it: a header row with no ground was
 * the thing being complained about, so a default that preserved it would have shipped the
 * complaint. Owner's call, 2026-08-29. The previous rendering is `plain` + `all`, one click
 * away and named as such in `docs/appearance.md`.
 *
 * Every OTHER field here is today exactly.
 */
export const DEFAULT_TABLE: TableSettings = {
  head: 'tint',
  grid: 'all',
  ruleWeight: 'hairline',
  stripe: false,
  firstColumn: 'normal',
  padding: 'normal',
  narrow: 'fit',
}

export function sanitizeTable(input: unknown, fallback: TableSettings): TableSettings {
  const o = (input ?? {}) as Partial<TableSettings>
  return {
    head: HEADS.find((h) => h === o.head) ?? fallback.head,
    grid: GRIDS.find((g) => g === o.grid) ?? fallback.grid,
    ruleWeight: WEIGHTS.find((w) => w === o.ruleWeight) ?? fallback.ruleWeight,
    stripe: typeof o.stripe === 'boolean' ? o.stripe : fallback.stripe,
    firstColumn: COLUMNS.find((c) => c === o.firstColumn) ?? fallback.firstColumn,
    padding: PADDINGS.find((p) => p === o.padding) ?? fallback.padding,
    narrow: NARROWS.find((n) => n === o.narrow) ?? fallback.narrow,
  }
}

/**
 * Every ground here is MIXED from the palette, never named — and it is the INK that gets
 * mixed into the paper, not the rule.
 *
 * Mixing at all is what survives a theme: eleven palettes and a dark mode, so a grey named
 * here would be a grey that is wrong in ten of them. `--c-code-panel` one file over mixes
 * `--c-rule` into `--c-bg` and that was the first thing tried here — but a rule colour is
 * already almost the paper, so the mix is capped by it. Measured on the default palette:
 * paper rgb(252,252,252), rule rgb(235,235,235), so even 100% of the rule lands 6.7% darker
 * than the page and 35% of it gave rgb(246,246,246) — a contrast ratio of 1.053, which is a
 * band you have to be told is there.
 *
 * `--c-text` has the palette's full range in it, so a small percentage of the ink buys a
 * visible wash and the number means the same thing in every theme: in dark mode the same 6%
 * lifts the band off the page instead of pressing it in, because the ink is the light one
 * there. Tuned by reading the rendered pixels back, not by eye.
 */
const TINT = 'color-mix(in srgb, var(--c-text) 6%, var(--c-bg))'
const STRIPE = 'color-mix(in srgb, var(--c-text) 3%, var(--c-bg))'

/** Ground and ink for each way of marking the header row. */
const HEAD_LOOK: Record<TableSettings['head'], { bg: string; fg: string; rule: string }> = {
  // What a table did before this setting existed: nothing but the browser's bold.
  //
  // `--c-text` and not `--c-heading`, which is what this said first: a `<th>` had no colour
  // of its own and took `--c-text` from `.prose`, and on the default palette those two are
  // #262626 and #121212 — so naming the heading colour here darkened the header ink of every
  // table on every blog while `plain` claimed to change nothing.
  //
  // Nor `inherit`, which is what the fix said next and is worse: a CSS-WIDE KEYWORD is not a
  // value a custom property can hold. `--x: inherit` makes the property inherit ITSELF, which
  // at `:root` is nothing, so it computes to guaranteed-invalid and every reader falls
  // through to the `var()` fallback — which is `--c-heading`, the exact colour being avoided.
  // The string test passed on both wrong answers. The rendered page is what said so.
  plain: { bg: 'transparent', fg: 'var(--c-text)', rule: '1' },
  tint: { bg: TINT, fg: 'var(--c-heading)', rule: '1' },
  // No ground, and the separation carried entirely by a heavier line underneath — the
  // quietest of the four, and the one that suits a table sitting inside running prose.
  rule: { bg: 'transparent', fg: 'var(--c-heading)', rule: '2' },
  // Inverted. `--c-heading` rather than `--c-text` because a solid band wants the darkest
  // ink the palette has, and `--c-bg` on top of it is the only pairing guaranteed to be
  // legible in all eleven palettes: it is the article's own contrast pair, reversed.
  ink: { bg: 'var(--c-heading)', fg: 'var(--c-bg)', rule: '1' },
}

/** Which rules are drawn, as a multiplier on the rule width. Not a weight — a set of lines. */
const GRID_LINES: Record<TableSettings['grid'], { x: string; y: string }> = {
  all: { x: '1', y: '1' },
  rows: { x: '0', y: '1' },
  none: { x: '0', y: '0' },
}

/** `hairline` is 1px, which is the literal the sheet carried before this was a variable. */
const RULE_PX: Record<TableSettings['ruleWeight'], string> = {
  hairline: '1px',
  bold: '2px',
}

/** Multiplies the cell padding, which is already `.4/.6` of `--sp` and so already scales. */
const PAD_SCALE: Record<TableSettings['padding'], string> = {
  tight: '0.7',
  normal: '1',
  roomy: '1.5',
}

/**
 * The table variables, for `:root`.
 *
 * Emitted as numbers-and-lengths rather than as finished declarations so `web/prose.css.ts`
 * keeps every selector. A stylesheet that reads its values from variables can be cached and
 * shipped once; one assembled per site cannot.
 */
export function tableToCss(t: TableSettings): string {
  const head = HEAD_LOOK[t.head]
  const lines = GRID_LINES[t.grid]
  const rule = RULE_PX[t.ruleWeight]
  return ':root{'
    + `--tbl-head-bg:${head.bg}`
    + `;--tbl-head-fg:${head.fg}`
    // The rule under the header is drawn whatever `grid` says: it is the header's own
    // separation and not one of the table's lines. `grid:'none'` with `head:'plain'` is the
    // one combination that leaves a table with no line anywhere, and that is a choice a
    // person made out of two named parts rather than a state this can fall into.
    + `;--tbl-head-rule:calc(${rule} * ${head.rule})`
    + `;--tbl-rule-x:calc(${rule} * ${lines.x})`
    + `;--tbl-rule-y:calc(${rule} * ${lines.y})`
    + `;--tbl-stripe:${t.stripe ? STRIPE : 'transparent'}`
    // `400` and not `inherit`, for the reason spelled out above `plain`: a CSS-wide keyword
    // in a custom property is a property with no value at all. 400 is what a `td` weighs
    // anyway, and a `<strong>` inside the cell keeps its own weight either way.
    + `;--tbl-col1-weight:${t.firstColumn === 'strong' ? '600' : '400'}`
    + `;--tbl-pad:${PAD_SCALE[t.padding]}`
    // A floor, not a width: `0` lets a column compress as far as its text will break, which
    // is what `width:100%` has always done.
    + `;--tbl-min-col:${t.narrow === 'scroll' ? '11rem' : '0'}`
    + '}'
}
