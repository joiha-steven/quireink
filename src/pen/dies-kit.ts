// The toolkit every die generator shares: the PRNG, the number formatters, the wavy run,
// and the shape of a die — including the physics a die can ask the stamp to apply.
//
// Import-free, so `dies-highlight.ts`, `dies-lines.ts` and `dies-link.ts` can each grow
// their dies from a seed of their own. That separation is load-bearing: when every gesture
// drew from ONE stream, adding a gesture had to be appended at the end of the file or it
// reshuffled every stroke before it — and the order of two modules sharing a stream would
// have depended on ESM evaluation order. A seed per gesture cannot do that.

/** One printable path: SVG path data, its opacity, and how the stamp should ink it. */
export type DiePath = readonly [d: string, opacity: string, mode?: PathMode]

/**
 * How a path is inked.
 *   'p'  plain: the pigment at the path's opacity, no physics.
 *   'f'  filtered: through the die's felt — fibre grain and edge tremor (`Fx`).
 *   'w'  filtered AND wet-to-dry: the fill is the die's gradient, so the path is darker
 *        where the pen landed and paler where the felt ran dry.
 */
export type PathMode = 'p' | 'f' | 'w'

/**
 * The physics of a die, applied by the stamp (`pigments.ts` › `penUrl`) as an SVG filter
 * and a gradient inside the data-URI. All optional: a die with no `fx` stamps exactly as the
 * first pen did.
 */
export type Fx = {
  /** Seeds the noise. Per die, so two dies never share a fibre pattern. */
  seed: number
  /**
   * Felt grain: fractal noise turned into an alpha mask. `[fx, fy, gain, bias]` — the two
   * base frequencies (low along the stroke, high across it, which is what makes fibres
   * rather than clouds) and the alpha transfer `alpha = gain × noise + bias`, clamped. A
   * bias low enough to reach zero is what leaves the dry lanes.
   */
  grain?: readonly [fx: number, fy: number, gain: number, bias: number]
  /** Edge tremor: turbulence displacing the outline. `[baseFrequency, scale]`. */
  tremor?: readonly [freq: number, scale: number]
  /**
   * Wet to dry along the stroke, as a horizontal gradient of opacity. `dir` 0 runs
   * left→right (the pen landed on the left), 1 the other way; `from` is where the fade
   * begins (0..1); the three opacities are at the start, at `from`, and at the end.
   */
  wet?: readonly [dir: 0 | 1, from: number, o0: number, o1: number, o2: number]
}

export type Die = { readonly paths: ReadonlyArray<DiePath>; readonly fx?: Fx }

/* mulberry32. Not for anything but repeatable scribble; every generator seeds it with a
   constant so the sheet is byte-stable across builds (`Date.now`/`Math.random` are banned
   here anyway). */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const r1 = (n: number) => Math.round(n * 10) / 10
export const o2 = (n: number) => String(Math.round(n * 100) / 100).replace(/^0/, '')
export const e2 = (n: number) => `${Math.round(n * 100) / 100}em`.replace(/^(-?)0/, '$1')

/** `lerp` bound to one PRNG: a random number in [a, b). */
export const spanOf = (r: () => number) => (a: number, b: number) => a + (b - a) * r()

/**
 * A wavy run of cubics from x0 to x1 along the line `y(x)`, anchors alternating across it.
 * The amplitude is per-segment random, which is what keeps a long stretched stroke from
 * reading as a tidy sine wave.
 */
export function wavy(x0: number, x1: number, y: (x: number) => number, amp: number, segs: number,
  r: () => number): string {
  const dx = (x1 - x0) / segs
  let out = ''
  for (let i = 0; i < segs; i++) {
    const a = x0 + dx * i, b = a + dx, s = i % 2 ? 1 : -1
    out += ` C${r1(a + dx / 3)},${r1(y(a + dx / 3) + s * amp * (0.4 + r()))}`
      + ` ${r1(b - dx / 3)},${r1(y(b - dx / 3) - s * amp * (0.4 + r()))}`
      + ` ${r1(b)},${r1(y(b) + (r() - 0.5) * amp * 0.8)}`
  }
  return out
}

/**
 * How many ways a stroke can sit on the words, and how they are dealt.
 *
 * Eighty since the pen learned the length of what it is marking: the first forty variants
 * are dealt to phrases that run long (a sentence, most of a line, a wrap), the second forty
 * to a word or two. A hand does different things in the two cases — a word gets a quick,
 * tilted flick that overshoots; a sentence gets a slower, flatter pass that drifts — and
 * the same die stretched to both lengths could show neither.
 */
export const PEN_VARIANT_COUNT = 80
/** Variants below this are the long hand; from here up, the short. */
export const PEN_SHORT_FROM = 40
/** Inner text at or under this many characters is a short mark. About four words. */
export const PEN_SHORT_CHARS = 28
