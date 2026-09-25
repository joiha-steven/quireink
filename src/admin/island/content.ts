// THE WRITE COLUMN'S BEHAVIOUR (ADR 0054).
//
// The column arrives finished on all four writing addresses. What this adds is the part a
// server cannot draw: a search that answers on the keystroke, four filters over rows that are
// already here, the selection mode, and the two drawers.
//
// ⚠️ AND THE PART THAT USED TO BE FREE. The React column was mounted outside the router, so a
// row click swapped only the sheet and the column kept its scroll, its search text and its
// filters. A converted screen's links are real navigations (`docs/admin-one-dom.md`), so all of
// that is gone unless something puts it back — and on the one screen whose whole job is picking
// out of a list, coming back to the top of it is the difference between a tool and a trick.
// `sessionStorage` is where it waits: per-tab, cleared with the tab, and not a thing the server
// should ever be told about.
import { fold } from '@/admin-shared/fold'
import { focusOn, onFocusChange } from './lib/focus-mode'
import { saySettled } from './lib/say-across'
import { showTab } from './lib/tab-strip'
import { applyAll, keepStanding, pieces, showHits, sortBy } from './lib/write-filter'
import { WRITE_PAGE } from '@/admin-shared/write'
import { wirePicking } from './lib/write-pick'
import { wireDrawers } from './lib/write-drawers'

/** Per tab, per address: two panes in two tabs do not share a scroll position. */
const MEMORY = 'quireink-write-column'

type Kept = { q?: string; kind?: string; state?: string; sort?: string; top?: number }

const read = (): Kept => {
  try {
    return JSON.parse(sessionStorage.getItem(MEMORY) ?? '{}') as Kept
  } catch {
    return {}
  }
}

const keep = (next: Kept): void => {
  try {
    sessionStorage.setItem(MEMORY, JSON.stringify({ ...read(), ...next }))
  } catch {
    // A private window, or storage the browser has switched off. The column works without it;
    // what is lost is only the memory of where you were.
  }
}

