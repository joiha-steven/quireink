// The mini-Markdown a chat answer uses, and the one rule that shapes it.
//
// A mark is only a mark once it is CLOSED. Half of these tests are about text that is STILL
// ARRIVING: `**Liga` is four literal characters and must stay four literal characters, because
// the alternative is an answer that reflows twice per emphasis as it streams.
import { describe, expect, it } from 'bun:test'
import { richMarks, rows } from '@/admin-shared/rich-text'
import { htmlOf } from '@/web/admin/mark-html'

const html = (text: string): string => htmlOf(richMarks(text))

describe('a mark is only a mark once it has closed', () => {
  it('makes bold out of a closed pair', () => {
    expect(html('a **two** b')).toContain('<strong class="font-semibold">two</strong>')
  })

  it('leaves an unclosed pair as the characters it is', () => {
    const out = html('a **two')
    expect(out).not.toContain('<strong')
    expect(out).toContain('**two')
  })

  it('does not read the middle of a bold run as an italic one', () => {
    expect(html('**two**')).not.toContain('<em>')
  })

  it('keeps code literal inside its backticks', () => {
    expect(html('try `bun test` now')).toContain('>bun test</code>')
  })

  it('is not fooled across a line break', () => {
    expect(html('a **one\ntwo** b')).not.toContain('<strong')
  })
})

describe('a table waits for its divider row', () => {
  it('is a table once the divider has arrived', () => {
    const out = html('| a | b |\n|---|---|\n| 1 | 2 |')
    expect(out).toContain('<table')
    expect(out).toContain('<th')
    expect(out).toContain('>1</td>')
  })

  it('is still pipes while only the header has arrived', () => {
    expect(html('| a | b |')).not.toContain('<table')
  })

  it('stops at the first line that is not a row', () => {
    const parsed = rows('| a |\n|---|\n| 1 |\nafter')
    expect(parsed).toHaveLength(2)
    expect(parsed[1]).toEqual({ kind: 'text', text: 'after' })
  })
})

describe('lists and rules', () => {
  it('gives a bullet the same marker whichever character asked for it', () => {
    for (const source of ['- one', '* one', '+ one']) {
      expect(rows(source)[0]).toEqual({ kind: 'item', marker: '·', text: 'one' })
    }
  })

  it("keeps a numbered item's own number", () => {
    expect(rows('3. three')[0]).toEqual({ kind: 'item', marker: '3.', text: 'three' })
  })

  it('reads three dashes as a rule and two as text', () => {
    expect(rows('---')[0]?.kind).toBe('rule')
    expect(rows('--')[0]?.kind).toBe('text')
  })

  it('makes a blank line a gap rather than an empty paragraph', () => {
    expect(html('a\n\nb')).toContain('class="block h-2"')
  })
})

describe('nothing a model writes becomes markup', () => {
  it('escapes a tag in an answer', () => {
    expect(html('<script>alert(1)</script>')).not.toContain('<script>')
    expect(html('<script>alert(1)</script>')).toContain('&lt;script&gt;')
  })

  it('escapes a tag inside a bold run', () => {
    expect(html('**<img src=x onerror=1>**')).not.toContain('<img')
  })

  it('escapes a tag inside a table cell', () => {
    expect(html('| <b>x</b> |\n|---|\n| y |')).not.toContain('<b>x</b>')
  })
})
