import { describe, it, expect } from '@/test/vitest'
import { parseUa } from './ua'

// The parser only needs to bucket the common families correctly and never throw.
// It stores coarse labels (not the raw UA), so exactness matters less than the
// specific-before-generic ordering (Edge/Samsung before Chrome; Chrome before Safari).
describe('parseUa', () => {
  it('classifies desktop Chrome on Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'
    expect(parseUa(ua)).toEqual({ device: 'desktop', browser: 'Chrome', os: 'Windows' })
  })

  it('classifies iPhone Safari as mobile / iOS', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    expect(parseUa(ua)).toEqual({ device: 'mobile', browser: 'Safari', os: 'iOS' })
  })

  it('classifies iPad as tablet', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/604.1'
    expect(parseUa(ua).device).toBe('tablet')
  })

  it('prefers Edge over Chrome, Samsung over Chrome', () => {
    expect(parseUa('… Chrome/125.0 Safari/537.36 Edg/125.0').browser).toBe('Edge')
    expect(parseUa('… SamsungBrowser/24.0 Chrome/115.0 Mobile Safari/537.36').browser).toBe('Samsung Internet')
  })

  it('classifies Android Firefox and macOS Safari', () => {
    expect(parseUa('Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0')).toEqual({
      device: 'mobile',
      browser: 'Firefox',
      os: 'Android',
    })
    expect(parseUa('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15')).toEqual({
      device: 'desktop',
      browser: 'Safari',
      os: 'macOS',
    })
  })

  it('falls back to Other/desktop for an empty or unknown UA', () => {
    expect(parseUa('')).toEqual({ device: 'desktop', browser: 'Other', os: 'Other' })
  })
})

/**
 * The one device the string cannot describe.
 *
 * iPadOS 13+ sends a Macintosh user agent deliberately, so there is no token to test and
 * every iPad counted as a desktop Mac. Measured on a live blog over 30 days on 2026-08-30:
 * 117 desktop, 80 mobile, ZERO tablet. Multi-touch is the whole of the difference, and it
 * only exists in the browser, so the beacon sends it.
 */
describe('parseUa, with the touch hint the beacon carries', () => {
  const IPAD_LYING = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
  const MAC = IPAD_LYING
  const WINDOWS_TOUCH = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

  it('reads a touching Macintosh as the iPad it is', () => {
    expect(parseUa(IPAD_LYING, true)).toEqual({ device: 'tablet', browser: 'Safari', os: 'iPadOS' })
  })

  it('leaves a real Mac alone, because no Mac has a touchscreen', () => {
    expect(parseUa(MAC, false)).toEqual({ device: 'desktop', browser: 'Safari', os: 'macOS' })
  })

  // Gated on macOS for exactly this: a touchscreen laptop is a desktop and its UA says so.
  it('does not turn a Windows touchscreen laptop into a tablet', () => {
    expect(parseUa(WINDOWS_TOUCH, true)).toEqual({ device: 'desktop', browser: 'Chrome', os: 'Windows' })
  })

  it('changes nothing for a phone, which the string already describes', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1'
    expect(parseUa(iphone, true)).toEqual({ device: 'mobile', browser: 'Safari', os: 'iOS' })
  })

  // The default is the old answer, so a reader on cached JS or with scripting off is
  // bucketed exactly as before rather than landing somewhere new.
  it('is the previous behaviour when the beacon says nothing', () => {
    expect(parseUa(MAC)).toEqual(parseUa(MAC, false))
  })
})
