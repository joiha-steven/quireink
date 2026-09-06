// Book mode ON A PHONE: one column, scrolled, with the chrome that gets out of the way.
//
// A separate door from the desktop spread, and the reason is the browser's own furniture.
// The spread is a <dialog>, and a modal dialog takes the scroll off the document — which on
// iOS means Safari's address bar and toolbar STAY, because they only retract while the page
// itself is scrolling. Measured on an iPhone: 844px of glass, 190px of it Safari's, another
// 56 of ours, leaving under 600 for the words; turning nineteen pages of that is turning a
// page every four sentences.
//
// So on a phone the reader is not a dialog at all. The page's own content is hidden, the
// article is laid out as one tall column IN THE DOCUMENT, and the reader scrolls the
// document — which is what hands the toolbars back to the words. Leaving book mode puts the
// page back exactly where it was, scroll position included.
//
// The chrome then behaves the way a reading app's does: gone on the way down, back on the
// way up, always one short scroll away. It is fixed rather than sticky so that Safari
// collapsing its own bars does not shove it around mid-gesture.
import { el, label, onScrollFrame } from './dom'

/** Where the article was before the reader opened it, so closing is exact rather than near. */
type Session = { close: () => void }

/**
 * The a / A pair, and the reader's stored preference — ONE definition for both readers.
 *
 * The spread and the phone reader need the same control, the same clamps and the same
 * stored value, and the only thing that differs is what has to happen afterwards: the
 * spread re-paginates, the scrolled column does not.
 */
export function sizeControl(limits: { min: number; max: number; step: number; key: string }, after: () => void) {
  const smaller = el('button', { type: 'button', class: 'book-size book-smaller',
    'aria-label': label('bookModeSmaller'), title: label('bookModeSmaller') }, 'a')
  const larger = el('button', { type: 'button', class: 'book-size book-larger',
    'aria-label': label('bookModeLarger'), title: label('bookModeLarger') }, 'A')
  const sizes = el('span', { class: 'book-sizes' }, smaller, larger)
  let host: HTMLElement | null = null
  const read = (): number => {
    const v = host ? parseFloat(getComputedStyle(host).getPropertyValue('--type-scale')) : NaN
    return Number.isFinite(v) ? v : 1
  }
  const set = (v: number) => {
    const c = Math.round(Math.min(limits.max, Math.max(limits.min, v)) * 100) / 100
    host?.style.setProperty('--type-scale', String(c))
    try { localStorage.setItem(limits.key, String(c)) } catch { /* private mode */ }
    smaller.disabled = c <= limits.min
    larger.disabled = c >= limits.max
    after()
  }
  smaller.addEventListener('click', () => set(read() - limits.step))
  larger.addEventListener('click', () => set(read() + limits.step))
  return {
    sizes,
    /** Bind to the element the scale lives on, apply anything stored, and pin the ends. */
    attach(el: HTMLElement) {
      host = el
      let stored = NaN
      try { stored = parseFloat(localStorage.getItem(limits.key) ?? '') } catch { /* private mode */ }
      if (Number.isFinite(stored)) {
        el.style.setProperty('--type-scale', String(Math.min(limits.max, Math.max(limits.min, stored))))
      }
      smaller.disabled = read() <= limits.min
      larger.disabled = read() >= limits.max
    },
  }
}

