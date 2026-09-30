// Every Vitesse token colour, as the highlighter is handed it, clears AA on every palette's
// code panel in its own mode (FIXLIST 7.3), and a colour that already did is left alone.
import { describe, expect, it } from 'bun:test'
import light from 'shiki/themes/vitesse-light.mjs'
import dark from 'shiki/themes/vitesse-dark.mjs'
import { FLOOR, codePanels, readable, readableTheme, worstOn } from '@/render/code-ink'

type Theme = { colors?: Record<string, string>; tokenColors?: { settings?: { foreground?: string } }[] }
const inks = (t: Theme): string[] => [
  ...(t.tokenColors ?? []).map((c) => c.settings?.foreground).filter((c): c is string => !!c),
  t.colors?.['editor.foreground'] ?? '',
].filter(Boolean)

describe.each([['light', light], ['dark', dark]] as const)('vitesse-%s', (mode, theme) => {
  it('clears 4.5:1 on the code panel of all six palettes, every token', () => {
    const made = readableTheme(theme as Theme, mode, `vitesse-${mode}`)
    const panels = codePanels(mode)
    const low = inks(made).filter((c) => worstOn(c, panels) < 4.5)
    expect(low).toEqual([])
  })

  it('leaves a colour that already passes exactly as Vitesse wrote it', () => {
    const panels = codePanels(mode)
    for (const c of inks(theme as Theme)) if (worstOn(c, panels) >= FLOOR) expect(readable(c, mode, panels)).toBe(c)
  })
})
