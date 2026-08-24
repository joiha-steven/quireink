// The three instruments, held apart by measurement.
//
// This suite exists because of one sentence from the owner on 2026-08-25: *"3 loại tiếng ko
// khác gì nhau"*. He was right, and nothing in 1849 tests had any opinion about it — the
// three "instruments" were one noise generator with three centre frequencies, 1840 / 1144 /
// 972 Hz apart, which is not three keyboards. A sound is not a matter of taste that code
// cannot check: where its energy sits, how long it lives and how many times something
// happens are all numbers.
//
// So: if somebody retunes a voice until the three converge again, this goes red.

import { describe, expect, it } from 'bun:test'
import { render, peakOf } from '@/admin/components/key-render'
import { VOICES, type Instrument, type Strike } from '@/admin/components/key-voices'

const SR = 48_000
const MODES: Instrument[] = ['woody', 'crisp', 'deep']
const KINDS: Strike[] = ['tap', 'back', 'space', 'return']

/** Power at a probe frequency, by hand: a whole FFT to answer one question is not needed. */
function power(buf: Float32Array, f: number): number {
  let re = 0
  let im = 0
  const w = (2 * Math.PI * f) / SR
  for (let i = 0; i < buf.length; i += 1) {
    re += buf[i]! * Math.cos(w * i)
    im += buf[i]! * Math.sin(w * i)
  }
  return (re * re + im * im) / SR
}

/** Where the energy sits, power-weighted over log-spaced probes from 60 Hz to 14 kHz. */
function centroid(buf: Float32Array): number {
  let num = 0
  let den = 0
  for (let f = 60; f < 14_000; f *= 1.08) {
    const p = power(buf, f)
    num += p * f
    den += p
  }
  return den > 0 ? num / den : 0
}

/** The millisecond-by-millisecond envelope, as a fraction of the strike's own peak. */
function envelope(buf: Float32Array): number[] {
  const win = Math.round(SR * 0.001)
  const env: number[] = []
  for (let i = 0; i + win < buf.length; i += win) {
    let m = 0
    for (let j = i; j < i + win; j += 1) m = Math.max(m, Math.abs(buf[j]!))
    env.push(m)
  }
  const peak = Math.max(...env, 1e-9)
  return env.map((v) => v / peak)
}

/**
 * How many separate things happen: times the envelope climbs back through a fifth of the
 * peak after having dropped to near nothing.
 *
 * Measured on the ENVELOPE and not on a rise-per-millisecond, because a rise threshold
 * cannot see the first event (it has nothing before it to rise from) and reads the wobble in
 * a long ring as a stream of onsets. Both mistakes were made here first.
 */
function events(buf: Float32Array): number {
  let n = 0
  let inside = false
  for (const v of envelope(buf)) {
    if (!inside && v > 0.2) { n += 1; inside = true }
    if (inside && v < 0.04) inside = false
  }
  return n
}

/** The share of the strike's energy that sits above 2 kHz: how bright it is. */
function brightness(buf: Float32Array): number {
  let hi = 0
  let all = 0
  for (let f = 60; f < 14_000; f *= 1.08) {
    const p = power(buf, f)
    all += p
    if (f >= 2000) hi += p
  }
  return all > 0 ? hi / all : 0
}

/** When the strike is over: the last sample above 5% of its own peak, in milliseconds. */
function tailMs(buf: Float32Array): number {
  const peak = peakOf(buf)
  for (let i = buf.length - 1; i >= 0; i -= 1) if (Math.abs(buf[i]!) > peak * 0.05) return (i / SR) * 1000
  return 0
}

const tap = Object.fromEntries(MODES.map((m) => [m, render(VOICES[m].tap, SR, 1)])) as Record<Instrument, Float32Array>

