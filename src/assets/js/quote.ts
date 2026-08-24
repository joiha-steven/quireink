// Select a sentence, and take it with you.
//
// This is the one reading gesture the platforms this product is measured against all have
// and this one did not: on Medium a selection raises a small menu, and that menu is why
// their sentences travel. Selecting text here did nothing at all.
//
// What it copies is deliberately NOT a share button. There is no third party in this
// product and no account behind it, so the useful version is the one a reader can paste
// anywhere: the sentence, and a link that opens the post scrolled to that exact sentence.
//
// The link is a TEXT FRAGMENT (`#:~:text=`), which is why nothing in the renderer had to
// change. Paragraphs have no ids and are not getting any: adding them would rewrite the
// HTML that `golden/` holds as the contract for what this renderer prints. A browser that
// does not know text fragments simply opens the post at the top, which is the same thing
// the link would have done anyway — the definition of a gesture that may be added freely.

import { el, label } from './dom'

/** Below this, a selection is a click that slipped rather than a quote. */
const MIN_CHARS = 12
/** Longer than this is anchored on its ends instead of carried whole. */
const MAX_WHOLE = 44
/** How much of each end anchors a long quote. Four Vietnamese words, give or take. */
const ANCHOR = 20

/**
 * Escape ONLY what the fragment syntax cannot carry, and leave every letter alone.
 *
 * `encodeURIComponent` was the first version and it is what made the link unreadable: it
 * percent-encodes every non-ASCII byte, so one Vietnamese word became nine characters of
 * hex and a quoted sentence came out as a wall of %E1%BA%BF. Nothing requires that. A URL
 * fragment may carry UTF-8 as it is; what it may NOT carry is whitespace, and what this
 * particular syntax may not carry is `-` (it separates a prefix from its text), `,` (it
 * separates start from end) and `#` (it would end the fragment). `%` goes first or the
 * escapes would escape each other, and the three angle-and-quote characters go too because
 * a URL that lands in HTML somewhere should not be able to open a tag.
 */
const enc = (part: string) =>
  part.replace(/[%&,\-#"<>`\s]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)

/** Trim a slice back to a whole word, unless that would leave nothing. */
const words = (slice: string, from: 'start' | 'end') => {
  const cut = from === 'start' ? slice.replace(/\s+\S*$/, '') : slice.replace(/^\S*\s+/, '')
  return cut || slice
}

/**
 * The `#:~:text=` fragment for a quote.
 *
 * Short quotes travel whole, so the reader who follows the link sees exactly the sentence
 * that was quoted. A long one is anchored on its two ends — the syntax's own answer, and
 * the reason a link to a paragraph is not a paragraph of link.
 */
function fragment(quote: string): string {
  if (quote.length <= MAX_WHOLE) return `:~:text=${enc(quote)}`
  const head = words(quote.slice(0, ANCHOR), 'start')
  const tail = words(quote.slice(-ANCHOR), 'end')
  return `:~:text=${enc(head)},${enc(tail)}`
}

export function quote(): void {
  const prose = document.querySelector<HTMLElement>('.prose')
  const text = label('quoteCopy')
  // No clipboard, no button. A control that cannot do its one job is worse than no control,
  // and that is every page served over plain http.
  if (!prose || !text || !navigator.clipboard?.writeText) return

  const button = el('button', { type: 'button', class: 'quote-copy', hidden: '' }, text)
  document.body.appendChild(button)
  let picked = ''
  let timer = 0

  const hide = () => {
    button.hidden = true
    button.textContent = text
  }

  const update = () => {
    const selection = window.getSelection()
    const range = selection && !selection.isCollapsed && selection.rangeCount
      ? selection.getRangeAt(0)
      : null
    // Both ends inside the article, or it is not a quote from the article.
    if (!range || !prose.contains(range.commonAncestorContainer)) return hide()
    picked = selection!.toString().replace(/\s+/g, ' ').trim()
    if (picked.length < MIN_CHARS) return hide()
    const box = range.getBoundingClientRect()
    button.hidden = false
    // Above the selection, centred on it, clamped inside the viewport. Positioned in
    // DOCUMENT space, so the scroll offsets are part of the sum.
    const w = button.offsetWidth
    const x = Math.min(Math.max(8, box.left + box.width / 2 - w / 2),
      document.documentElement.clientWidth - w - 8)
    button.style.left = `${x + window.scrollX}px`
    // BELOW the selection on a touch screen, above it otherwise. iOS and Android both put
    // their own Copy / Look Up callout above a selection, and two menus in one place is one
    // menu the reader cannot press.
    const y = matchMedia('(hover: none)').matches
      ? box.bottom + 8
      : box.top - button.offsetHeight - 8
    button.style.top = `${y + window.scrollY}px`
  }

  // ONE listener, debounced. `selectionchange` fires continuously while a drag is in
  // progress, so acting on every one of them makes the button chase the cursor; a beat of
  // stillness is also how a reader signals they have finished choosing.
  document.addEventListener('selectionchange', () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(update, 150)
  })
  document.addEventListener('scroll', hide, { passive: true })

  button.addEventListener('mousedown', (e) => e.preventDefault()) // keep the selection alive
  button.addEventListener('click', () => {
    // Built by hand rather than through `new URL()`, and that is the whole point: the URL
    // serializer percent-encodes every non-ASCII code point in a fragment, which is what
    // turned a Vietnamese sentence into 200 characters of hex. `location.href` minus any
    // fragment it already carries, plus this one.
    const link = location.href.split('#')[0] + '#' + fragment(picked)
    // Two lines, because that is how a quote is pasted into a message: the words, then
    // where they came from.
    void navigator.clipboard.writeText(`“${picked}”\n${link}`).then(() => {
      button.textContent = label('quoteCopied') || text
      timer = window.setTimeout(hide, 1200)
    }, hide)
  })
}
