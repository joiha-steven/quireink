// Punctuation that touches an inline formula travels with it (`html.ts`, `glueMath`).
//
// The host's formula renderer is replaced by a stub so these tests read the GLUE, not Temml's
// markup: `<math>` stands for whatever the host prints.

import { describe, expect, test } from 'bun:test'
import { toHtml } from './index'

const rules = { math: (tex: string, display: boolean) => (display ? `<math display="block">${tex}</math>` : `<math>${tex}</math>`) }
const html = (md: string) => toHtml(md, rules)
const G = (inner: string) => `<span class="math-glue">${inner}</span>`

describe('inline maths and the punctuation touching it', () => {
  test('( + math + ) are one unbreakable run', () => {
    expect(html('a perfect fourth ($r=1.333$) is dramatic')).toBe(
      `<p>a perfect fourth ${G('(<math>r=1.333</math>)')} is dramatic</p>\n`,
    )
  })

  test('math + , takes the comma and nothing else', () => {
    expect(html('where $x$, then $y$.')).toBe(`<p>where ${G('<math>x</math>,')} then ${G('<math>y</math>.')}</p>\n`)
  })

  test('a space before ( keeps the word out of the run, and a space after the math ends it', () => {
    expect(html('see word ($x$) later')).toBe(`<p>see word ${G('(<math>x</math>)')} later</p>\n`)
    expect(html('the word ($x$) and $y$ (z)')).toBe(
      `<p>the word ${G('(<math>x</math>)')} and <math>y</math> (z)</p>\n`,
    )
  })

  test('a word before a bracket is never pulled in', () => {
    expect(html('f($x$)')).toBe(`<p>f${G('(<math>x</math>)')}</p>\n`)
  })

  test('a formula with a space on both sides is left bare', () => {
    expect(html('so $x$ holds')).toBe('<p>so <math>x</math> holds</p>\n')
  })

  test('one run of closers is claimed once: ")(" between two formulas splits', () => {
    expect(html('$a$)($b$')).toBe(`<p>${G('<math>a</math>)')}${G('(<math>b</math>')}</p>\n`)
  })

  test('curly quotes and the ellipsis glue like brackets', () => {
    expect(html('he said “$x$”…')).toBe(`<p>he said ${G('“<math>x</math>”…')}</p>\n`)
  })

  test('display maths is untouched, and so is text beside a display block', () => {
    expect(html('$$x$$')).toContain('<math display="block">x</math>')
    expect(html('$$\nx\n$$\n\n(after)')).not.toContain('math-glue')
    expect(html('$$\nx\n$$')).not.toContain('math-glue')
  })

  test('the text of the run is escaped', () => {
    expect(html('"$x$"')).toBe(`<p>${G('&quot;<math>x</math>&quot;')}</p>\n`)
  })

  test('a paragraph without inline maths is byte-for-byte what it was', () => {
    expect(html('plain (text), with *emphasis*.')).toBe('<p>plain (text), with <em>emphasis</em>.</p>\n')
  })
})
