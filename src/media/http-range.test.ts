import { describe, it, expect } from '@/test/vitest'
import { parseRange } from './http-range'

// Pins the byte-range contract the /uploads video streaming depends on: browsers
// (iOS Safari especially) seek via `Range: bytes=…` and expect exact 206 bounds.
describe('parseRange', () => {
  it('returns null without a header (→ 200 full body)', () => {
    expect(parseRange(null, 100)).toBeNull()
  })

  it('parses an explicit start-end, clamped to EOF', () => {
    expect(parseRange('bytes=0-49', 100)).toEqual({ start: 0, end: 49 })
    expect(parseRange('bytes=50-999', 100)).toEqual({ start: 50, end: 99 })
  })

  it('parses an open-ended start (bytes=N-)', () => {
    expect(parseRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 })
  })

  it('parses a suffix range (bytes=-N = final N bytes)', () => {
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 })
    expect(parseRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 }) // longer than file
  })

  it('flags an unsatisfiable range (start ≥ size) as invalid (→ 416)', () => {
    expect(parseRange('bytes=100-', 100)).toBe('invalid')
    expect(parseRange('bytes=5-2', 100)).toBe('invalid')
    expect(parseRange('bytes=-0', 100)).toBe('invalid')
  })

  it('treats malformed / multi-range headers as full-body (null), per RFC option', () => {
    expect(parseRange('bytes=0-10,20-30', 100)).toBeNull()
    expect(parseRange('items=0-10', 100)).toBeNull()
    expect(parseRange('bytes=-', 100)).toBeNull()
  })
})
