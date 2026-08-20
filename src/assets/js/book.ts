// Book mode: the article re-flowed into a two-column spread, paginated sideways.
//
// The heaviest island in the site, and the only one that is genuinely optional: the base
// page keeps its normal scroll, so nothing here affects reading, SEO or accessibility. It
// exists because a long essay reads better in columns than in one tall ribbon.
//
// A `<dialog>`, so Escape and the inert background come from the browser. The columns come
// from CSS `column-width`, and "turning a page" is one `scrollLeft` assignment: the browser
// has already done the pagination, and re-implementing it in JavaScript is how this kind of
// feature becomes a measurement loop that fights the layout engine.
//
// Book mode is its OWN standard rather than the site theme: paper and ink, not the reader's
// palette. That is deliberate, and carried over from the frozen tree.

import { el, label } from './dom'

const OUTER_MARGIN = 48 // px, the minimum gap from the spread to the viewport edge
const MAX_WIDTH = 1400 // px, so the spread does not sprawl on an ultrawide monitor
const COL_GAP = 56 // px between the two facing pages
// The narrowest a single page may be. Below twice this the spread becomes ONE page: on a
// 390px phone, halving the footprint and taking the gutter out of the middle left two
// columns of 119px, which is about ten characters — photographed with one word per line
// and a heading broken across three. A phone gets one page and the same sideways turn.
const MIN_COLUMN = 300
const FADE_MS = 130 // the spread-to-spread crossfade; 200 (the frozen tree's) read as sluggish

// The reader's type size, as a multiplier over the owner's roles. The DEFAULT lives in the
// stylesheet (--type-scale on .book-overlay); this island only writes an INLINE override
// when the reader has actually touched A−/A+, so an untouched reader always follows
// whatever default the sheet ships. Persisted per browser: a person who needs larger type
// needs it on every visit, not once.
const SCALE_KEY = 'quire-book-scale'
const SCALE_MIN = 0.85
const SCALE_MAX = 1.35
const SCALE_STEP = 0.05

