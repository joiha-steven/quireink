// How a table is drawn, and the one default in this product that deliberately does NOT
// reproduce what a blog looked like before the setting existed.
//
// `shape-defaults.test.ts` next door exists to prove an upgrade moves nothing. This file is
// the mirror image and has to be read as such: `head: 'tint'` is a chosen change, so the test
// PINS the change rather than pinning the absence of one — and pins, just as hard, that the
// old rendering is still reachable and that every other field in the group is today exactly.
//
// The rest is the seam that made the setting cheap: `prose.css.ts` keeps every selector and
// reads values out of variables, so a blog gets one cached stylesheet and a `:root` block.
// If those two ever stop agreeing on a variable name the table silently falls back to this
// file's own defaults and nothing else fails, which is why the names are asserted in pairs.

import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { pageStyles } from '@/web/layout'
import { PROSE_CSS } from '@/web/prose.css'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { DEFAULT_TABLE, sanitizeTable, tableToCss } from '@/content/settings-table'
import type { SiteSettings } from '@/types'
import type { TableSettings } from '@/types-settings'

const DIR = './.tmp/test-table'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const withTable = (over: Partial<TableSettings>): SiteSettings =>
  ({ ...DEFAULT_SETTINGS, table: { ...DEFAULT_TABLE, ...over } })

/** Every variable the sheet reads. A name in one list and not the other is the whole bug. */
const VARS = [
  '--tbl-head-bg', '--tbl-head-fg', '--tbl-head-rule',
  '--tbl-rule-x', '--tbl-rule-y', '--tbl-stripe',
  '--tbl-col1-weight', '--tbl-pad', '--tbl-min-col',
]

describe('the table defaults', () => {
  it('tints the header, and that is the deliberate exception', () => {
    expect(DEFAULT_TABLE.head).toBe('tint')
    const css = tableToCss(DEFAULT_TABLE)
    expect(css).toContain('--tbl-head-bg:color-mix(')
    // Mixed from the INK, not from the rule. A rule colour is already almost the paper, so
    // mixing from it caps the band at 1.053 against the page — measured, and the reason this
    // reads `--c-text`. A change back to `--c-rule` is a change nobody would see in review.
    expect(css).toContain('var(--c-text)')
  })

  it('is today exactly in every OTHER field', () => {
    expect(DEFAULT_TABLE.grid).toBe('all')
    expect(DEFAULT_TABLE.ruleWeight).toBe('hairline')
    expect(DEFAULT_TABLE.stripe).toBe(false)
    expect(DEFAULT_TABLE.firstColumn).toBe('normal')
    expect(DEFAULT_TABLE.padding).toBe('normal')
    expect(DEFAULT_TABLE.narrow).toBe('fit')
    const css = tableToCss(DEFAULT_TABLE)
    // A hairline on all four sides, no banding, no weight of its own, no floor.
    expect(css).toContain('--tbl-rule-x:calc(1px * 1)')
    expect(css).toContain('--tbl-rule-y:calc(1px * 1)')
    expect(css).toContain('--tbl-stripe:transparent')
    expect(css).toContain('--tbl-col1-weight:400')
    expect(css).toContain('--tbl-pad:1')
    expect(css).toContain('--tbl-min-col:0')
  })

  it('can be put back to exactly what a table used to look like', () => {
    // The two settings `docs/appearance.md` promises will restore the old rendering. If this
    // fails, that promise is now false and the doc has to change with it.
    const css = tableToCss({ ...DEFAULT_TABLE, head: 'plain', grid: 'all' })
    expect(css).toContain('--tbl-head-bg:transparent')
    expect(css).toContain('--tbl-rule-x:calc(1px * 1)')
    expect(css).toContain('--tbl-rule-y:calc(1px * 1)')
    // The INK too, and it took two wrong answers to get here. `--c-heading` darkened every
    // header on every blog from #262626 to #121212 while the option claimed to change
    // nothing; `inherit` then looked right and was worse (see the rule below).
    expect(css).toContain('--tbl-head-fg:var(--c-text)')
  })
})

