// The player: what reaches the speakers, and at what level.
//
// The instruments themselves are measured next door in `key-render.test.ts` — this file is
// only about the graph and the one number the owner sets.
//
// happy-dom is registered for THIS FILE ONLY and unregistered afterwards — see the island
// tests for the rule. `window.AudioContext` is ours either way: happy-dom has no audio
// engine, and a real one would make an assertion about loudness depend on a sound card.

import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { gainFor, playKey, previewKey, takes, LEVEL } from '@/admin/components/key-sound'
import { peakOf } from '@/admin/components/key-render'
import type { Instrument, Strike } from '@/admin/components/key-voices'

const built = { gains: [] as number[], rates: [] as number[], buffers: [] as unknown[], starts: 0, contexts: 0, shapers: 0 }

class FakeContext {
  state = 'running'
  currentTime = 0
  sampleRate = 48_000
  destination = {}
  constructor() { built.contexts += 1 }
  createBuffer(_c: number, length: number) {
    return { length, getChannelData: () => new Float32Array(length) }
  }
  createBufferSource() {
    const node = {
      buffer: null as unknown,
      playbackRate: { value: 1 },
      connect: (n: unknown) => n,
      start: () => {
        built.starts += 1
        built.buffers.push(node.buffer)
        built.rates.push(node.playbackRate.value)
      },
    }
    return node
  }
  createGain() {
    const g = { value: 0 }
    built.gains.push(0)
    const at = built.gains.length - 1
    return {
      get gain() {
        return { get value() { return g.value }, set value(v: number) { g.value = v; built.gains[at] = v } }
      },
      connect: (n: unknown) => n,
    }
  }
  createWaveShaper() {
    built.shapers += 1
    return { curve: null as unknown, oversample: 'none', connect: (n: unknown) => n }
  }
}

beforeAll(() => {
  GlobalRegistrator.register()
  ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeContext
})
afterAll(() => GlobalRegistrator.unregister())
beforeEach(() => { built.gains = []; built.rates = []; built.buffers = []; built.starts = 0; built.shapers = 0 })

describe('how loud a key is', () => {
  it('reads the slider as a plain fraction of full volume', () => {
    expect(gainFor(0)).toBe(0)
    expect(gainFor(100)).toBeCloseTo(0.3, 5)
    expect(gainFor(50)).toBeCloseTo(0.15, 5)
  })

  it('refuses to be talked past the ends of its own range', () => {
    expect(gainFor(400)).toBeCloseTo(0.3, 5)
    expect(gainFor(-30)).toBe(0)
    expect(gainFor(Number.NaN)).toBe(0)
  })

  it('carries the setting all the way to the gain', () => {
    playKey({ mode: 'typewriter', volume: 30 }, 'tap')
    const quiet = built.gains.at(-1)!
    built.gains = []
    playKey({ mode: 'typewriter', volume: 100 }, 'tap')
    const loud = built.gains.at(-1)!
    // 3.33x nominal; the per-strike level jitter is +-8% on each draw, so the worst honest
    // pair is still clear of 2. An assertion on the exact ratio would fail on the jitter
    // that keeps forty keys in a line from sounding like one sample repeated.
    expect(loud).toBeGreaterThan(quiet * 2)
  })

  it('at zero makes no sound and does not open an audio context', () => {
    const before = built.contexts
    playKey({ mode: 'linear', volume: 0 }, 'tap')
    previewKey({ mode: 'linear', volume: 0 })
    expect(built.starts).toBe(0)
    expect(built.contexts).toBe(before)
  })

  it('says nothing at all when the instrument is off, whatever the volume', () => {
    playKey({ mode: 'off', volume: 100 }, 'tap')
    expect(built.starts).toBe(0)
  })
})

describe('the measured level table', () => {
  /**
   * The three instruments are matched on A-WEIGHTED loudness, which means their peaks are
   * nowhere near each other, and that is correct rather than a bug: a 2.5 kHz crack sits in
   * the ear's most sensitive octave and a 220 Hz thock does not. If a later change makes the
   * three peak alike, the crack has become painful or the thock inaudible.
   */
  it('spreads the three peaks wide, because it matched their loudness instead', () => {
    const peak = (m: Instrument, k: Strike = 'tap') =>
      Math.max(...takes(m, k, 48_000).map(peakOf)) * LEVEL[m]
    expect(peak('tactile')).toBeGreaterThan(peak('typewriter'))
    expect(peak('typewriter')).toBeGreaterThan(peak('linear'))
    // Measured 2026-08-25: 3.01 / 1.53 / 0.62. If a later change brings these together, one
    // of two things has happened and both are bad.
    expect(peak('tactile')).toBeGreaterThan(peak('linear') * 3)
  })

  it('keeps the loudest key on the loudest instrument inside the limiter', () => {
    // At the top of the slider, with the level jitter at its most generous.
    let worst = 0
    for (const mode of ['typewriter', 'tactile', 'linear'] as Instrument[]) {
      for (const kind of ['tap', 'back', 'space', 'return'] as Strike[]) {
        for (const take of takes(mode, kind, 48_000)) {
          worst = Math.max(worst, peakOf(take) * LEVEL[mode] * gainFor(100) * 1.08)
        }
      }
    }
    // Under 1.0, so the soft ceiling shapes a peak rather than being handed a signal it can
    // only clamp. Measured 2026-08-25: 0.98 — the loudest key of the loudest instrument at
    // the top of the slider with the level jitter at its most generous.
    expect(worst).toBeLessThan(1)
    expect(worst).toBeGreaterThan(0.6)
  })
})

describe('the graph', () => {
  it('puts one soft ceiling in front of the destination, once', () => {
    playKey({ mode: 'tactile', volume: 60 }, 'tap')
    const after = built.shapers
    playKey({ mode: 'tactile', volume: 60 }, 'tap')
    expect(after).toBeLessThanOrEqual(1)
    expect(built.shapers).toBe(after)
  })

  it('does not play the same recording of a key twice in a row every time', () => {
    // Three renderings per key, picked at random, plus a few percent of pitch. Forty
    // identical clicks in a line stop reading as typing and start reading as a fault.
    for (let i = 0; i < 40; i += 1) playKey({ mode: 'linear', volume: 60 }, 'tap')
    expect(new Set(built.buffers).size).toBe(3)
    expect(new Set(built.rates).size).toBeGreaterThan(20)
  })

  it('gives the four keys four different recordings', () => {
    for (const kind of ['tap', 'back', 'space', 'return'] as Strike[]) {
      playKey({ mode: 'typewriter', volume: 60 }, kind)
    }
    const lengths = built.buffers.map((b) => (b as { length: number }).length)
    expect(new Set(lengths).size).toBe(4)
  })
})
