// The islands that belong to a LIST or to a whole article: the listing controls and book
// mode.
//
// Split from `interactive.test.ts` to stay under the 400-line rule.

import { beforeEach, describe, expect, it } from 'bun:test'
import { book } from './book'
import { listing } from './listing'
import { page, useDom } from './test-dom'

useDom()

beforeEach(() => page(''))

describe('listing controls', () => {
  const page1 = '<div class="post-list"><article>One</article></div>'
  const LABELS = { gridView: 'Grid view', listView: 'List view' }

  beforeEach(() => {
    try { localStorage.clear() } catch { /* ignore */ }
    delete document.documentElement.dataset.list
  })

  it('remembers grid across page loads', () => {
    page(`<button data-grid-toggle></button>${page1}`, LABELS)
    listing()
    expect(document.documentElement.dataset.list).toBe('list')

    document.querySelector<HTMLButtonElement>('[data-grid-toggle]')!.click()
    expect(document.documentElement.dataset.list).toBe('grid')
    expect(document.querySelector('[data-grid-toggle]')!.getAttribute('aria-pressed')).toBe('true')

    // A second page load, same reader.
    page(`<button data-grid-toggle></button>${page1}`, LABELS)
    listing()
    expect(document.documentElement.dataset.list).toBe('grid')
  })

  // The class is `post-list`, and it has been renamed once already: the island kept
  // querying the old `.listing` for a whole milestone, which silently hid the toggle on
  // every page that HAD a list. Named after the rename so the next one is caught here.
  it('finds the list under its real class name', () => {
    page(`<button data-grid-toggle></button>${page1}`, LABELS)
    listing()
    expect(document.querySelector<HTMLButtonElement>('[data-grid-toggle]')!.hidden).toBe(false)
  })

  it('hides the toggle on a page with no list', () => {
    page('<button data-grid-toggle></button><article>a post</article>', LABELS)
    listing()
    expect(document.querySelector<HTMLButtonElement>('[data-grid-toggle]')!.hidden).toBe(true)
  })
})

describe('book mode', () => {
  const article = `<button data-book-open>Book mode</button>
    <div class="prose"><h2 id="a">A</h2><p>Body text</p></div>`
  const LABELS = { bookModePrev: 'Previous page', bookModeNext: 'Next page', bookModeClose: 'Close' }

  /** happy-dom lays nothing out, so the stage's scroll geometry is supplied here. */
  const geometry = (stage: HTMLElement, width: number, scrollWidth: number) => {
    Object.defineProperty(stage, 'clientWidth', { value: width, configurable: true })
    Object.defineProperty(stage, 'scrollWidth', { value: scrollWidth, configurable: true })
    let left = 0
    Object.defineProperty(stage, 'scrollLeft', {
      get: () => left, set: (v: number) => { left = v }, configurable: true,
    })
    // `scrollBy` is overloaded (options, or x and y), so the stub is cast rather than
    // written to satisfy both signatures for a test that only ever calls the first.
    stage.scrollBy = (((opts?: ScrollToOptions) => { left += opts?.left ?? 0 }) as unknown) as typeof stage.scrollBy
  }

  const open = () => {
    book()
    document.querySelector<HTMLButtonElement>('[data-book-open]')!.click()
    return document.querySelector<HTMLDialogElement>('.book-overlay')!
  }

  it('opens a modal dialog over a CLONE, leaving the article alone', () => {
    page(article, LABELS)
    const overlay = open()
    expect(overlay.tagName).toBe('DIALOG')
    expect(overlay.open).toBe(true)
    expect(overlay.querySelector('.book-flow')!.innerHTML).toContain('Body text')
    // The original is still in the document. The page a search engine and a screen reader
    // see is untouched by anything that happens in the reader.
    expect(document.querySelector('.prose p')!.textContent).toBe('Body text')
  })

  it('turns pages with the arrow keys and counts them', () => {
    page(article, LABELS)
    const overlay = open()
    // The horizontal scroller is the VIEWPORT now, not the stage: the stage holds the two
    // side arrows beside it, so it is no longer the box that clips the columns.
    const viewport = overlay.querySelector<HTMLElement>('.book-viewport')!
    geometry(viewport, 1000, 4000)

    dispatchEvent(new Event('resize'))
    expect(overlay.querySelector('.book-count')!.textContent).toBe('1 / 4')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(overlay.querySelector('.book-count')!.textContent).toBe('2 / 4')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(overlay.querySelector('.book-count')!.textContent).toBe('1 / 4')
  })

  it('tears down on close and stops listening for keys', () => {
    page(article, LABELS)
    const overlay = open()
    overlay.close()
    expect(document.querySelector('.book-overlay')).toBeNull()
    // A stale handler would throw against a dialog that is no longer in the document.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(document.querySelector('.book-overlay')).toBeNull()
  })

  // A spread is two facing pages until the pages get too narrow to hold words. This shipped
  // as an unconditional two, so a 390px phone was handed two 119px columns — about ten
  // characters each, one word per line. Nothing in `check:all` could see it; the screenshot
  // could, and this is that screenshot turned into an assertion.
  it('drops to ONE page when a spread would be too narrow to read', () => {
    page(article, LABELS)
    const overlay = open()
    const viewport = overlay.querySelector<HTMLElement>('.book-viewport')!
    geometry(viewport, 390, 1200)

    window.innerWidth = 390
    dispatchEvent(new Event('resize'))
    expect(viewport.dataset.pages).toBe('1')
    // The whole footprint, not half of it: 390 less the outer margin on both sides.
    expect(overlay.querySelector<HTMLElement>('.book-flow')!.style
      .getPropertyValue('--book-col-w')).toBe('294px')

    window.innerWidth = 1200
    dispatchEvent(new Event('resize'))
    expect(viewport.dataset.pages).toBe('2')
  })

  it('does nothing when the owner has book mode off, so there is no toggle', () => {
    page('<div class="prose"><p>Body</p></div>', LABELS)
    expect(() => book()).not.toThrow()
    expect(document.querySelector('.book-overlay')).toBeNull()
  })
})