describe('the knobs', () => {
  it('draws a different SET of lines per grid, not a different weight', () => {
    expect(tableToCss(withTable({ grid: 'rows' }).table)).toContain('--tbl-rule-x:calc(1px * 0)')
    expect(tableToCss(withTable({ grid: 'rows' }).table)).toContain('--tbl-rule-y:calc(1px * 1)')
    const none = tableToCss(withTable({ grid: 'none' }).table)
    expect(none).toContain('--tbl-rule-x:calc(1px * 0)')
    expect(none).toContain('--tbl-rule-y:calc(1px * 0)')
  })

  it('keeps the header rule when the grid is off, because it is not one of the grid lines', () => {
    // The one combination that could leave a table with no line anywhere is `grid: none` with
    // `head: plain`, and that has to be two choices a person made rather than a state the
    // settings fall into on their own.
    expect(tableToCss(withTable({ grid: 'none' }).table)).toContain('--tbl-head-rule:calc(1px * 1)')
    expect(tableToCss(withTable({ grid: 'none', head: 'rule' }).table))
      .toContain('--tbl-head-rule:calc(1px * 2)')
  })

  it('scales the rule weight and the padding rather than restating them', () => {
    expect(tableToCss(withTable({ ruleWeight: 'bold' }).table)).toContain('--tbl-rule-y:calc(2px * 1)')
    expect(tableToCss(withTable({ padding: 'tight' }).table)).toContain('--tbl-pad:0.7')
    expect(tableToCss(withTable({ padding: 'roomy' }).table)).toContain('--tbl-pad:1.5')
  })

  it('inverts the header with the palette pair and nothing else', () => {
    const css = tableToCss(withTable({ head: 'ink' }).table)
    expect(css).toContain('--tbl-head-bg:var(--c-heading)')
    expect(css).toContain('--tbl-head-fg:var(--c-bg)')
  })

  it('gives a cell a floor only when asked to scroll', () => {
    expect(tableToCss(withTable({ narrow: 'scroll' }).table)).toContain('--tbl-min-col:11rem')
    expect(tableToCss(withTable({ narrow: 'fit' }).table)).toContain('--tbl-min-col:0')
  })
})

describe('the sheet and the settings agree', () => {
  it('emits every variable the stylesheet reads, and reads every one it emits', () => {
    const css = tableToCss(DEFAULT_TABLE)
    for (const v of VARS) {
      expect(css.includes(`${v}:`)).toBe(true)
      expect(PROSE_CSS.includes(`var(${v}`)).toBe(true)
    }
  })

  it('gives every var() in the sheet a fallback, so a page renders before the block arrives', () => {
    // `pageStyles` injects the :root block, but the cached sheet is served on its own and has
    // to stand up alone. A bare `var(--tbl-*)` with no comma is a table with no border.
    for (const v of VARS) {
      const at = PROSE_CSS.indexOf(`var(${v}`)
      if (at === -1) continue
      expect(PROSE_CSS.slice(at, at + 60)).toContain(',')
    }
  })

  it('never puts a CSS-WIDE KEYWORD in a custom property', () => {
    // `--x: inherit` does not mean "inherit this value". It applies the keyword to the custom
    // property, which at `:root` inherits nothing, so the property is guaranteed-invalid and
    // every `var(--x, fallback)` silently takes the fallback. Both `--tbl-head-fg` and
    // `--tbl-col1-weight` shipped that way in draft and both string tests passed.
    const keyword = /:(inherit|initial|unset|revert|revert-layer)\b/
    for (const head of ['plain', 'tint', 'rule', 'ink'] as const) {
      for (const firstColumn of ['normal', 'strong'] as const) {
        expect(tableToCss({ ...DEFAULT_TABLE, head, firstColumn })).not.toMatch(keyword)
      }
    }
  })

  it('names no colour of its own — the grounds are mixed from the palette', () => {
    for (const head of ['plain', 'tint', 'rule', 'ink'] as const) {
      const css = tableToCss({ ...DEFAULT_TABLE, head, stripe: true })
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      expect(css).not.toMatch(/\brgb|\bhsl/i)
    }
  })
})

describe('the page carries it', () => {
  it('puts the table block in the injected styles', async () => {
    const css = await pageStyles(withTable({ head: 'ink', stripe: true }))
    expect(css).toContain('--tbl-head-bg:var(--c-heading)')
    expect(css).toContain('--tbl-stripe:color-mix(')
  })
})

describe('sanitizeTable', () => {
  it('keeps the fallback for anything it does not recognise', () => {
    const out = sanitizeTable(
      { head: 'rainbow', grid: 7, ruleWeight: null, stripe: 'yes', firstColumn: {}, padding: '', narrow: [] },
      DEFAULT_TABLE,
    )
    expect(out).toEqual(DEFAULT_TABLE)
  })

  it('takes a full valid object, and a partial one field at a time', () => {
    const all: TableSettings = {
      head: 'ink', grid: 'none', ruleWeight: 'bold', stripe: true,
      firstColumn: 'strong', padding: 'roomy', narrow: 'scroll',
    }
    expect(sanitizeTable(all, DEFAULT_TABLE)).toEqual(all)
    expect(sanitizeTable({ stripe: true }, DEFAULT_TABLE).stripe).toBe(true)
    expect(sanitizeTable({ stripe: true }, DEFAULT_TABLE).head).toBe(DEFAULT_TABLE.head)
  })

  it('survives null and undefined, which is what a settings row written before it looks like', () => {
    expect(sanitizeTable(undefined, DEFAULT_TABLE)).toEqual(DEFAULT_TABLE)
    expect(sanitizeTable(null, DEFAULT_TABLE)).toEqual(DEFAULT_TABLE)
  })
})