/** Everything about the COLUMN. Returns the way to stop, so the column can be redrawn. */
function wirePane(screen: HTMLElement): () => void {
  const pane = screen.querySelector<HTMLElement>('[data-write-pane]')
  if (!pane) return () => {}
  const list = pane.querySelector<HTMLElement>('[data-write-list]')
  const none = pane.querySelector<HTMLElement>('[data-write-none]')
  const search = pane.querySelector<HTMLInputElement>('[data-write-search]')
  const strip = pane.querySelector<HTMLElement>('[data-write-kinds]')
  if (!list) return () => {}

  const rows = pieces(pane)
  keepStanding(rows)
  let hits: Map<string, string> | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  // HOW FAR DOWN THE LIST HAS BEEN REVEALED. The server drew the first page and hid the rest
  // (`admin-shared/write.ts`); this is the only thing that moves that line, and every question
  // the column can be asked puts it back to the top through `ask()`.
  const more = pane.querySelector<HTMLElement>('[data-write-more]')
  let limit = WRITE_PAGE

  /**
   * ⚠️ AN EMPTY LIST AND A SEARCH IN FLIGHT ARE NOT THE SAME THING.
   *
   * The body half of the search is a round trip, so between the keystroke and the answer there
   * is a moment when nothing matches YET. Saying "nothing matches your filter" there is telling
   * somebody their words are not in their blog because a request has not come back.
   */
  function settle(): void {
    const needle = search?.value.trim() ?? ''
    // `matched` is how many ANSWER, not how many are on screen — so "nothing matches" stays a
    // statement about the blog rather than about how far somebody has scrolled.
    const matched = applyAll(rows, {
      needle,
      kind: pane!.dataset.showKind ?? 'all',
      state: pane!.dataset.showState ?? 'all',
      needs: pane!.dataset.writeShowing ?? '',
      hits,
    }, limit)
    const waiting = needle.length >= 2 && hits === null
    if (none) none.hidden = matched > 0 || waiting
    if (list) list.hidden = matched === 0
    // The foot goes away when there is nothing left under it, which is also what stops the
    // observer below from firing for ever at the bottom of a short list.
    if (more) more.hidden = matched <= limit
  }

  /**
   * A NEW QUESTION STARTS AT THE TOP. Narrowing to drafts after scrolling through six hundred
   * rows must not answer with rows six hundred deep in the drafts; and a filter that left the
   * reveal where it was would have made the length of the answer depend on the order the
   * questions were asked in.
   */
  function ask(): void {
    limit = WRITE_PAGE
    settle()
    list?.scrollTo({ top: 0 })
  }

  // ---- the foot of the list, and the next page with it ---------------------------------
  //
  // `rootMargin` so the next page is revealed BEFORE the foot is reached: a reader who scrolls
  // fast should never see the list end. The root is the column's own scroller, not the window.
  if (more) {
    new IntersectionObserver((entries) => {
      if (more.hidden || !entries.some((e) => e.isIntersecting)) return
      limit += WRITE_PAGE
      settle()
    }, { root: list, rootMargin: '600px' }).observe(more)
  }

  // ---- the search ---------------------------------------------------------------------

  search?.addEventListener('input', () => {
    const q = search.value.trim()
    keep({ q: search.value })
    clearTimeout(timer)
    if (q.length < 2) {
      hits = null
      showHits(rows, null)
      ask()
      return
    }
    // The title lane answers now; the body lane answers when it answers. 180ms, because this
    // runs per keystroke and the query it sends reads the whole blog.
    ask()
    timer = setTimeout(() => { void body(q) }, 180)
  })

  async function body(q: string): Promise<void> {
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`)
      const json = await res.json() as { data?: { hits?: { kind: string; slug: string; line: string }[] } }
      // Still the query somebody is looking at? A slow answer to a query they have moved on
      // from would paint passages from words no longer in the box.
      if ((search?.value.trim() ?? '') !== q) return
      hits = new Map((json.data?.hits ?? []).map((h) => [`${h.kind}:${h.slug}`, h.line]))
    } catch {
      // A failed search leaves the title match working rather than emptying the screen.
      hits = null
    }
    showHits(rows, hits)
    settle()
  }

  // ---- the filters, which are attributes on the column --------------------------------

  // THE TWO CLASS STRINGS A TAB CAN WEAR, read off the markup the server drew — the rule the
  // trash and the comments islands already keep. The underline is a CLASS, so flipping only
  // `aria-pressed` filtered the list and left the marker under "All" whichever tab was chosen,
  // and on every return to the column (issue #68, since the column became the server's).
  const ON = strip?.querySelector<HTMLElement>('[aria-pressed="true"]')?.className ?? ''
  const OFF = strip?.querySelector<HTMLElement>('[aria-pressed="false"]')?.className ?? ''

  function setKind(kind: string): void {
    if (kind === 'all') delete pane!.dataset.showKind
    else pane!.dataset.showKind = kind
    for (const b of strip?.querySelectorAll<HTMLElement>('[data-tab]') ?? []) {
      const on = b.dataset.tab === kind
      b.setAttribute('aria-pressed', String(on))
      if (ON && OFF) b.className = on ? ON : OFF
    }
    showTab(strip)
    keep({ kind })
    ask()
  }

  function setState(state: string): void {
    if (state === 'all') delete pane!.dataset.showState
    else pane!.dataset.showState = state
    for (const b of pane!.querySelectorAll<HTMLElement>('[data-write-status]')) {
      const on = b.dataset.writeStatus === state
      b.setAttribute('aria-pressed', String(on))
      // The lamp is lit only while the question is being asked. Both hues are drawn; this picks.
      const lit = b.querySelector<HTMLElement>('[data-lamp-on]')
      const dark = b.querySelector<HTMLElement>('[data-lamp-off]')
      if (lit) lit.hidden = !on
      if (dark) dark.hidden = on
    }
    keep({ state })
    ask()
  }

  strip?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')
    if (b?.dataset.tab) setKind(b.dataset.tab)
  })

  pane.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-write-status]')
    if (!b?.dataset.writeStatus) return
    // A latched control: pressing the one that is already down asks the question again, which
    // is the same as not asking it.
    const now = pane.dataset.showState
    setState(now === b.dataset.writeStatus ? 'all' : b.dataset.writeStatus)
  })

  const sortKey = pane.querySelector<HTMLElement>('[data-write-sort]')
  sortKey?.addEventListener('click', () => {
    const next = sortKey.dataset.writeSort === 'updated' ? 'created' : 'updated'
    sortKey.dataset.writeSort = next
    sortKey.textContent = (next === 'created' ? sortKey.dataset.wordCreated : sortKey.dataset.wordUpdated) ?? ''
    sortBy(list, rows, next)
    keep({ sort: next })
    // The order decides WHICH hundred is the first hundred, so a re-sort re-reveals from the top.
    ask()
  })

  /**
   * The dashboard's filter, taken off.
   *
   * The address goes with it. It arrived as `?needs=image` and the server drew the narrowed
   * list from it, so leaving the parameter behind would mean a reload silently re-applying a
   * filter the reader had just dismissed.
   */
  pane.querySelector('[data-write-needs-clear]')?.addEventListener('click', () => {
    pane.dataset.writeShowing = ''
    const band = pane.querySelector<HTMLElement>('[data-write-needs]')
    if (band) band.hidden = true
    const url = new URL(location.href)
    url.searchParams.delete('needs')
    history.replaceState(history.state, '', url)
    ask()
  })

  // ---- what the column remembers across a row click ------------------------------------

  const kept = read()
  if (kept.q && search) { search.value = kept.q }
  if (kept.kind && kept.kind !== 'all') setKind(kept.kind)
  if (kept.state && kept.state !== 'all') setState(kept.state)
  if (kept.sort === 'created' && sortKey) sortKey.click()
  if (kept.q && search) search.dispatchEvent(new Event('input', { bubbles: true }))
  // AFTER the filters, because the scroll height depends on how many rows are showing.
  if (kept.top) list.scrollTop = kept.top
  // The open row into view, which the server marked and nothing else would scroll to.
  if (!kept.top) {
    pane.querySelector<HTMLElement>('[data-piece][aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest' })
  }
  let ticking = false
  list.addEventListener('scroll', () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => { ticking = false; keep({ top: list.scrollTop }) })
  })

  // ---- focus mode -----------------------------------------------------------------------

  /**
   * ONE SWITCH THAT TAKES EVERYTHING OFF THE WRITING SCREEN EXCEPT THE WRITING — and the rule
   * it has to keep is the one that was a bug in React: the column goes away BESIDE A SHEET and
   * NEVER on the write screen itself, where it IS the screen.
   *
   * Hiding it on all three emptied that screen for every later visit — the list gone, the
   * invitation still saying to pick something on the left, and below 1280 (where the invitation
   * is hidden because the column is normally the whole width) a blank page. It took the way back
   * out with it too: the chord is registered by the editor's action line, so the screen that had
   * lost its list had no switch on it either.
   *
   * It lives in `localStorage` because it is a fact about this person at this desk this
   * afternoon rather than a fact about the blog, and the event is how the editor's own switch
   * and this column stay in step without either importing the other.
   */
  const alone = pane.classList.contains('w-full')
  const focus = (): void => { if (!alone) pane.hidden = focusOn() }
  const stopFocus = onFocusChange(focus)
  focus()

  showTab(strip)
  settle()

  wirePicking(pane, rows.map((p) => p.el), () => settle())
  // Everything else this wired is INSIDE the pane and goes with the node when it is replaced.
  // The focus switch is the one listener on `window`, so it is the one that has to be undone.
  return stopFocus
}

let stopPane: () => void = () => {}

export function wireContent(screen: HTMLElement): void {
  stopPane = wirePane(screen)
  // The two drawers live OUTSIDE the column, so they are wired once and survive a redraw.
  wireDrawers(screen)
}

/**
 * DRAW THE COLUMN AGAIN, from the server.
 *
 * A save changes what a row shows — its title, its state, its address, and on a first save
 * whether it is in the list at all — and the sheet beside it must not be reloaded to say so:
 * that would cost the caret, the selection and the whole undo stack on the click that saved the
 * work. So the column alone is fetched and swapped.
 *
 * ⚠️ FETCHED, NOT REBUILT. A row is thirty lines of markup with a lamp, a clamp, a standing
 * line and a view count in it (`screens/content-pane.ts`); an island that assembled one would
 * be a second copy of that file, drifting in the direction nobody looks — which is the exact
 * drift this ADR's markup rules exist to prevent. The page is the source of the page.
 *
 * What the column remembers — the search text, the filters, the scroll — is in `sessionStorage`
 * and is read back by the wiring below, so a redraw lands where the reader was.
 */
export async function redrawColumn(): Promise<void> {
  const here = document.querySelector<HTMLElement>('[data-write-pane]')
  const screen = here?.closest<HTMLElement>('main')
  if (!here || !screen) return
  try {
    const res = await fetch(location.href)
    if (!res.ok) return
    const fresh = new DOMParser()
      .parseFromString(await res.text(), 'text/html')
      .querySelector<HTMLElement>('[data-write-pane]')
    if (!fresh) return
    stopPane()
    here.replaceWith(fresh)
    stopPane = wirePane(screen)
  } catch {
    // Offline, or the address 404s because the piece has just been trashed. The column stays
    // as it was, which is stale rather than empty — and stale is the better of the two on a
    // list whose only job is getting you back to something.
  }
}

const screen = document.querySelector<HTMLElement>('[data-write-pane]')?.closest<HTMLElement>('main')
  ?? document.querySelector<HTMLElement>('main')
if (screen) wireContent(screen)
// Anything a screen that left said on its way out — a piece trashed from the editor, and the
// Restore that goes with it.
saySettled()

/** Exported for the tests, which drive the column without the module's own boot. */
export { fold }
