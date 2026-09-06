// A "scroll to top" button that fades in once the reader is past the first viewport.

import { el, label } from './dom'
import { onScrollFrame, scrollBehavior } from './motion'

export function backToTop(): void {
  const text = label('backToTop')
  const btn = el('button', { type: 'button', class: 'to-top', 'aria-label': text, title: text })
  // The glyph is inline SVG rather than a font character so it needs no icon font and
  // inherits `currentColor` from the theme.
  btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="m18 15-6-6-6 6"/></svg>'
  btn.addEventListener('click', () => scrollTo({ top: 0, behavior: scrollBehavior() }))
  document.body.appendChild(btn)

  onScrollFrame(() => scrollY > innerHeight, (past) => btn.classList.toggle('shown', past))
}
