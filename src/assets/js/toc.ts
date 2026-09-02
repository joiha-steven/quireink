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

/**
 * The end-of-article facts exist TWICE, and only one copy is ever on screen.
 *
 * Below the rail breakpoint the tags and categories sit under the article; above it that
 * block is `display:none` and the same facts are in the gutter panel, at the TOP of the
 * article. The contents list's last row is server-rendered pointing at the block under the
 * article, which is right on a phone and wrong on a desktop: it jumped the reader a
 * screenful past the end of the prose to a zero-height anchor, landing on "Read next" with
 * no tag anywhere in sight. Measured on a 1466px window, 2026-09-02: 2,615px of scroll to
 * reach nothing the row named. Reported as issue #63.
 *
 * So the row follows the copy that is actually rendered. Re-decided on resize because the
 * thing that decides is a viewport width, and a window that crosses the breakpoint without
 * a reload would otherwise keep aiming at the copy that has just been hidden.
 *
 * With no JavaScript the row keeps the server's choice, which is the correct one at the
 * width where there is no gutter to hold the other copy.
 */
/** `post-tags` -> `post-info-tags`, the gutter panel's copy of the same row. */
const panelCopy = (id: string): string => id.replace('post-', 'post-info-')

export function toc(): void {
  const nav = document.querySelector<HTMLElement>('.toc')
  if (!nav) return
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
  if (!links.length) return

  // Read from the href each pass rather than captured once: `aim` rewrites the last row
  // when the layout changes, and a captured id would leave the highlight watching an
  // element that row no longer points at.
  const idOf = (a: HTMLAnchorElement): string => decodeURIComponent(a.getAttribute('href')!.slice(1))

  /**
   * Point the last row at the copy of the taxonomy that is on screen at this width.
   *
   * Stateless: the server's choice is recovered by undoing the swap rather than stashed on
   * the element, so crossing the breakpoint twice cannot leave a stale remembered value.
   */
  const aim = (): void => {
    const row = nav.querySelector<HTMLAnchorElement>('a.toc-end')
    if (!row) return
    const served = idOf(row).replace('post-info-', 'post-')
    const other = panelCopy(served)
    const panel = document.querySelector<HTMLElement>('.post-info')
    const gutter = panel && getComputedStyle(panel).display !== 'none'
    row.setAttribute('href', `#${gutter && document.getElementById(other) ? other : served}`)
  }
  aim()
  addEventListener('resize', aim, { passive: true })

  onScrollFrame(() => {
    let current: HTMLAnchorElement | null = null
    for (const link of links) {
      const el = document.getElementById(idOf(link))
      if (el && el.getBoundingClientRect().top <= READING_LINE) current = link
    }
    // Above the first heading nothing has passed the line, so the TITLE row is current —
    // which is why it is the fallback rather than "no row at all". The server marks it
    // with `is-active` for the no-script case, and that class has to move with the state
    // or the title stays lit while the reader is six sections down.
    // The title row is the one anchor with no element behind it (#top scrolls the
    // document). Falling back to `targets[0]` instead would light the first HEADING while
    // the reader is still above it, which is a different claim.
    const lit = current ?? links.find((a) => idOf(a) === 'top') ?? null
    for (const link of links) {
      const on = link === lit
      link.classList.toggle('is-active', on)
      if (on) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
    }
  })
}
