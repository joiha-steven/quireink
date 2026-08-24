// The volume is a setting, so it is a thing that can silently stop working. This is the
// audio graph under a fake AudioContext: what gets built, how loud, and how many times.
//
// happy-dom is registered for THIS FILE ONLY and unregistered afterwards — see the island
// tests for the rule. `window.AudioContext` is ours either way: happy-dom has no audio
// engine, and a real one would make an assertion about loudness depend on a sound card.

import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { gainFor, playKey, previewKey } from '@/admin/components/key-sound'

type Built = { gains: number[]; freqs: number[]; starts: number[]; contexts: number }
const built: Built = { gains: [], freqs: [], starts: [], contexts: 0 }

class FakeContext {
  state = 'running'
  currentTime = 0
  sampleRate = 48_000
  destination = {}
  constructor() { built.contexts += 1 }
  createBuffer(_c: number, length: number) {
    return { getChannelData: () => new Float32Array(length) }
  }
  createBufferSource() {
    return { buffer: null, connect: (n: unknown) => n, start: (at: number) => built.starts.push(at) }
  }
  createBiquadFilter() {
    const freq = { value: 0 }
    built.freqs.push(0)
    const at = built.freqs.length - 1
    return {
      type: '',
      Q: { value: 0 },
      get frequency() { return { get value() { return freq.value }, set value(v: number) { freq.value = v; built.freqs[at] = v } } },
      connect: (n: unknown) => n,
    }
  }
  createGain() {
    const g = { value: 0 }
    built.gains.push(0)
    const at = built.gains.length - 1
    return {
      get gain() { return { get value() { return g.value }, set value(v: number) { g.value = v; built.gains[at] = v } } },
      connect: (n: unknown) => n,
    }
  }
}

beforeAll(() => {
  GlobalRegistrator.register()
  ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeContext
})
afterAll(() => GlobalRegistrator.unregister())
beforeEach(() => { built.gains = []; built.freqs = []; built.starts = [] })

describe('how loud a key is', () => {
  it('reads the slider as a plain fraction of full scale', () => {
    expect(gainFor(0)).toBe(0)
    expect(gainFor(100)).toBe(2.5)
    expect(gainFor(50)).toBe(1.25)
  })

  it('refuses to be talked past the ends of its own range', () => {
    expect(gainFor(400)).toBe(2.5)
    expect(gainFor(-30)).toBe(0)
    expect(gainFor(Number.NaN)).toBe(0)
  })

  // The point of the whole change: the number the owner sets has to reach the gain node.
  it('carries the setting all the way to the gain', () => {
    playKey({ mode: 'typewriter', volume: 30 }, 'tap')
    const quiet = built.gains.at(-1)!
    built.gains = []
    playKey({ mode: 'typewriter', volume: 100 }, 'tap')
    const loud = built.gains.at(-1)!
    // 3.33x nominal; per-strike jitter is +-10% on each draw, so the worst honest pair is
    // still well clear of 2. An assertion on the exact ratio would fail on the jitter that
    // keeps forty keys in a line from sounding like one sample repeated.
    expect(loud).toBeGreaterThan(quiet * 2)
  })

  it('at zero makes no sound and does not open an audio context', () => {
    const before = built.contexts
    playKey({ mode: 'linear', volume: 0 }, 'tap')
    previewKey({ mode: 'linear', volume: 0 })
    expect(built.starts).toHaveLength(0)
    expect(built.contexts).toBe(before)
  })

  it('says nothing at all when the instrument is off, whatever the volume', () => {
    playKey({ mode: 'off', volume: 100 }, 'tap')
    expect(built.starts).toHaveLength(0)
  })
})

describe('the three instruments, as graphs', () => {
  it('gives tactile its bump and leaves linear one strike', () => {
    playKey({ mode: 'tactile', volume: 60 }, 'tap')
    expect(built.starts).toHaveLength(2)
    // The bump, then the bottom-out a few milliseconds later. The GAP is the tactility.
    expect(built.starts[1]! - built.starts[0]!).toBeCloseTo(0.012, 4)
    built.starts = []
    playKey({ mode: 'linear', volume: 60 }, 'tap')
    expect(built.starts).toHaveLength(1)
  })

  it('drops the voice for the two biggest keys on the board', () => {
    for (const mode of ['typewriter', 'tactile', 'linear'] as const) {
      built.freqs = []
      playKey({ mode, volume: 60 }, 'tap')
      const tap = built.freqs[0]!
      built.freqs = []
      playKey({ mode, volume: 60 }, 'space')
      // Jitter is +-10%, so a real difference has to be bigger than that to mean anything.
      expect(built.freqs[0]!).toBeLessThan(tap * 0.8)
    }
  })
})
