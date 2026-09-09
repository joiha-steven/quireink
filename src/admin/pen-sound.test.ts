// The felt tip's squeak, measured (ADR 0049): three shapes, in the band a squeak lives in,
// held under the key, and never the same twice.
import { describe, expect, it } from 'bun:test'
import { renderSqueak, type Gesture } from '@/admin/components/pen-sound'

const RATE = 48_000

/** Where the energy sits, by counting zero crossings: a narrow rasp reads as its centre. */
function centreHz(samples: Float32Array, from = 0, to = samples.length): number {
  let crossings = 0
  for (let i = from + 1; i < to; i++) if ((samples[i]! >= 0) !== (samples[i - 1]! >= 0)) crossings++
  return (crossings / 2) / ((to - from) / RATE)
}

const peak = (s: Float32Array) => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0)

describe('renderSqueak', () => {
  it('lasts as long as a stroke, no longer, and is normalised under full scale', () => {
    expect(renderSqueak('hl', RATE).length).toBe(Math.round(0.2 * RATE))
    expect(renderSqueak('u', RATE).length).toBe(Math.round(0.13 * RATE))
    expect(renderSqueak('o', RATE).length).toBe(Math.round(0.24 * RATE))
    for (const k of ['hl', 'u', 'o'] as Gesture[]) expect(peak(renderSqueak(k, RATE))).toBeCloseTo(0.9, 2)
  })

  it('sits in the band a felt tip squeaks in, and ends quietly', () => {
    for (const k of ['hl', 'u', 'o'] as Gesture[]) {
      const s = renderSqueak(k, RATE)
      const centre = centreHz(s)
      expect(centre).toBeGreaterThan(1300)
      expect(centre).toBeLessThan(3200)
      const tail = s.slice(Math.round(s.length * 0.97))
      expect(peak(tail)).toBeLessThan(0.2)
    }
  })

  it('rises across a highlight and comes back down around a ring', () => {
    const hl = renderSqueak('hl', RATE)
    const third = Math.round(hl.length / 3)
    expect(centreHz(hl, 0, third)).toBeLessThan(centreHz(hl, hl.length - third))
    const o = renderSqueak('o', RATE)
    const t = Math.round(o.length / 3)
    const middle = centreHz(o, t, 2 * t)
    expect(middle).toBeGreaterThan(centreHz(o, 0, t))
    expect(middle).toBeGreaterThan(centreHz(o, 2 * t))
  })

  it('renders the same take the same way, and different takes differently', () => {
    const a = renderSqueak('hl', RATE, 1), b = renderSqueak('hl', RATE, 1), c = renderSqueak('hl', RATE, 2)
    expect(Array.from(a.slice(1000, 1010))).toEqual(Array.from(b.slice(1000, 1010)))
    expect(Array.from(a.slice(1000, 1010))).not.toEqual(Array.from(c.slice(1000, 1010)))
  })
})
