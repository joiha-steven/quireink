// The grammar's own contract, separately from anything that renders it. `math.test.ts`
// proves the four delimiters and the money guards through the full pipeline; this file
// pins the two properties that live in the regex SOURCE itself and would survive a
// pipeline test being rewritten: the escape semantics, and the running time.

import { describe, expect, test } from 'bun:test'
import { matchMathAt, MATH_SYNTAX_GLOBAL } from '@/render/math-syntax'

describe('escapes inside a dollar formula', () => {
  test('an escaped dollar belongs to the formula instead of closing it', () => {
    const m = matchMathAt('$a \\$ b$ prose')
    expect(m?.tex).toBe('a \\$ b')
    expect(m?.raw).toBe('$a \\$ b$')
  })

  test('any escape pair is carried through verbatim', () => {
    expect(matchMathAt('$\\alpha + \\#$')?.tex).toBe('\\alpha + \\#')
  })

  test('a backslash cannot straddle the closing dollar', () => {
    // `\$` here is an ESCAPED dollar, so this formula never closes. Reading the backslash
    // as content and the dollar as the closer would make `\` valid trailing TeX, which it
    // is not — and that double reading is exactly the ambiguity the ReDoS fix removed.
    expect(matchMathAt('$a\\$')).toBeNull()
  })
})

describe('the js/redos regression (CodeQL alert #22)', () => {
  test('an unclosed formula full of escapes fails in linear time', () => {
    // Before the content group excluded the backslash from its char class, every `\#`
    // could be read two ways and this input cost seconds at n=24, doubling with each
    // step — 128ms at n=20, measured. At n=200 the old grammar would outlive the server.
    const evil = `$${'\\#'.repeat(200)}`
    const t0 = performance.now()
    expect(matchMathAt(evil)).toBeNull()
    MATH_SYNTAX_GLOBAL.lastIndex = 0
    expect(evil.match(MATH_SYNTAX_GLOBAL)).toBeNull()
    // Generous: microseconds in practice, but a CI box under load is not a stopwatch.
    expect(performance.now() - t0).toBeLessThan(500)
  })
})
