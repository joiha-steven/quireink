// OPEN A POST AND SAVE IT, AND NOTHING MOVES.
//
// The promise this engine has to keep, and the one no other test here can. The spec suite
// proves the reader's page is right; this proves the WRITER'S file is, which is a different
// and more dangerous property: a renderer bug shows up as a page that looks wrong, and a
// serializer bug shows up as a sentence that is not there any more, on a post published
// months ago, found by nobody.
//
// Two laws, and both are needed.
//
//   1. A FIXED POINT. Serializing twice gives the same text. This catches a serializer that
//      keeps changing the document — corruption on a timer, which compounds every save.
//
//   2. THE PAGE DOES NOT MOVE. Rendering the source and rendering what a save would write
//      give the same HTML. This is the strict one, and law 1 alone is blind to what it sees:
//      `\[^1\]` is a perfectly stable fixed point, and it is also a footnote reference that
//      has become an empty formula. Nineteen of these same 45 fixtures published differently
//      after one pass through the old editor, and every one of them was stable.
//
// Both are run over `golden/corpus`, which holds the shapes this blog actually uses —
// footnotes, callouts, tables, maths, the pen's three gestures, galleries, video embeds.

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, toHtml } from './index'
import { toMarkdown } from './to-markdown'

const CORPUS = 'golden/corpus'
const FIXTURES = readdirSync(CORPUS).filter((f) => f.endsWith('.md')).sort()

describe('open and save', () => {
  it('has fixtures to run', () => {
    // A moved corpus would otherwise turn this whole file into zero silent tests.
    expect(FIXTURES.length).toBeGreaterThan(40)
  })

  for (const file of FIXTURES) {
    it(`is a fixed point: ${file}`, () => {
      const source = readFileSync(join(CORPUS, file), 'utf8')
      const once = toMarkdown(parse(source))
      const twice = toMarkdown(parse(once))
      expect(twice).toBe(once)
    })
  }

  for (const file of FIXTURES) {
    it(`leaves the page alone: ${file}`, () => {
      const source = readFileSync(join(CORPUS, file), 'utf8')
      const saved = toMarkdown(parse(source))
      expect(toHtml(saved)).toBe(toHtml(source))
    })
  }
})

describe('the two shapes a save has destroyed before', () => {
  // Both are regression tests with a date on them, and both are about brackets.
  it('keeps a footnote reference a footnote reference', () => {
    const saved = toMarkdown(parse('A sentence[^1] with a note.\n'))
    expect(saved).toContain('[^1]')
    expect(saved).not.toContain('\\[^1\\]')
  })

  it('keeps a callout marker a callout marker', () => {
    const saved = toMarkdown(parse('> [!NOTE]\n> Body.\n'))
    expect(saved).toContain('[!NOTE]')
    expect(saved).not.toContain('\\[!NOTE\\]')
  })

  it('does not turn a bracketed word into maths on the second save', () => {
    // `\[ … \]` is display maths on this blog, so escaping BOTH brackets made `[two]` a
    // formula one save later. Found by the fixed-point law on `reference-links.md`; the
    // first save looked perfectly fine.
    const once = toMarkdown(parse('[one][ref] and [two][missing]\n\n[ref]: https://example.com\n'))
    const twice = toMarkdown(parse(once))
    expect(twice).toBe(once)
    expect(twice).not.toContain('$$')
  })
})