export function book(): void {
  // ALL of them. There are two on an article now — the meta line above the title and the
  // info panel in the right gutter — and exactly one has a box at any width. Binding the
  // first match left the button dead on whichever layout lost the coin toss.
  const toggles = [...document.querySelectorAll<HTMLButtonElement>('[data-book-open]')]
  const source = document.querySelector<HTMLElement>('.prose')
  if (toggles.length === 0 || !source) return

  let dialog: HTMLDialogElement | null = null

  function open(): void {
    if (dialog) {
      dialog.showModal()
      return
    }
    const flow = el('div', { class: 'book-flow' })
    // A CLONE. The original stays in the document, so the page a search engine and a screen
    // reader see is untouched by anything that happens in here.
    flow.innerHTML = source!.innerHTML

    // The flow is also `.prose`, so the body keeps the article's own typography inside the
    // reader: the drop cap, the indents and the justification are the same rules.
    flow.classList.add('prose')
    const viewport = el('div', { class: 'book-viewport' }, flow)
    const page = el('span', { class: 'book-count' })

    // The spread INDEX is the state, not the scroll offset. A relative scrollBy accumulates
    // error, and this one accumulated a whole column gap per turn: the viewport is
    // 2*col + gap wide, but the third column starts at 2*(col + gap), so every turn drifted
    // 56px and by the third page the reader was looking at two half-columns.
    let spread = 0
    let step = 1
    let spreads = 1
    const goto = (index: number) => {
      const next = Math.min(Math.max(index, 0), spreads - 1)
      if (next === spread) return
      spread = next
      // The counter moves with the key, not with the animation: it says where you are
      // going, and a number that lags 200ms behind the arrow feels broken.
      update()
      // Fade out, jump, fade back in - the frozen tree's transition, and the reason a page
      // turn reads as a page turn rather than as a jolt. An instant scroll is what made it
      // feel broken even on the turns that landed correctly.
      viewport.style.opacity = '0'
      setTimeout(() => {
        viewport.scrollLeft = spread * step
        viewport.style.opacity = '1'
      }, FADE_MS)
    }
    const turn = (delta: number) => goto(spread + delta)
    // The spread is exactly TWO columns, sized to the page's own footprint. Leaving the
    // column count to `column-width` alone gave four thin columns running edge to edge,
    // which is a newspaper, not a book: a spread has to be two facing pages with margins.
    const measure = () => {
      // The spread spans the SAME footprint the page occupies, gutters included: the ToC
      // rail sits in the left one and the layout is centred, so the right mirrors it.
      // Falling back to near-full width when no rail is on screen.
      const rail = document.querySelector('.rail')?.getBoundingClientRect()
      const footprint = rail && rail.width > 0 && rail.left >= OUTER_MARGIN
        ? innerWidth - Math.round(rail.left) * 2
        : innerWidth - OUTER_MARGIN * 2
      const width = Math.min(MAX_WIDTH, footprint)
      const pages = width >= MIN_COLUMN * 2 + COL_GAP ? 2 : 1
      const column = pages === 2 ? Math.floor((width - COL_GAP) / 2) : width
      flow.style.setProperty('--book-col-w', `${column}px`)
      viewport.style.width = `${column * pages + COL_GAP * (pages - 1)}px`
      // Read by the stylesheet, which draws the spine down the CENTRE of the viewport: with
      // one page that line runs through the middle of the text instead of down a gutter.
      viewport.dataset.pages = String(pages)
      // One spread is one column PITCH per page. The pitch is the column plus the gap after
      // it, which is what the viewport width leaves out and what the old step got wrong.
      step = (column + COL_GAP) * pages
      // Cap media to one page, so an image can never push a column past the spread.
      flow.style.setProperty('--book-page-h', `${flow.clientHeight}px`)
      const columns = Math.max(1, Math.round(viewport.scrollWidth / (column + COL_GAP)))
      spreads = Math.max(1, Math.ceil(columns / pages))
      // A narrower window can leave the reader past the end.
      spread = Math.min(spread, spreads - 1)
      viewport.scrollLeft = spread * step
      update()
    }
    const update = () => {
      page.textContent = `${spread + 1} / ${spreads}`
    }

    const nav = (cls: string, glyph: string, delta: number, name: string) => {
      const b = el('button', { type: 'button', class: `book-arrow ${cls}`, 'aria-label': label(name) }, glyph)
      b.addEventListener('click', () => turn(delta))
      return b
    }
    const close = el('button', { type: 'button', class: 'book-x', 'aria-label': label('bookModeClose') }, '✕')

    // A− / A+. The current scale is read off the dialog's computed style, so the sheet's
    // default needs no copy here; a stored preference is applied as an inline override
    // before first measure, and every change re-measures — a bigger glyph is fewer lines
    // per column, which is a different page count.
    const smaller = el('button', { type: 'button', class: 'book-size book-smaller',
      'aria-label': label('bookModeSmaller') }, 'A−')
    const larger = el('button', { type: 'button', class: 'book-size book-larger',
      'aria-label': label('bookModeLarger') }, 'A+')
    const scaleOf = (): number => {
      const v = parseFloat(getComputedStyle(next).getPropertyValue('--type-scale'))
      return Number.isFinite(v) ? v : 1
    }
    const setScale = (v: number) => {
      const clamped = Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, v)) * 100) / 100
      next.style.setProperty('--type-scale', String(clamped))
      try { localStorage.setItem(SCALE_KEY, String(clamped)) } catch { /* private mode */ }
      smaller.disabled = clamped <= SCALE_MIN
      larger.disabled = clamped >= SCALE_MAX
      measure()
    }
    smaller.addEventListener('click', () => setScale(scaleOf() - SCALE_STEP))
    larger.addEventListener('click', () => setScale(scaleOf() + SCALE_STEP))
    // The title recedes: regular weight, faint, body size, so the article stays the focus.
    const heading = document.querySelector('article > header h1')?.textContent ?? ''
    const stage = el('div', { class: 'book-stage' },
      nav('book-prev', '‹', -1, 'bookModePrev'), viewport, nav('book-next', '›', 1, 'bookModeNext'))

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); turn(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1) }
    }

    const next = document.createElement('dialog')
    next.className = 'book-overlay'
    // A reader who has set their size gets it back before anything is measured.
    let stored = NaN
    try { stored = parseFloat(localStorage.getItem(SCALE_KEY) ?? '') } catch { /* private mode */ }
    if (Number.isFinite(stored)) {
      next.style.setProperty('--type-scale',
        String(Math.min(SCALE_MAX, Math.max(SCALE_MIN, stored))))
    }
    next.append(
      el('div', { class: 'book-chrome book-top' },
        el('span', { class: 'book-title' }, heading),
        el('span', { class: 'book-topright' }, smaller, larger, page, close)),
      stage,
    )
    close.addEventListener('click', () => next.close())
    next.addEventListener('close', () => {
      document.removeEventListener('keydown', onKey)
      removeEventListener('resize', measure)
      next.remove()
      dialog = null
    })
    // The column count changes with the window, and so does the page count.
    addEventListener('resize', measure)

    document.body.appendChild(next)
    dialog = next
    next.showModal()
    document.addEventListener('keydown', onKey)
    // In the document now, so the computed scale is readable — pin the ends of the range.
    smaller.disabled = scaleOf() <= SCALE_MIN
    larger.disabled = scaleOf() >= SCALE_MAX
    measure()
    // Images sit off-screen in later columns, so lazy-loading would never fire for them and
    // the measurement would count a spread that later grows.
    for (const img of flow.querySelectorAll('img')) img.loading = 'eager'
    document.fonts?.ready.then(measure)
  }

  for (const toggle of toggles) toggle.addEventListener('click', open)
}
