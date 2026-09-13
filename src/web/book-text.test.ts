// THE BASELINE GRID, as arithmetic rather than as a look.
//
// Two columns of a spread read as one page only while their lines sit at the same heights,
// and that holds only while every gap between blocks is a WHOLE number of lines. It is the
// kind of rule that cannot be held by eye: a half-line anywhere puts the left column and the
// right column out of phase at the first paragraph break and they drift from there, which
// looks like nothing in particular until somebody measures it.
//
// The tour looks at a rendered spread (`book mode sets its pages on one baseline grid`).
// This reads the sheet, which is where a whole number stops being one.
import { describe, expect, it } from 'bun:test'
import { BOOK_TEXT_CSS } from '@/web/book-text.css'

/** Every declaration of a property inside the book flow's rules, in source order. */
const declarations = (prop: string): string[] =>
  [...BOOK_TEXT_CSS.matchAll(new RegExp(`${prop}:([^;}]+)`, 'g'))].map((m) => m[1]!.trim())

describe('book mode sets its blocks on whole lines', () => {
  it('measures every gap in --book-line and nothing else', () => {
    // A gap in px, em or rem is a gap that does not follow the reader's own type settings,
    // and --book-line is the only value that does: it IS the leading.
    for (const value of [...declarations('margin-top'), ...declarations('margin-bottom')]) {
      expect({ value, whole: /^(0|var\(--book-line\)|calc\(\d+ \* var\(--book-line\)\))$/.test(value) })
        .toEqual({ value, whole: true })
    }
  })

  it('gives a heading its air inside its own line box, not all in its margins', () => {
    // Two lines of margin, a one-line box and a line below is four line-slots, and it read as
    // the loudest thing on a page whose paragraphs are separated by an indent and nothing
    // else: 81px of white above the words against 34px below. Reported 2026-09-14.
    // One line of margin and a two-line box is three slots, with the face in the middle of
    // its own air: about a line and a half above and half a line below.
    expect(BOOK_TEXT_CSS).toContain(
      '.book-flow.prose > :is(h1,h2,h3,h4,h5){margin-top:var(--book-line);\n  line-height:calc(2 * var(--book-line))}')
    expect(BOOK_TEXT_CSS).toContain('.book-flow.prose > :is(h1,h2,h3,h4,h5) + *{margin-top:0}')
  })

  it('separates two paragraphs by the indent alone, which is what a book does', () => {
    // The indent is the ONLY thing saying a paragraph has started here: there is no blank
    // line to add and no room for one on the grid. Two ems is the top of the range a printed
    // book uses; it was 1.6em and read as an aside.
    expect(BOOK_TEXT_CSS).toContain('.book-flow.prose p{text-indent:2em}')
    expect(BOOK_TEXT_CSS).toContain('.book-flow.prose > p{margin-top:0}')
  })

  it('leaves a plate two lines on each side, by its own rule', () => {
    // ⚠️ NOT a name in the list beside the quotes and the lists: :is() takes the specificity
    // of its most specific argument, and that list carries a CLASS in .table-scroll, so it
    // outranks a plain figure element. Two lines there looked like one until it was measured.
    expect(BOOK_TEXT_CSS).toContain('.book-flow.prose > figure{margin-top:calc(2 * var(--book-line));margin-bottom:0}')
    expect(BOOK_TEXT_CSS).toContain('.book-flow.prose > figure + *{margin-top:calc(2 * var(--book-line))}')
  })
})
