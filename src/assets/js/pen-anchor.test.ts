// The reader's anchor: a mark finds its words again, and only its words.
import { beforeEach, describe, expect, it } from 'bun:test'
import { flatten, locate, rangeFrom, selectorFor, unwrap, wrap } from './pen-anchor'
import { page, useDom } from './test-dom'

useDom()

const ARTICLE = '<div class="prose">'
  + '<p id="a">The reed holds little ink and gives it up fast, so every stroke starts wet and ends dry.</p>'
  + '<p id="b">A careful writer fights that. He harvested it: the <strong>fading stroke</strong> became texture.</p>'
  + '<p id="c">Every stroke starts wet and ends dry, again.</p>'
  + '</div>'

const prose = () => document.querySelector<HTMLElement>('.prose')!
const textOf = (id: string) => document.getElementById(id)!.firstChild as Text

beforeEach(() => page(ARTICLE))

describe('the anchor', () => {
  it('describes a selection by its words and their surroundings', () => {
    const r = document.createRange()
    r.setStart(textOf('a'), 4)
    r.setEnd(textOf('a'), 27)
    const sel = selectorFor(flatten(prose()), r)!
    expect(sel.exact).toBe('reed holds little ink a')
    expect(sel.prefix).toBe('The ')
    expect(sel.suffix.startsWith('nd gives it up fast')).toBe(true)
  })

  it('tells two identical sentences apart by what stands around them', () => {
    const flat = flatten(prose())
    const a = locate(flat, { exact: 'stroke starts wet and ends dry', prefix: 'fast, so every ', suffix: '.' })!
    const c = locate(flat, { exact: 'stroke starts wet and ends dry', prefix: 'Every ', suffix: ', again.' })!
    expect(a.start).toBeLessThan(c.start)
    expect(flat.text.slice(c.start - 6, c.start)).toBe('Every ')
  })

  it('still finds the words when the whitespace between them has changed', () => {
    const flat = flatten(prose())
    const hit = locate(flat, { exact: 'careful   writer\nfights', prefix: '', suffix: '' })!
    expect(flat.text.slice(hit.start, hit.end)).toBe('careful writer fights')
  })

  it('returns nothing when the words are gone, rather than landing elsewhere', () => {
    expect(locate(flatten(prose()), { exact: 'a sentence nobody wrote', prefix: '', suffix: '' })).toBeNull()
  })

  it('wraps across an inline element as one mark in several pieces, and unwraps clean', () => {
    const flat = flatten(prose())
    const hit = locate(flat, { exact: 'the fading stroke became', prefix: '', suffix: '' })!
    const range = rangeFrom(flat, hit.start, hit.end)!
    const made = wrap(range, () => {
      const m = document.createElement('mark')
      m.dataset.reader = 'x1'
      return m
    })
    expect(made.length).toBe(3) // "the ", "fading stroke", " became"
    expect(prose().textContent).toContain('the fading stroke became texture')
    expect(document.querySelectorAll('mark[data-reader="x1"]').length).toBe(3)
    unwrap(document.querySelectorAll('[data-reader="x1"]'))
    expect(document.querySelectorAll('mark').length).toBe(0)
    expect(document.getElementById('b')!.innerHTML)
      .toBe('A careful writer fights that. He harvested it: the <strong>fading stroke</strong> became texture.')
  })

  it('wraps a run inside one text node — the common case, and the one that once wrapped nothing', () => {
    const r = document.createRange()
    r.setStart(textOf('a'), 4)
    r.setEnd(textOf('a'), 8)
    const made = wrap(r, () => document.createElement('mark'))
    expect(made.length).toBe(1)
    expect(made[0]!.textContent).toBe('reed')
    expect(document.getElementById('a')!.innerHTML.startsWith('The <mark>reed</mark> holds')).toBe(true)
  })

  it('ignores the note cards it puts on the page when reading the text', () => {
    const card = document.createElement('aside')
    card.dataset.penSkip = ''
    card.textContent = 'my own words'
    document.getElementById('a')!.after(card)
    expect(flatten(prose()).text).not.toContain('my own words')
  })
})