describe('the three instruments are three instruments', () => {
  it('puts their energy in three different places', () => {
    // Measured 2026-08-25: 1968 / 460 / 206 Hz unweighted. Generous margins on purpose —
    // this is meant to catch CONVERGENCE, not to freeze a tuning.
    expect(centroid(tap.crisp)).toBeGreaterThan(centroid(tap.woody) * 3)
    expect(centroid(tap.woody)).toBeGreaterThan(centroid(tap.deep) * 1.8)
    expect(centroid(tap.crisp)).toBeGreaterThan(1500)
    expect(centroid(tap.deep)).toBeLessThan(400)
  })

  it('gives one a crack, one a ring and one none at all', () => {
    // Brightness — the share of energy above 2 kHz — is what "đanh" actually means, and it
    // is the number the version the owner rejected had no spread in at all.
    // Measured: 0.308 / 0.083 / 0.000.
    expect(brightness(tap.crisp)).toBeGreaterThan(0.2)
    expect(brightness(tap.woody)).toBeGreaterThan(0.03)
    expect(brightness(tap.woody)).toBeLessThan(brightness(tap.crisp) / 2)
    expect(brightness(tap.deep)).toBeLessThan(0.01)
  })

  it('keeps every fundamental above what a laptop speaker can reproduce', () => {
    // A 158 Hz thock is a thock on a desk and silence on a MacBook. Nothing may carry its
    // weight below 150 Hz: for each voice, the energy under 150 Hz stays a minority.
    for (const mode of MODES) {
      for (const kind of KINDS) {
        const buf = render(VOICES[mode][kind], SR, 1)
        let low = 0
        let all = 0
        for (let f = 60; f < 14_000; f *= 1.08) {
          const p = power(buf, f)
          all += p
          if (f < 150) low += p
        }
        expect(low / all).toBeLessThan(0.5)
      }
    }
  })

  it('gives the crisp one a short life and the deep one a long one', () => {
    // Crispness is as much about how fast it is gone as about how bright it is.
    expect(tailMs(tap.crisp)).toBeLessThan(40)
    expect(tailMs(tap.deep)).toBeGreaterThan(70)
    expect(tailMs(tap.woody)).toBeGreaterThan(tailMs(tap.crisp))
  })

  it('lets the escapement be heard after the typebar has landed', () => {
    // The tick the carriage makes as it steps one place, 55ms after the strike, is most of
    // what stops a typewriter sounding like a drum. It carries about 3% of the energy and it
    // is unmissable, which is why this asks whether the LATE window is bright rather than
    // whether it is loud.
    const late = tap.woody.slice(Math.round(SR * 0.045), Math.round(SR * 0.075))
    expect(brightness(late)).toBeGreaterThan(0.3)
    // A switch has nothing at all going on that late.
    const quiet = tap.crisp.slice(Math.round(SR * 0.045))
    expect(peakOf(quiet)).toBeLessThan(peakOf(tap.crisp) * 0.05)
  })

  it('counts the events each machine actually performs', () => {
    // A tactile switch: the bump, then the bottom-out. A linear one: the bottom-out, and its
    // quiet upstroke buried in the ring. A typewriter: the typebar and then the carriage.
    expect(events(tap.crisp)).toBe(2)
    expect(events(tap.deep)).toBe(1)
    expect(events(tap.woody)).toBeGreaterThanOrEqual(2)
    // The carriage flying back across the machine is a run of them and nothing else is.
    expect(events(render(VOICES.woody.return, SR, 1))).toBeGreaterThanOrEqual(5)
  })
})

describe('the strikes inside one instrument', () => {
  it('never renders two keys as the same samples', () => {
    for (const mode of MODES) {
      const seen = new Set<string>()
      for (const kind of KINDS) {
        const buf = render(VOICES[mode][kind], SR, 1)
        const sig = `${buf.length}:${peakOf(buf).toFixed(4)}:${Math.round(centroid(buf))}`
        expect(seen.has(sig)).toBe(false)
        seen.add(sig)
      }
    }
  })

  it('gives every variant its own noise', () => {
    // The TONES are the same between variants — a body rings the way it rings — so the two
    // are compared by how much they differ, not by how many samples match.
    const a = render(VOICES.crisp.tap, SR, 0x9e37)
    const b = render(VOICES.crisp.tap, SR, 0x9e37 + 7919)
    let diff = 0
    let base = 0
    for (let i = 0; i < a.length; i += 1) {
      diff += (a[i]! - b[i]!) ** 2
      base += a[i]! ** 2
    }
    expect(Math.sqrt(diff / base)).toBeGreaterThan(0.15)
  })

  it('renders the same samples for the same seed, so a cached strike is reproducible', () => {
    const a = render(VOICES.deep.tap, SR, 42)
    const b = render(VOICES.deep.tap, SR, 42)
    expect(Array.from(a.slice(0, 200))).toEqual(Array.from(b.slice(0, 200)))
  })
})
