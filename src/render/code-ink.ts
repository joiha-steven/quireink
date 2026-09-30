// CODE TOKENS A READER CAN READ, on every palette, in both modes (2026-09-30, FIXLIST 7.3).
//
// Vitesse is muted by design, and on this site's code panel (`--c-code-panel`, the palette's
// rule mixed 20% into its ground) five of its seven common light colours sat under WCAG AA:
// punctuation #999 at 2.66:1, strings at 3.82, quote marks at 1.76. Measured on all six
// palettes, 21 light colours and 7 dark ones fail somewhere.
//
// So the highlighter is handed Vitesse with each failing colour moved — towards black in light,
// towards white in dark — by the smallest step that clears 4.5:1 against the WORST panel of all
// six palettes. A colour that already passes is left byte for byte as Vitesse wrote it, so the
// look stays Vitesse and the diff in the golden corpus is only the colours that had to move.
// A translucent colour is made solid: its faded look was the fault.
import { THEME_PRESETS } from '@/content/palettes'

type Rgb = [number, number, number]
export type Mode = 'light' | 'dark'

const rgbOf = (hex: string): Rgb => {
  let h = hex.replace('#', '')
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
}
const alphaOf = (hex: string): number => {
  const h = hex.replace('#', '')
  if (h.length === 8) return parseInt(h.slice(6), 16) / 255
  if (h.length === 4) return parseInt(h[3]! + h[3]!, 16) / 255
  return 1
}
const mix = (a: Rgb, b: Rgb, p: number): Rgb => a.map((v, i) => v * p + b[i]! * (1 - p)) as Rgb
const hexOf = (c: Rgb): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`
const lum = (c: Rgb): number => {
  const f = (v: number): number => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
export const contrast = (a: Rgb, b: Rgb): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

/** The code panel of every preset palette in one mode: `--c-rule` 20% into `--c-bg`. */
export const codePanels = (mode: Mode): Rgb[] =>
  THEME_PRESETS.map((p) => mix(rgbOf(p.theme[mode].rule), rgbOf(p.theme[mode].bg), 0.2))

/** A little over AA, so rounding to a byte cannot land a colour at 4.49. */
export const FLOOR = 4.6

/** The worst contrast a colour, drawn as written (alpha included), makes on any panel. */
export function worstOn(color: string, panels: Rgb[]): number {
  const c = rgbOf(color)
  const a = alphaOf(color)
  return Math.min(...panels.map((p) => contrast(mix(c, p, a), p)))
}

/** The colour as written if it clears the floor, else the nearest solid colour that does. */
export function readable(color: string, mode: Mode, panels: Rgb[] = codePanels(mode)): string {
  if (worstOn(color, panels) >= FLOOR) return color
  const to: Rgb = mode === 'light' ? [0, 0, 0] : [255, 255, 255]
  const from = rgbOf(color)
  for (let step = 1; step <= 50; step++) {
    const next = hexOf(mix(to, from, step / 50))
    if (worstOn(next, panels) >= FLOOR) return next
  }
  return hexOf(to)
}

type ThemeJson = {
  name?: string
  colors?: Record<string, string>
  tokenColors?: { settings?: { foreground?: string } }[]
}

/** Vitesse with every token colour made readable; renamed, so its cache key is its own. */
export function readableTheme<T extends ThemeJson>(theme: T, mode: Mode, name: string): T {
  const panels = codePanels(mode)
  const fix = (c: string): string => readable(c, mode, panels)
  return {
    ...theme,
    name,
    colors: theme.colors?.['editor.foreground']
      ? { ...theme.colors, 'editor.foreground': fix(theme.colors['editor.foreground']) }
      : theme.colors,
    tokenColors: theme.tokenColors?.map((tc) => tc.settings?.foreground
      ? { ...tc, settings: { ...tc.settings, foreground: fix(tc.settings.foreground) } }
      : tc),
  } as T
}
