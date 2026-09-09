// The felt tip's squeak, made on the spot (ADR 0049).
//
// A highlighter dragged across paper squeaks because the felt sticks and slips: a resonant
// rasp somewhere between 1.5 and 3 kHz that rises as the hand speeds up, with a flutter on
// it from the stick-slip itself. That is what is rendered here — noise through a resonant
// band-pass whose centre glides, under an envelope with a flutter — and rendered as PURE
// ARITHMETIC first, the way the key click is (`key-render.ts`), so the test can measure the
// sound rather than argue about it. Three takes per gesture, level-matched, so two marks in
// a row never squeak identically.
//
// Three gestures, three shapes. The highlighter is the long one and rises; the underline is
// short and nearly flat, a pencil rather than felt; the ring goes up and comes back down,
// the way a hand does around a word. No audio file anywhere, ever.

import { gainFor, withAudio, type KeySound } from './key-sound'

export type Gesture = 'hl' | 'u' | 'o'

/** Duration, and the centre frequency's path as [start, peak, end] in Hz. */
const SHAPE: Record<Gesture, { seconds: number; path: [number, number, number]; q: number }> = {
  hl: { seconds: 0.2, path: [1500, 2100, 2700], q: 9 },
  u: { seconds: 0.13, path: [1900, 2200, 2300], q: 7 },
  o: { seconds: 0.24, path: [1600, 2900, 1700], q: 9 },
}

/**
 * Level against a key at the same slider position. The rasp sits in the ear's most
 * sensitive octave (A-weighting peaks near 2.5 kHz) and lasts five times as long as a
 * click, so it is held well under the key: a mark should be heard beside the typing, not
 * over it.
 */
const LEVEL = 0.45

const TAKES = 3

/** A small deterministic generator, so a take is the same take every time it is rendered. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    return ((s >>> 0) % 10000) / 10000
  }
}

/** The samples of one take, peak-normalised to 0.9. */
export function renderSqueak(kind: Gesture, sampleRate: number, seed = 1): Float32Array {
  const { seconds, path, q } = SHAPE[kind]
  const n = Math.round(seconds * sampleRate)
  const out = new Float32Array(n)
  const rand = rng(seed * 7919 + kind.charCodeAt(0))
  // A state-variable filter, run per sample so the centre can move.
  let low = 0, band = 0
  const flutterHz = 90 + rand() * 50
  const wobbleHz = 28 + rand() * 12
  const flutterDepth = 0.25 + rand() * 0.15
  for (let i = 0; i < n; i++) {
    const t = i / n
    // The centre glides start → peak → end; the peak sits at 55% of the stroke.
    const centre = t < 0.55
      ? path[0] + (path[1] - path[0]) * (t / 0.55)
      : path[1] + (path[2] - path[1]) * ((t - 0.55) / 0.45)
    const wobble = 1 + 0.04 * Math.sin(2 * Math.PI * wobbleHz * (i / sampleRate))
    const f = 2 * Math.sin(Math.PI * Math.min(centre * wobble, sampleRate * 0.45) / sampleRate)
    const x = rand() * 2 - 1
    const high = x - low - band / q
    band += f * high
    low += f * band
    // Envelope: a 12ms attack, a body, and a release over the last quarter, with the
    // stick-slip flutter riding the body.
    const attack = Math.min(1, i / (0.012 * sampleRate))
    const release = t > 0.75 ? (1 - t) / 0.25 : 1
    const flutter = 1 - flutterDepth * (0.5 + 0.5 * Math.sin(2 * Math.PI * flutterHz * (i / sampleRate)))
    out[i] = band * attack * release * flutter
  }
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]!))
  if (peak > 0) for (let i = 0; i < n; i++) out[i] = (out[i]! / peak) * 0.9
  return out
}

const pools = new Map<string, AudioBuffer[]>()

function buffers(context: AudioContext, kind: Gesture): AudioBuffer[] {
  const key = `${kind}:${context.sampleRate}`
  const hit = pools.get(key)
  if (hit) return hit
  const made: AudioBuffer[] = []
  for (let take = 1; take <= TAKES; take++) {
    const samples = renderSqueak(kind, context.sampleRate, take)
    const buffer = context.createBuffer(1, samples.length, context.sampleRate)
    buffer.getChannelData(0).set(samples)
    made.push(buffer)
  }
  pools.set(key, made)
  return made
}

/**
 * One mark, heard. Silent — and the audio machinery untouched — unless the owner has the
 * squeak on AND an instrument chosen AND the slider above zero.
 */
export function playSqueak(sound: KeySound, kind: Gesture): void {
  if (!sound.squeak || sound.mode === 'off') return
  const level = gainFor(sound.volume) * LEVEL
  if (level <= 0) return
  withAudio((context, out) => {
    const pool = buffers(context, kind)
    const source = context.createBufferSource()
    source.buffer = pool[Math.floor(Math.random() * pool.length)] ?? pool[0]!
    source.playbackRate.value = 0.95 + Math.random() * 0.1
    const gain = context.createGain()
    gain.gain.value = level * (0.9 + Math.random() * 0.2)
    source.connect(gain).connect(out)
    source.start(context.currentTime)
  })
}
