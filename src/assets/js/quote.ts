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
/** Longer than this goes as start,end — the fragment syntax's own answer to long ranges. */
const MAX_FRAGMENT = 60

/**
 * The `#:~:text=` fragment for a quote.
 *
 * Percent-encoding is not optional and `encodeURIComponent` is not enough on its own: `-`
 * is the fragment syntax's separator between prefix and text and `,` splits start from end,
 * so both have to be escaped even though the encoder leaves them alone.
 */
function fragment(quote: string): string {
  const enc = (part: string) => encodeURIComponent(part).replace(/-/g, '%2D').replace(/,/g, '%2C')
  if (quote.length <= MAX_FRAGMENT) return `:~:text=${enc(quote)}`
  return `:~:text=${enc(quote.slice(0, 30).replace(/\s+\S*$/, ''))},${enc(quote.slice(-30).replace(/^\S*\s+/, ''))}`
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
    const url = new URL(location.href)
    url.hash = fragment(picked)
    // Two lines, because that is how a quote is pasted into a message: the words, then
    // where they came from.
    void navigator.clipboard.writeText(`“${picked}”\n${url.href}`).then(() => {
      button.textContent = label('quoteCopied') || text
      timer = window.setTimeout(hide, 1200)
    }, hide)
  })
}
