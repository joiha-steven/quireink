// Book mode: the article re-flowed into a two-column spread, paginated sideways.
//
// The heaviest island in the site, and the only one that is genuinely optional: the base
// page keeps its normal scroll, so nothing here affects reading, SEO or accessibility. It
// exists because a long essay reads better in columns than in one tall ribbon.
//
// A `<dialog>`, so Escape and the inert background come from the browser. The columns come
// from CSS `column-width`, and "turning a page" is one transform on the flow under a
// clipping viewport: the browser has already done the pagination, and re-implementing it
// in JavaScript is how this kind of feature becomes a measurement loop that fights the
// layout engine. (It was one `scrollLeft` assignment until Chrome 148 stopped treating a
// multicol's overflow columns as scrollable overflow — the comment in `goto` has the
// measurements.)
//
// Book mode is its OWN standard rather than the site theme: paper and ink, not the reader's
// palette. That is deliberate, and carried over from the frozen tree.

import { el, label, onScrollFrame } from './dom'

const OUTER_MARGIN = 48 // px, the minimum gap from the spread to the viewport edge
// A phone cannot afford the desktop's margins: 48px a side took 96 of a 375px screen —
// a quarter of the glass — and set the page at 279px, far too much margin. 20px keeps
// the page off the bezel and gives the words 335px. Under 640, matching mobile.css.ts.
const PHONE_MARGIN = 20
const MAX_WIDTH = 1400 // px, so the spread does not sprawl on an ultrawide monitor
const COL_GAP = 56 // px between the two facing pages
// The narrowest a single page may be. Below twice this the spread becomes ONE page: on a
// 390px phone, halving the footprint and taking the gutter out of the middle left two
// columns of 119px, which is about ten characters — photographed with one word per line
// and a heading broken across three. A phone gets one page and the same sideways turn.
// 280 rather than 300 since 2026-08-31, for the unfolded foldable: its two pages come out
// at 288px — about 33 characters at the book's type size, a paperback page, and well clear
// of the 119px failure this floor exists to stop.
const MIN_COLUMN = 280
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
      //
      // A TRANSFORM, not scrollLeft, since 2026-08-21. Chrome 148 stopped counting a
      // multicol's overflow columns as scrollable overflow: measured on this page,
      // flow.scrollWidth said 3,964px while viewport.scrollWidth said 279 and an assigned
      // scrollLeft snapped straight back to 0 — so the reader was shown "1 / 1" of a
      // twelve-column article and every turn was a dead click, on every instance, with no
      // error anywhere. The columns are still laid out; only the scroll machinery went
      // blind to them. Translating the flow under the clipping viewport asks nothing of
      // scroll semantics, so it cannot regress the same way.
      viewport.style.opacity = '0'
      setTimeout(() => {
        flow.style.transform = `translateX(${-spread * step}px)`
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
      const margin = innerWidth < 640 ? PHONE_MARGIN : OUTER_MARGIN
      const rail = document.querySelector('.rail')?.getBoundingClientRect()
      let footprint = rail && rail.width > 0 && rail.left >= margin
        ? innerWidth - Math.round(rail.left) * 2
        : innerWidth - margin * 2
      // AN UNFOLDED FOLDABLE IS 673px AND SHAPED LIKE A BOOK, and the desktop margins were
      // what kept it from getting one: 48px a side left 577px, 39px short of two pages, so
      // it fell back to a single 577px column — an ~80-character measure with the fold's
      // crease running through every line of it. When the glass holds two pages inside the
      // phone margins, the margins yield rather than the second page: 673 now gives two
      // 288px pages with the crease inside the gutter. Above 752px the full margins fit
      // beside a spread anyway, so nothing wider moves.
      const spreadMin = MIN_COLUMN * 2 + COL_GAP
      if (footprint < spreadMin && innerWidth - PHONE_MARGIN * 2 >= spreadMin) {
        footprint = innerWidth - PHONE_MARGIN * 2
      }
      const width = Math.min(MAX_WIDTH, footprint)
      const pages = width >= spreadMin ? 2 : 1
      const column = pages === 2 ? Math.floor((width - COL_GAP) / 2) : width
      // NO Viewport Segments branch, and that is a measurement, not an oversight: on
      // continuous-glass folds the API reports the panes meeting at 0px, so a per-pane
      // page (pane − 20 margin − 28 half-gutter) and the yielded-margin page above
      // ((width − 40 − 56) / 2) are the SAME arithmetic — vw/2 − 48 — pixel for pixel.
      // The branch only ever differs on a dual-screen device with a physical seam, and it
      // cost 378 bytes of a post.js budget with 123 to spare. If hinged hardware returns,
      // the gutter needs to become a CSS variable sized to at least the hinge; until then
      // the spread is centred and the fold falls in the gutter by symmetry.
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
      // The FLOW's own scrollWidth, never the viewport's: Chrome 148 reports the overflow
      // columns on the multicol element itself and nothing on its parent (3,964 vs 279 on
      // the page this was caught on), and counting spreads off the blind number is how the
      // whole book silently became one page. Width back to auto first, so a re-measure
      // (resize, A−/A+) counts the columns the CONTENT wants, not the width set below.
      flow.style.width = 'auto'
      const columns = Math.max(1, Math.round(flow.scrollWidth / (column + COL_GAP)))
      // Then the flow is widened to hold every column as a REAL column box. Chrome lays
      // overflow columns out (their rects measure correctly) but no longer paints them, so
      // page 2 of a translated flow came up blank paper: the words were positioned there
      // and never drawn. Sized to fit, the columns stop being overflow and paint again.
      flow.style.width = `${columns * (column + COL_GAP) - COL_GAP}px`
      spreads = Math.max(1, Math.ceil(columns / pages))
      // A narrower window can leave the reader past the end.
      spread = Math.min(spread, spreads - 1)
      flow.style.transform = `translateX(${-spread * step}px)`
      update()
    }
    const update = () => {
      page.textContent = `${spread + 1} / ${spreads}`
      // A one-spread article has nowhere to turn to: the arrows leave rather than sit
      // dead at the margins. They come back by the same line when a resize adds pages.
      prev.hidden = fwd.hidden = spreads <= 1
    }

    const nav = (cls: string, glyph: string, delta: number, name: string) => {
      const b = el('button', { type: 'button', class: `book-arrow ${cls}`, 'aria-label': label(name) }, glyph)
      b.addEventListener('click', () => turn(delta))
      return b
    }
    const prev = nav('book-prev', '‹', -1, 'bookModePrev')
    const fwd = nav('book-next', '›', 1, 'bookModeNext')
    const close = el('button', { type: 'button', class: 'book-x',
      'aria-label': label('bookModeClose'), title: label('bookModeClose') }, '✕')

    // a / A — the size itself is the label, the way every e-reader draws it, and the pair
    // is plain type rather than a control (the pill + divider read as buttons, and a black
    // seam showed between them on first paint). The current scale is
    // read off the dialog's computed style, so the sheet's default needs no copy here; a
    // stored preference is applied as an inline override before first measure, and every
    // change re-measures — a bigger glyph is fewer lines per column, which is a different
    // page count.
    const smaller = el('button', { type: 'button', class: 'book-size book-smaller',
      'aria-label': label('bookModeSmaller'), title: label('bookModeSmaller') }, 'a')
    const larger = el('button', { type: 'button', class: 'book-size book-larger',
      'aria-label': label('bookModeLarger'), title: label('bookModeLarger') }, 'A')
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
    // `autofocus` steers showModal(): without it the dialog focuses the FIRST focusable
    // element, which is the size control — and the focus ring around that little glyph is
    // the "black seam" the owner photographed. Initial focus belongs on the stage (where
    // the arrow keys already live); tabbing still reaches every button, ring intact.
    const stage = el('div', { class: 'book-stage', tabindex: '-1', autofocus: '' }, prev, viewport, fwd)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); turn(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1) }
    }

    // The phone turns pages the way every e-reader does: a horizontal swipe, or a tap in
    // the outer thirds of the page — the stylesheet retires the hover-sized arrows under
    // 640px, where they were overlaying a margin the phone no longer spares. The swipe
    // wants a clear horizontal intent (48px, and 1.5x more sideways than down) so an
    // ordinary reading scroll never turns a page; the tap ignores anything interactive so
    // a link stays a link, and the middle third stays inert because a thumb needs
    // somewhere safe to rest.
    let x0 = 0, y0 = 0
    viewport.addEventListener('touchstart', (e) => {
      x0 = e.touches[0]!.clientX; y0 = e.touches[0]!.clientY
    }, { passive: true })
    viewport.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0]!.clientX - x0, dy = e.changedTouches[0]!.clientY - y0
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1)
    }, { passive: true })
    viewport.addEventListener('click', (e) => {
      if (innerWidth >= 640) return
      if ((e.target as HTMLElement).closest('a,button')) return
      const x = e.clientX / innerWidth
      if (x < 0.35) turn(-1)
      else if (x > 0.65) turn(1)
    })

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
        el('span', { class: 'book-topright' },
          // The two size buttons are ONE control and now look like it. Four evenly spaced
          // glyphs in a row (A− A+ 1/3 ✕) read as a string of characters rather than as
          // three separate things, which is what made the control hard to read.
          el('span', { class: 'book-sizes' }, smaller, larger),
          page,
          close)),
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

  // The phone's doorway. Both server-rendered entries hide under 768px (the meta line is
  // cramped there), which left the reader no way in at all on the one class of device
  // where the overlay already runs its one-page mode. The button is a twin of the to-top
  // circle one slot up the same column — same size, same fade, same trigger — so the two
  // read as one quiet cluster that only exists once the reader has scrolled past the
  // first viewport. Desktop never sees it: the stylesheet keeps it display:none there.
  const fabText = label('bookMode')
  const fab = el('button', { type: 'button', class: 'book-fab', 'aria-label': fabText, title: fabText })
  fab.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M12 6.5C10.4 5.2 8.4 4.5 6 4.5H4v13h2c2.4 0 4.4.7 6 2 1.6-1.3 3.6-2 6-2h2v-13h-2c-2.4 0-4.4.7-6 2z"/>'
    + '<path d="M12 6.5v13"/></svg>'
  fab.addEventListener('click', open)
  document.body.appendChild(fab)
  onScrollFrame(() => {
    fab.classList.toggle('shown', scrollY > innerHeight)
  })
}
