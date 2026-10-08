// The TITLE PAGE of book mode: the first page of the spread (and the first screen of the
// phone's scroll), built from what the article's own header already says.
//
// Layout is the browser's and happy-dom lays nothing out, so what is asserted here is what a
// script can hold: the page is there and first, it says the right words, it brings no id and
// no control with it, and the stylesheet that gives it a page of its own and keeps the old
// historical ligatures off is the one that ships. The columns themselves were looked at in a
// browser (the counter reads the flow's own width, so a page that takes a column is counted).
import { beforeEach, describe, expect, it } from 'bun:test'
import { page, useDom } from './test-dom'
import { book } from './book'
import { BOOK_CSS } from '../../web/book.css'
import { BOOK_TEXT_CSS } from '../../web/book-text.css'
import { BOOK_PHONE_CSS } from '../../web/book-phone.css'

useDom()

const LABELS = { bookModePrev: 'Previous page', bookModeNext: 'Next page', bookModeClose: 'Close' }

/** The article as the server writes it, header and series card included. */
const ARTICLE = `<article>
  <header>
    <p class="post-meta"><a class="post-cat" href="/category/typography">Typography</a>
      <span class="post-facts"><time datetime="2026-07-09T01:00:00.000Z">July 9, 2026</time>
      <span class="meta-part"><span class="num">582</span> words</span>
      <span class="meta-part"><span class="num">3</span> min read</span>
      <span class="byline">by <a href="/about">The editor</a></span>
      <span class="meta-book"> · <button type="button" data-book-open>Book mode</button></span></span></p>
    <h1 id="post-title">A type scale you can defend</h1>
    <p class="deck">Nine roles, one ratio.</p>
  </header>
  <aside class="series"><p class="series-head"><span class="series-name"><a href="/series/x">Designing a reading page</a></span><span class="series-part">Part 2/4</span></p></aside>
  <div class="prose"><p>Body text</p><h2 id="a">A ratio</h2><p>More <a href="#a">words</a></p></div>
</article>`

const open = (width = 1200) => {
  window.innerWidth = width
  book()
  document.querySelector<HTMLButtonElement>('[data-book-open]')!.click()
}

