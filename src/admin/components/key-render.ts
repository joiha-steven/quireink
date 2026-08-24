// A keystroke, rendered to samples. Pure arithmetic: no AudioContext, no DOM, no clock.
//
// It is a separate file from the graph for one reason worth stating — the question the owner
// asked ("do these three actually sound different?") is a question about the WAVEFORM, and a
// pure function that returns a Float32Array can be measured by a test. `key-render.test.ts`
// does exactly that. Nothing about the three instruments is a matter of opinion any more.
import type { Voice } from './key-voices'

/**
 * A small deterministic PRNG (mulberry32), NOT `Math.random`.
 *
 * Two reasons. A rendered strike is cached and replayed, so the noise in it is decided once
 * and needs to be reproducible for a test to say anything about it. And the variants — the
 * three slightly different renderings of the same key, so that forty strikes in a line are
 * not forty copies of one sample — are just three seeds, which is cheaper and more honest
 * than three hand-tuned tables.
 */
function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * One bandpass biquad (RBJ cookbook, constant peak gain), run over a noise burst.
 *
 * Hand-written rather than a BiquadFilterNode because the whole strike is assembled in ONE
 * buffer: a graph would need a node chain per component and a scheduled start per event, and
 * the sum of eight of those cannot be inspected before it reaches the speakers. Here it can.
 */
function bandNoise(
  out: Float32Array,
  offset: number,
  sampleRate: number,
  rand: () => number,
  hz: number,
  q: number,
  gain: number,
  secs: number,
  attack: number,
): void {
  const w0 = (2 * Math.PI * hz) / sampleRate
  const alpha = Math.sin(w0) / (2 * q)
  const a0 = 1 + alpha
  const b0 = alpha / a0
  const b2 = -alpha / a0
  const a1 = (-2 * Math.cos(w0)) / a0
  const a2 = (1 - alpha) / a0
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  const length = Math.ceil(sampleRate * secs)
  // Four time constants over the component's stated length, so it is inaudible by its end
  // rather than cut off — a truncated decay is a click of its own, in every voice at once.
  const tau = secs / 4
  for (let i = 0; i < length; i += 1) {
    const at = offset + i
    if (at >= out.length) break
    const t = i / sampleRate
    const x = rand() * 2 - 1
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    const rise = attack > 0 ? Math.min(1, t / attack) : 1
    out[at]! += y * gain * rise * Math.exp(-t / tau)
  }
}

/** A struck body, ringing. Starts at phase 0, so its own onset is a quarter period long. */
function tone(
  out: Float32Array,
  offset: number,
  sampleRate: number,
  hz: number,
  gain: number,
  secs: number,
): void {
  const length = Math.ceil(sampleRate * secs)
  const tau = secs / 4
  const w = (2 * Math.PI * hz) / sampleRate
  for (let i = 0; i < length; i += 1) {
    const at = offset + i
    if (at >= out.length) break
    out[at]! += Math.sin(w * i) * gain * Math.exp(-i / sampleRate / tau)
  }
}

/**
 * The whole keystroke, at the levels `key-voices.ts` asks for and no others.
 *
 * Deliberately NOT normalised here. Normalising per strike would flatten the one thing the
 * voice table is for: inside an instrument a space bar is meant to be heavier than a letter
 * and a backspace lighter, and a per-strike normaliser makes all four the same size. The one
 * scaling that does happen is a single constant per INSTRUMENT, measured once so the three
 * are equally loud to a human ear, and it lives with the player (`key-sound.ts`).
 */
export function render(voice: Voice, sampleRate: number, seed: number): Float32Array {
  const rand = prng(seed)
  const out = new Float32Array(Math.ceil(sampleRate * voice.secs))
  for (const part of voice.parts) {
    const offset = Math.round(part.at * sampleRate)
    for (const h of part.hiss ?? []) {
      bandNoise(out, offset, sampleRate, rand, h.hz, h.q, h.gain, h.secs, h.attack ?? 0)
    }
    for (const t of part.tones ?? []) tone(out, offset, sampleRate, t.hz, t.gain, t.secs)
  }
  return out
}

/** Peak sample, for the one thing a peak is good for: knowing how close to 1 the output is. */
export function peakOf(buf: Float32Array): number {
  let peak = 0
  for (const s of buf) peak = Math.max(peak, Math.abs(s))
  return peak
}