export function openScrollReader(
  source: HTMLElement,
  heading: string,
  chrome: { sizes: HTMLElement; onScale: (el: HTMLElement) => void },
): Session {
  const html = document.documentElement
  const wasAt = scrollY

  const flow = el('div', { class: 'book-flow prose' })
  // A CLONE, like the spread's: the document's own article is untouched, so a screen reader
  // and a crawler see exactly what they saw before.
  flow.innerHTML = source.innerHTML

  const close = el('button', {
    type: 'button', class: 'book-x', 'aria-label': label('bookModeClose'), title: label('bookModeClose'),
  }, '✕')
  const bar = el('div', { class: 'book-chrome book-top' },
    el('span', { class: 'book-title' }, heading),
    el('span', { class: 'book-topright' }, chrome.sizes, close))
  const reader = el('div', { class: 'book-reader' }, bar, el('div', { class: 'book-page' }, flow))
  chrome.onScale(reader)

  // Hidden by CSS (`html.book-reading body > :not(.book-reader)`) rather than by touching
  // every sibling: one rule reverses cleanly, and nothing in the page has to be remembered
  // and put back.
  // VIEWPORT-FIT=COVER, for the length of the read only.
  //
  // Without it iOS keeps the page below the status bar and the paper stops at a seam a
  // centimetre from the top of the glass — which is the whole difference the owner
  // photographed between this reader and an ordinary page. With it the paper runs edge to
  // edge, `env(safe-area-inset-top)` starts reporting a real number, and the stylesheet uses
  // that for both the top padding and the strip that catches a line scrolling under the
  // clock. Put back on close: it is the reader's frame, not the site's.
  // The original is restored on close, so appending unconditionally cannot accumulate.
  // Always present: `layout.ts` writes it into every page this island can run on.
  const meta = document.querySelector<HTMLMetaElement>('meta[name=viewport]')!
  const viewport = meta.content
  meta.content = viewport + ', viewport-fit=cover'

  html.classList.add('book-reading')
  document.body.appendChild(reader)
  scrollTo(0, 0)

  // THE CHROME FOLLOWS THE DIRECTION, not the position: away on the way down, back on the
  // way up. The 8px threshold is what keeps it still — iOS reports a few pixels of scroll
  // from the rubber-band at both ends and from its own bars resizing the viewport, and
  // without it the bar flickered on and off while the thumb was doing nothing.
  let last = 0
  const stop: () => void = onScrollFrame(() => {
    const y = Math.max(0, scrollY)
    if (Math.abs(y - last) < 8) return
    // Always visible at the very top: that is where a reader looks for the way out.
    reader.classList.toggle('chrome-away', y > last && y > 64)
    last = y
  })

  const teardown = () => {
    html.classList.remove('book-reading')
    reader.remove()
    stop()
    removeEventListener('keydown', onKey)
    removeEventListener('popstate', onPop)
    // AFTER TWO FRAMES, and it is not politeness. The page's own content is display:none
    // until the class comes off, so at this instant the document is barely taller than the
    // window and a scroll to where the reader was is clamped to 0 — measured: asked for 700,
    // got 0, and a reader who was halfway down came back to the top. The second frame is for
    // the browser's own restoration on a popstate, which lands after the first.
    requestAnimationFrame(() => requestAnimationFrame(() => scrollTo(0, wasAt)))
    meta.content = viewport
    try { history.scrollRestoration = restoration } catch { /* see above */ }
    dispatchEvent(new Event('quire:book-closed'))
  }
  // The ✕ leaves through the SAME door the back gesture uses, rather than tearing down and
  // then also popping: doing both ran the teardown twice and let the browser's own scroll
  // restoration land between them, which is how a reader who was 700px in came back at 0.
  const shut = () => {
    if ((history.state as { quireBook?: number } | null)?.quireBook) history.back()
    else teardown()
  }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') shut() }
  // The phone's own way back. A reader who swipes in from the edge expects to leave the
  // READER, not the article — without this they left the page entirely.
  const onPop = () => teardown()
  close.addEventListener('click', shut)
  addEventListener('keydown', onKey)
  // Ours, not the browser's: it restores the scroll of the entry being returned to, which
  // here is the same document with everything hidden — so it would put the reader at 0 and
  // the line below could not correct it in time.
  const restoration = history.scrollRestoration
  try {
    history.scrollRestoration = 'manual'
    history.pushState({ quireBook: 1 }, '')
  } catch { /* file:// and the like */ }
  addEventListener('popstate', onPop)

  // Later images are far down one long column rather than off to the side, so lazy loading
  // is right here — the opposite of the spread, where it would never fire at all.
  return { close: shut }
}
