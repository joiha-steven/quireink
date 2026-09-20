// The grammar's own contract, separately from anything that renders it. `math.test.ts`
// proves the four delimiters and the money guards through the full pipeline; this file
// pins the two properties that live in the regex SOURCE itself and would survive a
// pipeline test being rewritten: the escape semantics, and the running time.

import { describe, expect, test } from 'bun:test'
import { matchMathAt, MATH_SYNTAX_GLOBAL } from './math-syntax'

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

describe('the quadratic scan after one save', () => {
  test('a post full of escaped citations does not scan the whole text from every one', () => {
    // ⚠️ THE ORDINARY SHAPE, NOT A CONTRIVED ONE. `to-markdown.ts` escapes `[` and deliberately
    // does not escape `]` — there is a paragraph there and a golden fixture behind it — so one
    // pass through the editor turns every citation like `[1]` into `\[1]`: an opening display
    // delimiter with no closer. With the content group written `[\s\S]+?` each of them scanned
    // to the END of the post, so the cost was the number of citations times the length.
    //
    // Measured on a 90 KB post of ordinary prose carrying 2,800 citations: `toPlainText` went
    // from 3 ms as typed to 990 ms after one save, and 7 ms with the lookahead. That function
    // feeds the excerpt, the meta description, the OG card and the RSS summary, so it runs on
    // every listing rather than once per post.
    const afterOneSave = 'Theo nghien cuu \\[1] va cac tai lieu \\[2] thi dieu nay da duoc chi ra.\n\n'.repeat(1400)
    expect(afterOneSave.length).toBeGreaterThan(80_000)
    const t0 = performance.now()
    MATH_SYNTAX_GLOBAL.lastIndex = 0
    expect(afterOneSave.match(MATH_SYNTAX_GLOBAL)).toBeNull()
    // Generous by 30x against the measured 7 ms, because a CI box under load is not a stopwatch
    // — and still two orders of magnitude under the 990 ms this is here to prevent.
    expect(performance.now() - t0).toBeLessThan(250)
  })

  test('and the counter-test: a real display formula is still found', () => {
    // Every assertion above is that a match came back NULL, which a broken pattern also returns.
    MATH_SYNTAX_GLOBAL.lastIndex = 0
    expect('before \\[x^2 + y^2\\] after'.match(MATH_SYNTAX_GLOBAL)).toEqual(['\\[x^2 + y^2\\]'])
    MATH_SYNTAX_GLOBAL.lastIndex = 0
    expect('a $$E = mc^2$$ b'.match(MATH_SYNTAX_GLOBAL)).toEqual(['$$E = mc^2$$'])
    MATH_SYNTAX_GLOBAL.lastIndex = 0
    expect('a \\(x\\) b'.match(MATH_SYNTAX_GLOBAL)).toEqual(['\\(x\\)'])
  })
})
