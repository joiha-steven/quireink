// The table of contents, and the one thing about it that needs a script: knowing which
// section the reader is in.
//
// The LIST itself is server-rendered, so a reader without JavaScript gets a working index
// of the article — which is most of the value. This file only adds the highlight.
//
// The current section is the LAST heading that has passed the reading line, not the one
// crossing the viewport. An IntersectionObserver on the headings alone goes blank in the
// middle of a long section: the heading has already scrolled away, so nothing intersects
// and no row is marked.

import { onScrollFrame } from './dom'

const READING_LINE = 120 // px from the top of the viewport

export function toc(): void {
  const nav = document.querySelector<HTMLElement>('.toc')
  if (!nav) return
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
  if (!links.length) return

  const targets = links.map((link) => ({
    link,
    id: decodeURIComponent(link.getAttribute('href')!.slice(1)),
  }))

  onScrollFrame(() => {
    let current: HTMLAnchorElement | null = null
    for (const { link, id } of targets) {
      const el = document.getElementById(id)
      if (el && el.getBoundingClientRect().top <= READING_LINE) current = link
    }
    // Above the first heading nothing has passed the line, so the TITLE row is current —
    // which is why it is the fallback rather than "no row at all". The server marks it
    // with `is-active` for the no-script case, and that class has to move with the state
    // or the title stays lit while the reader is six sections down.
    // The title row is the one anchor with no element behind it (#top scrolls the
    // document). Falling back to `targets[0]` instead would light the first HEADING while
    // the reader is still above it, which is a different claim.
    const lit = current ?? targets.find((x) => x.id === 'top')?.link ?? null
    for (const { link } of targets) {
      const on = link === lit
      link.classList.toggle('is-active', on)
      if (on) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
    }
  })
}
