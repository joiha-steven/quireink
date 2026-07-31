import { describe, expect, test } from 'bun:test'
import {
  base32Decode,
  base32Encode,
  codeForStep,
  generateSecret,
  otpauthUri,
  stepAt,
  verifyCode,
} from './totp'

// The RFC 6238 appendix B secret: the ASCII "12345678901234567890", base32 encoded.
const RFC_SECRET = base32Encode(new TextEncoder().encode('12345678901234567890'))

describe('base32', () => {
  test('round-trips arbitrary bytes', () => {
    for (const length of [1, 2, 3, 4, 5, 10, 20]) {
      const bytes = new Uint8Array(Array.from({ length }, (_, i) => (i * 37 + 11) & 255))
      expect(base32Decode(base32Encode(bytes))).toEqual(bytes)
    }
  })

  test('matches the known encoding of the RFC secret', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
  })

  // The three shapes a person produces when retyping a secret off a screen.
  test('tolerates lower case, spacing and padding', () => {
    const expected = base32Decode(RFC_SECRET)
    expect(base32Decode(RFC_SECRET.toLowerCase())).toEqual(expected)
    expect(base32Decode('GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ')).toEqual(expected)
    expect(base32Decode(`${RFC_SECRET}======`)).toEqual(expected)
  })

  test('rejects a character outside the alphabet', () => {
    // 1, 8 and 0 are excluded from base32 precisely because they read as I, B and O.
    expect(base32Decode('ABC1DEF')).toBeNull()
    expect(base32Decode('')).toBeNull()
  })
})

describe('codeForStep', () => {
  // RFC 6238 appendix B, SHA-1 column, truncated to our 6 digits.
  const VECTORS: Array<[seconds: number, code: string]> = [
    [59, '287082'],
    [1_111_111_109, '081804'],
    [1_111_111_111, '050471'],
    [1_234_567_890, '005924'],
    [2_000_000_000, '279037'],
    // Past 2^31 steps. This one fails if the counter is written as two 32-bit halves.
    [20_000_000_000, '353130'],
  ]

  for (const [seconds, code] of VECTORS) {
    test(`T=${seconds}`, () => {
      expect(codeForStep(RFC_SECRET, stepAt(seconds * 1000))).toBe(code)
    })
  }

  test('returns null for an undecodable secret', () => {
    expect(codeForStep('not!valid', 1)).toBeNull()
  })
})

describe('verifyCode', () => {
  const NOW = 1_700_000_000_000
  const step = stepAt(NOW)

  test('accepts the current step', () => {
    const code = codeForStep(RFC_SECRET, step)!
    expect(verifyCode(RFC_SECRET, code, { now: NOW })).toEqual({ ok: true, step })
  })

  test('accepts one step either side, for clock drift', () => {
    for (const delta of [-1, 1]) {
      const code = codeForStep(RFC_SECRET, step + delta)!
      expect(verifyCode(RFC_SECRET, code, { now: NOW })).toEqual({ ok: true, step: step + delta })
    }
  })

  test('rejects two steps away', () => {
    for (const delta of [-2, 2]) {
      const code = codeForStep(RFC_SECRET, step + delta)!
      expect(verifyCode(RFC_SECRET, code, { now: NOW }).ok).toBe(false)
    }
  })

  test('ignores whitespace in what was typed or pasted', () => {
    const code = codeForStep(RFC_SECRET, step)!
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`
    expect(verifyCode(RFC_SECRET, spaced, { now: NOW }).ok).toBe(true)
  })

  test('rejects anything that is not six digits', () => {
    for (const input of ['', '12345', '1234567', 'abcdef', '12345a']) {
      expect(verifyCode(RFC_SECRET, input, { now: NOW }).ok).toBe(false)
    }
  })

  // The replay guard. A code shoulder-surfed inside its window is otherwise usable for
  // the remainder of that window, which is the whole point of watching someone type it.
  test('rejects a step already spent', () => {
    const code = codeForStep(RFC_SECRET, step)!
    expect(verifyCode(RFC_SECRET, code, { now: NOW, minStep: step }).ok).toBe(false)
    expect(verifyCode(RFC_SECRET, code, { now: NOW, minStep: step - 1 }).ok).toBe(true)
  })

  test('the drift window does not reopen a spent step', () => {
    // Signing in at `step`, then again 30s later: the previous code is now "one step back"
    // and would be accepted by drift alone. `minStep` is what closes that.
    const previous = codeForStep(RFC_SECRET, step)!
    const later = NOW + STEP_MS
    expect(verifyCode(RFC_SECRET, previous, { now: later, minStep: step }).ok).toBe(false)
  })

  test('a null minStep means nothing has been spent yet', () => {
    const code = codeForStep(RFC_SECRET, step)!
    expect(verifyCode(RFC_SECRET, code, { now: NOW, minStep: null }).ok).toBe(true)
  })
})

const STEP_MS = 30_000

describe('generateSecret', () => {
  test('is 160 bits of base32 and decodes back to 20 bytes', () => {
    const secret = generateSecret()
    expect(secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(base32Decode(secret)!.length).toBe(20)
  })

  test('is not the same twice', () => {
    expect(generateSecret()).not.toBe(generateSecret())
  })
})

describe('otpauthUri', () => {
  test('carries the issuer both in the label and as a parameter', () => {
    const uri = otpauthUri('ABCDEFGH', 'hung')
    expect(uri.startsWith('otpauth://totp/QuireInk%3Ahung?')).toBe(true)
    const params = new URL(uri).searchParams
    expect(params.get('secret')).toBe('ABCDEFGH')
    expect(params.get('issuer')).toBe('QuireInk')
    expect(params.get('algorithm')).toBe('SHA1')
    expect(params.get('digits')).toBe('6')
    expect(params.get('period')).toBe('30')
  })

  test('escapes a username that would break the label', () => {
    const uri = otpauthUri('ABCDEFGH', 'a:b c')
    expect(uri).toContain('QuireInk%3Aa%3Ab%20c')
  })
})
