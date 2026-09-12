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
    // A toggle has ONE name and two states. Swapping the name as well announced "List view,
    // toggle button, pressed": the name said one thing and the state said the other.
    expect(document.querySelector('[data-grid-toggle]')!.getAttribute('aria-label')).toBe('Grid view')

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

  // The scroll-fade fallback, on an engine with no view() timelines. It hides a card and
  // then takes the hiding off when the card comes into view — so a card it never watches is a
  // card that stays hidden for ever, and the tail of the archive is fetched a page at a time
  // by this very island. Found from the reading page: a run of blank cards with real height
  // and real gaps between them, past the first page, on that engine only.
  it('watches the cards that arrive with a later page, not only the ones the server sent', async () => {
    const watched: Element[] = []
    // The entry shape the island actually reads: it asks for the ratio and the rectangle as
    // well as the flag, so a stub carrying only `isIntersecting` throws inside the callback.
    type Entry = { isIntersecting: boolean; intersectionRatio: number; boundingClientRect: { top: number }; target: Element }
    const observers: ((entries: Entry[]) => void)[] = []
    globalThis.IntersectionObserver = class {
      constructor(cb: (e: Entry[]) => void) { observers.push(cb) }
      observe(el: Element): void { watched.push(el) }
      disconnect(): void {}
    } as unknown as typeof IntersectionObserver

    page(
      '<div class="post-list"><div class="tl-yr"><span class="tl-year-tag">2026</span>'
      + '<article class="reveal">One</article></div></div>'
      + '<nav data-feed-more><a rel="next" href="/page/2">More</a></nav>',
      LABELS,
    )
    // AFTER `page()`, which rewrites the document and takes the root's attributes with it.
    document.documentElement.dataset.scrollFade = 'on'
    document.documentElement.dataset.motion = 'on'
    // happy-dom answers `true` to every `CSS.supports`, so the branch under test — the one
    // for engines WITHOUT view() timelines — is unreachable until this says no. The whole
    // namespace is replaced rather than its method: `globalThis.CSS` hands back a fresh
    // object on every read, so an assignment to `CSS.supports` lands on a copy and the next
    // reader sees the original.
    const realCss = globalThis.CSS
    Object.defineProperty(globalThis, 'CSS', {
      value: { supports: (prop: string) => prop !== 'animation-timeline' },
      configurable: true,
    })
    const before = watched.length
    listing()
    // The fallback only arms where view() timelines are missing, which is the case here.
    expect(document.documentElement.dataset.revealJs).toBe('on')

    // Page two arrives, carrying a card of its own.
    const original = globalThis.fetch
    globalThis.fetch = (async () => new Response(
      '<div class="post-list"><div class="tl-yr"><span class="tl-year-tag">2026</span>'
      + '<article class="reveal">Two</article></div></div>',
    )) as unknown as typeof fetch
    try {
      // The sentinel is the last card; firing every observer drives the fetch.
      for (const cb of observers) {
        cb([{ isIntersecting: true, intersectionRatio: 1, boundingClientRect: { top: 10 }, target: document.querySelector('article')! }])
      }
      await new Promise((r) => setTimeout(r, 0))
      await new Promise((r) => setTimeout(r, 0))
    } finally {
      globalThis.fetch = original
      Object.defineProperty(globalThis, 'CSS', { value: realCss, configurable: true })
    }

    const cards = [...document.querySelectorAll('.post-list article')]
    expect(cards.map((c) => c.textContent)).toEqual(['One', 'Two'])
    // Both of them are being watched — the one the page came with and the one that landed.
    expect(watched.slice(before)).toContain(cards[1])
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
    // The measured box is the FLOW itself now — the multicol element. Chrome 148 stopped
    // reporting a multicol's overflow columns on any ancestor (and stopped painting them),
    // so the island reads flow.scrollWidth and turns pages by transform; the viewport is
    // only the clip. The stub therefore supplies the flow's geometry.
    const flowEl = overlay.querySelector<HTMLElement>('.book-flow')!
    geometry(flowEl, 1000, 4000)

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
    // The whole footprint, not half of it: 390 less the PHONE margin on both sides — 20px,
    // not the desktop's 48, which took a quarter of a 375px screen off the words.
    expect(overlay.querySelector<HTMLElement>('.book-flow')!.style
      .getPropertyValue('--book-col-w')).toBe('350px')

    window.innerWidth = 1200
    dispatchEvent(new Event('resize'))
    expect(viewport.dataset.pages).toBe('2')
  })

  // An unfolded foldable is 673px and shaped like a book, and the desktop margins were what
  // kept it from getting one: 48px a side left 577px, 39px short of a spread, so the reader
  // got a single ~80-character column with the fold's crease through every line. The margins
  // yield before the second page does.
  it('gives an unfolded foldable two pages by yielding the margins', () => {
    page(article, LABELS)
    const overlay = open()
    const viewport = overlay.querySelector<HTMLElement>('.book-viewport')!
    geometry(overlay.querySelector<HTMLElement>('.book-flow')!, 673, 1200)

    window.innerWidth = 673
    dispatchEvent(new Event('resize'))
    expect(viewport.dataset.pages).toBe('2')
    // (673 - 20*2 - 56) / 2, floored: two paperback pages with the crease in the gutter.
    expect(overlay.querySelector<HTMLElement>('.book-flow')!.style
      .getPropertyValue('--book-col-w')).toBe('288px')
  })


  it('does nothing when the owner has book mode off, so there is no toggle', () => {
    page('<div class="prose"><p>Body</p></div>', LABELS)
    expect(() => book()).not.toThrow()
    expect(document.querySelector('.book-overlay')).toBeNull()
  })
})
