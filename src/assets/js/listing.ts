// The one thing a reader can do to a list of posts: change its shape.
//
// Opt-in per site (`features.gridView`) and self-guarding on markup, so on a site with it
// switched off this file does one failed query and stops.
//
// Infinite scroll is here again, and it is a fetch of the next page's HTML. It was removed
// when the server started rendering every card and hiding the tail; that is fine at thirty
// posts and is 450 KB on a five-hundred-post blog, on every visit, held per URL in the page
// cache. So the server now sends three chunks and a real link to the next page, and this
// asks for the rest as the reader arrives. Scroll reveal stays the CSS `reveal` animation.

import { label } from './dom'

const STORE_KEY = 'quire:list'

/**
 * List or grid, remembered.
 *
 * KNOWN COST, and it is a real one: the frozen tree applied the saved choice with a
 * pre-paint inline script, so a reader who chose grid never saw the list. 2.0 has no inline
 * script anywhere — that property is tested, and the article page's script count is a
 * number in an assertion — so the attribute is applied when `core.js` runs, and a grid
 * reader may see one frame of list first.
 *
 * The alternatives were both worse. An inline script would be the only one on the site. A
 * cookie would let the server render it, but the page cache is keyed by URL alone
 * (Invariant 1), so a cached page would carry whichever mode the first visitor had.
 */
function gridToggle(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-grid-toggle]')
  if (!button) return

  // Nothing to toggle on a page with no list: a reading view, /search, a 404.
  if (!document.querySelector('.post-list')) {
    button.hidden = true
    return
  }

  // ONE name, and `aria-pressed` carries the state. Swapping the label as well as the state
  // meant a screen reader announced "List view, toggle button, pressed" in grid: the name
  // said one thing and the state said the other, and a toggle is a control that has one name
  // and two states.
  button.setAttribute('aria-label', label('gridView'))
  const apply = (grid: boolean) => {
    document.documentElement.dataset.list = grid ? 'grid' : 'list'
    button.setAttribute('aria-pressed', String(grid))
  }

  let grid = false
  try {
    grid = localStorage.getItem(STORE_KEY) === 'grid'
  } catch {
    /* storage can be denied; the default is then simply not remembered */
  }
  apply(grid)

  button.addEventListener('click', () => {
    grid = !grid
    apply(grid)
    try {
      localStorage.setItem(STORE_KEY, grid ? 'grid' : 'list')
    } catch {
      /* ignore */
    }
  })
}

/**
 * Fetch the next page of the feed as the reader nears the end, and ease each card in.
 *
 * The server sends three chunks and a link to the next page. Nothing on the page is hidden:
 * the frozen tree kept the tail in React state, and 2.0 rendered every card and hid what was
 * past the first page, which meant each reveal moved the footer under a reader who had
 * already reached it. A capped page needs neither.
 *
 * The reveal ANIMATION is CSS (`animation-timeline: view()`). This only arms the fallback
 * for an engine that has no view() timelines, and only for cards that are not already on
 * screen — hiding something above the fold to fade it in is a flash, not an effect.
 */
function moreOnScroll(): void {
  const feed = document.querySelector<HTMLElement>('.post-list')
  if (!feed) return
  const html = document.documentElement

  // The reveal ANIMATION is CSS. This arms the fallback only where view() timelines do not
  // exist, and marks whatever is already on screen as arrived first: hiding something above
  // the fold in order to fade it in is a flash, not an effect.
  // The owner's switch first: with the fade off nothing is armed, so a Firefox reader sees
  // the same solid list as everyone else rather than the fallback still hiding cards.
  if (html.dataset.scrollFade === 'on'
    && CSS.supports?.('animation-timeline', 'view()') !== true && html.dataset.motion !== 'off') {
    for (const c of feed.querySelectorAll<HTMLElement>('.reveal')) {
      if (c.getBoundingClientRect().top < innerHeight) c.classList.add('is-in')
    }
    html.dataset.revealJs = 'on'
    const seen = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) e.target.classList.add('is-in')
    }, { rootMargin: '0px 0px -10% 0px' })
    for (const c of feed.querySelectorAll('.reveal:not(.is-in)')) seen.observe(c)
  }

  // The tail of the archive, fetched a page at a time as the reader reaches it.
  //
  // The link is the address of the next page AND the fallback. Hidden while this runs;
  // shown again the moment a fetch fails, so the worst case is a page with a link on it.
  const nav = document.querySelector<HTMLElement>('[data-feed-more]')
  const link = nav?.querySelector<HTMLAnchorElement>('a[rel=next]') ?? null
  if (!link) return
  nav!.hidden = true
  let loading = false

  /**
   * Two feeds into one, without a year printed twice.
   *
   * Each `.tl-yr` carries its year marker as its first child, so appending page two whole
   * prints the year again the moment a page boundary falls inside one. When the years match
   * only the cards move across.
   */
  const merge = (incoming: Element): void => {
    for (const group of incoming.querySelectorAll<HTMLElement>('.tl-yr')) {
      const last = feed.querySelector<HTMLElement>('.tl-yr:last-of-type')
      const sameYear = last?.querySelector('.tl-year-tag')?.textContent
        === group.querySelector('.tl-year-tag')?.textContent
      if (last && sameYear) last.append(...group.querySelectorAll('article'))
      else feed.append(group)
    }
  }

  const fetchNext = async (): Promise<void> => {
    if (loading) return
    loading = true
    try {
      // `throw res` rather than a new Error: the catch below ignores what it caught and
      // only cares that something went wrong, so the message would be bytes on every page.
      const res = await fetch(link.href)
      if (!res.ok) throw res
      // A template rather than `DOMParser`: its contents are inert, it is smaller, and
      // only the body of the answer is wanted.
      const doc = document.createElement('template')
      doc.innerHTML = await res.text()
      const incoming = doc.content.querySelector('.post-list')
      if (!incoming) throw res
      merge(incoming)
      // The next address is taken as the RELATIVE href it was written as: a detached
      // fragment has no base URL of its own to resolve one against.
      const onward = doc.content.querySelector('[data-feed-more] a[rel=next]')?.getAttribute('href')
      loading = false
      if (!onward) { nav!.remove(); return }
      link.setAttribute('href', onward)
      arm()
    } catch {
      // Whatever went wrong, the reader keeps a way onward.
      loading = false
      nav!.hidden = false
    }
  }

  // Two viewports of rootMargin rather than a fixed 600px: on a phone one flick travels
  // further than 600px between frames, so the next page arrived after the footer had
  // already moved up under the reader's eyes.
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return
    io.disconnect()
    void fetchNext()
  }, { rootMargin: `${innerHeight * 2}px 0px` })

  // The sentinel is the LAST CARD: the link itself is hidden, and a hidden element has no
  // box, so it never intersects anything.
  const arm = (): void => {
    const cards = feed.querySelectorAll<HTMLElement>('article')
    const last = cards[cards.length - 1]
    if (last) io.observe(last)
  }
  arm()
}

export function listing(): void {
  gridToggle()
  moreOnScroll()
}