describe('book mode opens on a title page', () => {
  beforeEach(() => { page(ARTICLE, LABELS) })

  it('puts the title page first in the flow, ahead of the body', () => {
    open()
    const flow = document.querySelector('.book-overlay .book-flow')!
    const first = flow.firstElementChild!
    expect(first.className).toBe('book-tp')
    expect(first.nextElementSibling!.textContent).toBe('Body text')
    expect(flow.querySelectorAll('.book-tp').length).toBe(1)
  })

  it('carries the kicker, the title, the standfirst and the byline, as text', () => {
    open()
    const tp = document.querySelector('.book-overlay .book-tp')!
    expect(tp.querySelector('h1')!.textContent).toBe('A type scale you can defend')
    // The section, then the series and its place in it: two elements read apart, so they
    // are not run together ("pagePart 2/4").
    expect(tp.querySelector('.tp-kick')!.textContent).toBe('Typography · Designing a reading page · Part 2/4')
    expect(tp.querySelector('.tp-deck')!.textContent).toBe('Nine roles, one ratio.')
    const by = tp.querySelector('.tp-by')!.textContent!
    expect(by).toContain('July 9, 2026')
    expect(by).toContain('3 min read')
    expect(by).toContain('by The editor')
    // The book-mode button lives in the same facts line and must not come along.
    expect(by).not.toContain('Book mode')
  })

  it('leaves a part out when the page has none of it', () => {
    page(`<article><header><h1>Bare</h1></header><div class="prose"><p>Body</p></div></article>
      <button data-book-open>Book</button>`, LABELS)
    open()
    const tp = document.querySelector('.book-overlay .book-tp')!
    expect(tp.querySelector('h1')!.textContent).toBe('Bare')
    // Empty lines are hidden by the stylesheet (:empty), so none of them carries text.
    for (const part of tp.querySelectorAll('.tp-kick,.tp-deck,.tp-by')) expect(part.textContent).toBe('')
  })

  it('has no title page for a post with no title, and says nothing in the running head', () => {
    page(`<article><header><p class="post-meta"><time>July 9, 2026</time></p></header>
      <div class="prose"><p>Short post</p></div></article><button data-book-open>Book</button>`, LABELS)
    open()
    const flow = document.querySelector('.book-overlay .book-flow')!
    expect(flow.querySelector('.book-tp')).toBeNull()
    expect(flow.firstElementChild!.textContent).toBe('Short post')
    expect(document.querySelector('.book-title')!.textContent).toBe('')
  })

  it('keeps the running head, hidden from a screen reader, and adds no id, link or control', () => {
    open()
    expect(document.querySelector('.book-title')!.textContent).toBe('A type scale you can defend')
    // The title page's h1 is where a screen reader meets the title; the running head is
    // decoration, so the dialog does not say it twice.
    expect(document.querySelector('.book-title')!.getAttribute('aria-hidden')).toBe('true')
    const tp = document.querySelector('.book-overlay .book-tp')!
    expect(tp.querySelectorAll('[id],a,button,[aria-hidden]').length).toBe(0)
  })

  it('never duplicates an id while the reader is open', () => {
    open()
    const ids = [...document.querySelectorAll('[id]')].map((n) => n.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    // The title's own id stays with the article's header and is not copied onto the page.
    expect(ids.filter((id) => id === 'post-title').length).toBe(1)
  })

  it('leaves the real header exactly as it was', () => {
    open()
    expect(document.querySelector('article > header h1')!.textContent).toBe('A type scale you can defend')
    expect(document.querySelectorAll('article > header').length).toBe(1)
  })
})

describe('the phone reader opens on the title page too', () => {
  beforeEach(() => {
    page(ARTICLE, LABELS)
    // The reader asks for the full glass and puts the tag back; layout.ts always writes it.
    document.head.innerHTML = '<meta name="viewport" content="width=device-width">'
  })

  it('puts it first in the scrolled column', () => {
    open(375)
    const flow = document.querySelector('.book-reader .book-flow')!
    expect(flow.firstElementChild!.className).toBe('book-tp')
    expect(flow.querySelector('.book-tp h1')!.textContent).toBe('A type scale you can defend')
    expect(document.querySelector('.book-reader .book-title')!.textContent).toBe('A type scale you can defend')
    expect(document.querySelector('.book-reader .book-title')!.getAttribute('aria-hidden')).toBe('true')
    const ids = [...document.querySelectorAll('[id]')].map((n) => n.id)
    expect(new Set(ids).size).toBe(ids.length)
    document.querySelector<HTMLButtonElement>('.book-reader .book-x')!.click()
  })
})

describe('the title page is a page of its own', () => {
  it('ends in a column break and fills the column, so the body starts on a fresh page', () => {
    expect(BOOK_TEXT_CSS).toMatch(/\.book-tp\{[^}]*break-after:column/)
    // 100%, not --book-page-h: that one is the flow's ROUNDED height and spills 0.16px of a
    // fractional column into the next, which starts the body a column late.
    // min-height, so a title that does not fit grows into more columns instead of being
    // clipped; `safe` centring, so it grows down from the top and not up past it.
    expect(BOOK_TEXT_CSS).toMatch(/\.book-tp\{[^}]*min-height:100%/)
    expect(BOOK_TEXT_CSS).toMatch(/\.book-tp\{[^}]*justify-content:safe center/)
    expect(BOOK_TEXT_CSS).not.toMatch(/\.book-tp\{[^}]*--book-page-h/)
  })

  it('does not take the body\'s drop cap or indent from the first child any more', () => {
    // The title page is the first child now, so the opening paragraph is the one AFTER it.
    expect(BOOK_CSS).toContain('.book-flow.prose > .book-tp + p::first-letter')
    expect(BOOK_CSS).toContain('.book-flow.prose > .book-tp + p{text-indent:0}')
    expect(BOOK_CSS).toContain('.book-flow.prose > .book-tp + *{margin-top:0}')
  })

  it('is the first screen on the phone (svh, so a collapsing toolbar cannot grow it), and its colours are tokens', () => {
    expect(BOOK_PHONE_CSS).toMatch(/\.book-reader \.book-tp\{[^}]*min-height:calc\(100svh/)
    const sheet = BOOK_TEXT_CSS.slice(BOOK_TEXT_CSS.indexOf('.book-tp{'))
    expect(sheet).not.toMatch(/#[0-9a-f]{3,8}\b|\bwhite\b|\bblack\b|rgba?\(/i)
  })
})

describe('book mode sets only the common ligatures', () => {
  it('turns the discretionary and the historical ones OFF, not just leaves them alone', () => {
    // "list" came out as "liſt" and "section" as "seĉtion": the long-s and the c-t of an
    // eighteenth-century printer, on a page that reads as modern (2026-10-08).
    const settings = /\.book-flow\{[^}]*font-feature-settings:([^;}]+)/.exec(BOOK_CSS)![1]!
    expect(settings).toContain('"liga" 1')
    expect(settings).toContain('"dlig" 0')
    expect(settings).toContain('"hlig" 0')
    expect(settings).not.toMatch(/"(dlig|hlig)" 1/)
  })
})
