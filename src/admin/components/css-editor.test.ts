// The brace counter, which is the only part of the Custom CSS box with an opinion.
//
// It exists because an unclosed brace is how a stylesheet does NOTHING — not partly, not
// visibly, nothing — and the box gave no sign of it: you saved, the page did not change, and
// nowhere on the screen said why. Everything else in that component is layout.
//
// The cases below are all the ones a naive `split('{').length - split('}').length` gets
// wrong, and it would get them wrong in the direction that matters: crying about a file that
// is fine, on the one screen where a false alarm teaches the owner to ignore the warning.
import { describe, it, expect } from 'bun:test'
import { braceBalance } from './CssEditor'

describe('braceBalance', () => {
  it('is zero for a balanced sheet, empty or not', () => {
    expect(braceBalance('')).toBe(0)
    expect(braceBalance('.prose { color: red }')).toBe(0)
    expect(braceBalance('@media (min-width: 40em) { .prose { color: red } }')).toBe(0)
  })

  it('counts how many are still open', () => {
    expect(braceBalance('.prose {')).toBe(1)
    expect(braceBalance('@media print { .prose {')).toBe(2)
  })

  // Reported as -1 rather than as a negative count: once a `}` has closed nothing, the rest
  // of the arithmetic is meaningless, and a later missing `{` must not cancel it back to
  // zero and report a broken file as fine.
  it('reports a closing brace with nothing open, and does not let it cancel out', () => {
    expect(braceBalance('}')).toBe(-1)
    expect(braceBalance('} .prose {')).toBe(-1)
  })

  it('ignores braces inside a comment', () => {
    expect(braceBalance('/* .prose { color: red } */')).toBe(0)
    expect(braceBalance('/* } */ .prose { color: red }')).toBe(0)
    expect(braceBalance('.prose { /* } */ color: red }')).toBe(0)
  })

  it('ignores braces inside a string, in either quote', () => {
    expect(braceBalance('.a::after { content: "}" }')).toBe(0)
    expect(braceBalance(".a::after { content: '{' }")).toBe(0)
    expect(braceBalance('.a::after { content: "\\"}" }')).toBe(0)
  })

  // An unterminated comment or string swallows the rest of the file, which is exactly what a
  // browser does with it too. The answer must be a number, not a crash on every keystroke.
  it('does not hang or throw on unterminated input', () => {
    expect(braceBalance('.prose { /* never closed')).toBe(1)
    expect(braceBalance('.a { content: "never closed')).toBe(1)
    expect(braceBalance('/*')).toBe(0)
  })
})
