// Turning ONE chosen pigment into the four values the pen actually needs.
//
// The built-in inks are measured off a photograph and hand-tuned per colour (ADR 0018), and
// they stay exactly as they are. This file is for the OTHER case, added 2026-08-24 when the
// pen's colours became a setting: somebody picks one hex, and the
// stroke still has to work on a dark page and still has to have a line version, because a
// 2px underline drawn in a pale highlighter pigment is invisible.
//
// The dark-stroke rule is not invented here. It is read back off the built-ins: green, pink,
// blue and orange are each exactly their light pigment at 45% over the dark page, which is
// the mix ADR 0018 settled on as "the brightest at which all five clear 5.0:1". (Yellow is
// the one exception, warmed by hand so it does not read as the green at dark luminance —
// which is precisely the kind of judgement a formula cannot make and a measured default can
// keep.) The line rules are looser: they land a chosen colour in the right family rather
// than reproducing a hand-picked value, and they only ever apply to a colour somebody chose.

/** The dark page these mixes are computed against — the darkest built-in palette's ground. */
const DARK_PAGE = [14, 14, 14] as const
/** The mix ADR 0018 settled on. Do not raise it: 55% failed AA on three of the five inks. */
const DARK_ALPHA = 0.45

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))

export function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, '')
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

const toHex = (rgb: number[]): string =>
  rgb.map((n) => clamp(n).toString(16).padStart(2, '0')).join('')

/** `over` at `alpha` on top of `under`. */
function mix(over: readonly number[], under: readonly number[], alpha: number): string {
  return toHex(over.map((c, i) => c * alpha + under[i]! * (1 - alpha)))
}

/** The same pigment as it appears pre-mixed into a dark page. */
export function darkStroke(hex: string): string {
  const rgb = parseHex(hex)
  return rgb ? mix(rgb, DARK_PAGE, DARK_ALPHA) : hex.replace(/^#/, '')
}

/**
 * The pigment AS A LINE: same hue, ballpoint strength.
 *
 * A highlighter sweep reads because of its area. A line has none, so the five inks carry
 * separate line values — see `render/pen.ts`. For a chosen colour those are derived: hold
 * the hue, take saturation and lightness to the range the built-in lines occupy.
 */
export function lineInk(hex: string, mode: 'light' | 'dark'): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex.replace(/^#/, '')
  const [h, s] = rgbToHsl(rgb)
  return mode === 'light'
    ? hslToHex(h, Math.max(0.45, Math.min(0.85, s)), 0.36)
    : hslToHex(h, Math.max(0.35, Math.min(0.6, s)), 0.55)
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === rn
    ? ((gn - bn) / d + (gn < bn ? 6 : 0))
    : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return [h * 60, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const t = Math.floor(h / 60) % 6
  const [r, g, b] = ([[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][t] ?? [0, 0, 0])
  return toHex([(r! + m) * 255, (g! + m) * 255, (b! + m) * 255])
}

/** Relative luminance, WCAG's definition. */
function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/**
 * Contrast between two colours, WCAG 2.x.
 *
 * Here so the admin can SAY when a chosen pigment puts the words under it below 4.5:1 —
 * ADR 0018 audited the five built-ins against that number, and a setting that quietly
 * discards the audit is worse than no setting.
 */
export function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a)
  const rb = parseHex(b)
  if (!ra || !rb) return 21
  const [la, lb] = [luminance(ra), luminance(rb)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
