// The one thing a reader can do to a list of posts: change its shape.
//
// Opt-in per site (`features.gridView`) and self-guarding on markup, so on a site with it
// switched off this file does one failed query and stops.
//
// Infinite scroll used to live here too, as a fetch of the next page's HTML. It does not
// any more: a site with `features.infiniteScroll` on has no pagination at all — the feed is
// one year-grouped timeline and `/page/2` is a 404, exactly as in the frozen tree — so
// there was no next page left to fetch. Scroll reveal is now the CSS `reveal` animation.

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

  const apply = (grid: boolean) => {
    document.documentElement.dataset.list = grid ? 'grid' : 'list'
    button.setAttribute('aria-pressed', String(grid))
    button.setAttribute('aria-label', label(grid ? 'listView' : 'gridView'))
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
 * Hand the feed back a chunk at a time, and ease each card in.
 *
 * The frozen tree kept the tail of the archive in React state and revealed `postsPerPage`
 * at a time as a sentinel neared the viewport. The server here renders every card, so the
 * archive survives with no JavaScript and a crawler sees all of it — this hides what is
 * past the first page and gives it back on the same trigger. `rootMargin` is the frozen
 * tree's 600px, so the next chunk is already there when the reader arrives.
 *
 * The reveal ANIMATION is CSS (`animation-timeline: view()`). This only arms the fallback
 * for an engine that has no view() timelines, and only for cards that are not already on
 * screen — hiding something above the fold to fade it in is a flash, not an effect.
 */
function chunked(): void {
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

  // The tail of the archive, handed back a page at a time as the reader reaches it. The
  // step is what the server withheld, read off the markup so there is one source for it.
  const more = [...feed.querySelectorAll<HTMLElement>('article[data-more]')]
  if (!more.length) return
  html.dataset.chunked = 'on'
  const step = Math.max(1, feed.querySelectorAll('article').length - more.length)

  // 600px of rootMargin, as the frozen tree used: the next chunk is already in place by the
  // time the reader gets there, so the feed never visibly stops.
  //
  // The sentinel is the LAST VISIBLE card, not the first hidden one. A hidden card is
  // display:none, so it has no box, so it never intersects anything - observing it meant
  // the feed stopped dead at twenty posts and no amount of scrolling moved it.
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return
    io.disconnect()
    for (const c of more.splice(0, step)) c.removeAttribute('data-more')
    if (!more.length) delete html.dataset.chunked
    else arm()
  }, { rootMargin: '600px 0px' })
  const arm = () => {
    const shown = feed.querySelectorAll<HTMLElement>('article:not([data-more])')
    const last = shown[shown.length - 1]
    if (last) io.observe(last)
  }
  arm()
}

export function listing(): void {
  gridToggle()
  chunked()
}
