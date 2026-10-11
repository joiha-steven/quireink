// A theme that draws tables itself owns some of the table knobs, and the saved value of a knob
// the theme owns must not reach the page.
//
// The measured failure: the Newspaper sheet forces the header ground to transparent, while the
// Inverted header sets its ink to the page colour (`--c-bg`). On the Newspaper that is
// paper-coloured words on paper, so every header cell was blank. The saved choice is kept in
// the settings row (the owner gets it back on another theme); it is only not emitted.

import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { pageStyles } from '@/web/layout'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { DEFAULT_TABLE, tableToCss } from '@/content/settings-table'
import { builtinTheme } from '@/content/themes-builtin'
import type { SiteSettings } from '@/types'
import type { TableSettings } from '@/types-settings'

const DIR = './.tmp/test-table-owned'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const on = (theme: string, table: Partial<TableSettings>): SiteSettings =>
  ({ ...DEFAULT_SETTINGS, theme, look: builtinTheme(theme).id, table: { ...DEFAULT_TABLE, ...table } })

const INVERTED = { head: 'ink', grid: 'none', ruleWeight: 'bold' } as const

describe('table knobs a theme owns', () => {
  it('the Newspaper owns the header row, the lines and the line weight, and nothing else', () => {
    expect([...builtinTheme('paper').ownsSettings].sort())
      .toEqual(['table.grid', 'table.head', 'table.ruleWeight'])
    for (const id of ['plain', 'code', 'notes']) expect(builtinTheme(id).ownsSettings).toEqual([])
  })

  it('does not paint paper-coloured header words on the Newspaper, whatever is saved', async () => {
    const css = await pageStyles(on('paper', INVERTED))
    expect(css).not.toContain('--tbl-head-fg:var(--c-bg)')
    expect(css).not.toContain('--tbl-head-bg:var(--c-heading)')
    // What the page gets instead is the defaults for the owned knobs.
    expect(css).toContain(tableToCss(DEFAULT_TABLE))
  })

  it('still applies the knobs the theme does not own, on the Newspaper', async () => {
    const css = await pageStyles(on('paper', { ...INVERTED, padding: 'roomy', stripe: true, narrow: 'scroll' }))
    expect(css).toContain('--tbl-pad:1.5')
    expect(css).toContain('--tbl-min-col:11rem')
    expect(css).toContain('--tbl-stripe:color-mix(')
  })

  it('applies the saved choice on a theme that owns none', async () => {
    const css = await pageStyles(on('plain', INVERTED))
    expect(css).toContain('--tbl-head-fg:var(--c-bg)')
    expect(css).toContain('--tbl-rule-y:calc(2px * 0)')
  })

  it('leaves the saved row alone: the settings object is not changed by drawing it', async () => {
    const s = on('paper', INVERTED)
    await pageStyles(s)
    expect(s.table).toEqual({ ...DEFAULT_TABLE, ...INVERTED })
  })

  it('tableToCss ignores the owned keys it is given and reads the rest', () => {
    const css = tableToCss({ ...DEFAULT_TABLE, ...INVERTED, padding: 'tight' }, ['table.head', 'table.grid'])
    expect(css).toContain('--tbl-head-fg:var(--c-heading)')
    expect(css).toContain('--tbl-rule-x:calc(2px * 1)')
    expect(css).toContain('--tbl-pad:0.7')
  })
})

describe('the ownable list', () => {
  it('names only keys the admin draws a hideable control for, and the built-ins stay inside it', async () => {
    const { OWNABLE_SETTINGS, BUILTIN_THEMES } = await import('@/content/themes-builtin')
    const src = await Bun.file(new URL('./admin/screens/settings-post.ts', import.meta.url)).text()
    for (const key of OWNABLE_SETTINGS) expect(src).toContain(`ownable(t, '${key}'`)
    for (const theme of BUILTIN_THEMES) for (const key of theme.ownsSettings) expect(OWNABLE_SETTINGS).toContain(key)
  })
})
