// The highlighter syntax: what `==text==` claims, and — more importantly — what it declines
// to claim. Half of these are prose that must come out UNTOUCHED, because a highlighter that
// fires on arithmetic is worse than no highlighter.

import { describe, expect, it } from 'bun:test'
import { renderPostContent } from '@/render/post-content'
import { INKS, DEFAULT_INK } from '@/render/ink'
import { toPlainText } from '@/utils'

const render = (md: string) => renderPostContent({ markdown: md }).then((h) => h.trim())

describe('the highlighter pen', () => {
  it('marks a phrase, with no attribute for the default ink', async () => {
    // Yellow is the MEANING of a bare `==`, so spelling it out would write a colour nobody
    // chose into every cached body.
    expect(await render('==highlighted==')).toBe('<p><mark>highlighted</mark></p>')
    expect(DEFAULT_INK).toBe('yellow')
  })

  it('names the other four inks through a #colour suffix', async () => {
    for (const ink of INKS.filter((i) => i !== DEFAULT_INK)) {
      expect(await render(`==x==#${ink}`)).toBe(`<p><mark data-ink="${ink}">x</mark></p>`)
    }
    // The default may be written out, and still costs no attribute.
    expect(await render('==x==#yellow')).toBe('<p><mark>x</mark></p>')
  })

  it('carries other inline markup under one stroke', async () => {
    expect(await render('==**b** [l](/u) `c`==')).toBe(
      '<p><mark><strong>b</strong> <a href="/u">l</a> <code>c</code></mark></p>',
    )
  })

  it('leaves an unknown colour as the literal text it looks like', async () => {
    expect(await render('==sale==#50off')).toBe('<p><mark>sale</mark>#50off</p>')
  })

  // ---- the things it must NOT touch ----

  it('ignores comparisons and assignments in running prose', async () => {
    // The trap this syntax exists to avoid: the content may not open or close on whitespace,
    // so a `==` with a space after it is arithmetic, not a pen.
    expect(await render('x == y and z == w')).toBe('<p>x == y and z == w</p>')
    expect(await render('== spaced ==')).toBe('<p>== spaced ==</p>')
  })

  it('ignores a run of three or more equals', async () => {
    expect(await render('===three===')).toBe('<p>===three===</p>')
  })

  it('leaves a setext heading underline to the block tokenizer', async () => {
    // `golden/corpus/setext-vs-atx.md` depends on this, and the golden suite is a byte
    // comparison — this is the same claim, stated where a reader will find it.
    expect(await render('Heading\n==========\n\nbody')).toBe('<h2 id="heading">Heading</h2>\n<p>body</p>')
  })

  it('never reaches inside a code span', async () => {
    expect(await render('`a == b` and ==c==')).toBe('<p><code>a == b</code> and <mark>c</mark></p>')
  })

  it('does not clip Vietnamese stacked diacritics out of the text', async () => {
    expect(await render('==ệ ộ ỡ ầy==#green')).toBe('<p><mark data-ink="green">ệ ộ ỡ ầy</mark></p>')
  })

  it('spans a source line break, because a wrapped sentence is still one stroke', async () => {
    expect(await render('==across\ntwo lines==')).toBe('<p><mark>across<br>two lines</mark></p>')
  })
})

describe('a highlight flattened to plain text', () => {
  // Auto-excerpts, the meta description, the OG card and the RSS summary all come through
  // toPlainText. Before this agreed with the tokenizer, the deck on a highlighted post read
  // `==mang dấu vết==` verbatim — and a `#green` suffix lost only its `#`, leaving the word
  // "green" sitting in the middle of the sentence.
  it('keeps the words and drops the pen', () => {
    expect(toPlainText('chỉ ==giữ lại đúng chỗ==#green, thường là ==vài chữ==.'))
      .toBe('chỉ giữ lại đúng chỗ, thường là vài chữ.')
  })

  it('still leaves ordinary comparisons alone', () => {
    expect(toPlainText('x == y and z == w')).toBe('x == y and z == w')
  })
})
