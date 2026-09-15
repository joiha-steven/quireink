// The moderation queue's behaviour, over cards the server already grouped (ADR 0054).
//
// Five things: narrow, reorder, highlight, walk, and delete. None of them BUILDS a card or a
// row — the grouping is the server's, and a filter here hides comments and then hides any card
// left holding none. "Busiest" moves the cards that are already on the page.
//
// ⚠️ THE HIGHLIGHTER IS THE ONE THING THAT WRITES INTO THE TEXT, and it rebuilds each span from
// `data-text` rather than from what it painted last time. Marking over a mark is how a search
// box eats the text it was searching: two keystrokes in and the row holds nested elements whose
// combined text is still right and whose next match is off by the tags.
//
// The keyboard walk is `j` and `k` over the comments IN THE ORDER THEY ARE DRAWN, which is why
// it reads the DOM each time instead of holding a list: the order changes with the sort, and
// what is on screen changes with the filter.
import { indexIn, lanes, type Lanes } from '@/accent'
import { showTab } from './lib/tab-strip'

const root = document.querySelector<HTMLElement>('[data-screen="comments"]')
const cardHost = root?.querySelector<HTMLElement>('[data-comment-cards]')

if (root && cardHost) {
  const screen: HTMLElement = root
  const host: HTMLElement = cardHost
  const words = JSON.parse(root.dataset.commentWords ?? '{}') as Record<string, string>
  const cards = [...host.querySelectorAll<HTMLElement>('[data-card]')]
  const search = root.querySelector<HTMLInputElement>('[data-comment-search]')
  const sortStrip = root.querySelector<HTMLElement>('[data-comment-sort]')
  const ageStrip = root.querySelector<HTMLElement>('[data-comment-age]')
  const tally = root.querySelector<HTMLElement>('[data-comment-tally]')
  const noMatch = root.querySelector<HTMLElement>('[data-comment-nomatch]')
  const selection = root.querySelector<HTMLElement>('[data-comment-selection]')
  const pickedCount = root.querySelector<HTMLElement>('[data-pick-count]')

  const ON = sortStrip?.querySelector<HTMLElement>('[aria-pressed="true"]')?.className ?? ''
  const OFF = sortStrip?.querySelector<HTMLElement>('[aria-pressed="false"]')?.className ?? ''
  const pressed = (strip: HTMLElement | null): string =>
    strip?.querySelector<HTMLElement>('[aria-pressed="true"]')?.dataset.tab ?? ''

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000
  /** Lanes are built once per row and kept: two hundred comments is two hundred folds. */
  const laneCache = new WeakMap<HTMLElement, Lanes>()
  const lanesOf = (el: HTMLElement, text: string): Lanes => {
    const had = laneCache.get(el)
    if (had) return had
    const made = lanes(text)
    laneCache.set(el, made)
    return made
  }

  const rowsOf = (c: HTMLElement): HTMLElement[] => [...c.querySelectorAll<HTMLElement>('[data-comment]')]
  const visible = (): HTMLElement[] =>
    cards.filter((c) => !c.hidden).flatMap((c) => rowsOf(c).filter((r) => !r.hidden))

  /**
   * The highlighter, written from `data-text` every time.
   *
   * `textContent` first, which clears whatever was painted before and restores the plain
   * string in one assignment; then the marks are inserted over it. An empty needle therefore
   * costs one write per span and leaves the span exactly as the server sent it.
   */
  function paint(span: HTMLElement, needle: string): void {
    const text = span.dataset.text ?? ''
    span.textContent = text
    if (!needle || !text) return
    const hay = lanesOf(span, text)
    const span_ = lanes(needle).text.length
    const parts: (string | HTMLElement)[] = []
    let from = 0
    for (let at = indexIn(hay, needle, from); at !== -1; at = indexIn(hay, needle, from)) {
      if (at > from) parts.push(hay.text.slice(from, at))
      const hit = document.createElement('mark')
      hit.textContent = hay.text.slice(at, at + span_)
      parts.push(hit)
      from = at + span_
    }
    if (parts.length === 0) return
    parts.push(hay.text.slice(from))
    span.replaceChildren(...parts)
  }

  /** Narrow, recount, hide the empty cards, and put the sentence back in step. */
  function apply(): void {
    const needle = search?.value.trim() ?? ''
    const week = pressed(ageStrip) === 'week'
    const since = Date.now() - WEEK_MS
    let shown = 0
    let posts = 0
    for (const card of cards) {
      let here = 0
      for (const row of rowsOf(card)) {
        const ok = (!week || Number(row.dataset.at) >= since)
          && (!needle || indexIn(lanesOf(row, row.dataset.find ?? ''), needle) !== -1)
        row.hidden = !ok
        if (ok) here++
      }
      card.hidden = here === 0
      if (here > 0) posts++
      shown += here
      const badge = card.querySelector<HTMLElement>('[data-card-count]')
      if (badge) badge.textContent = String(here)
      // Only what is on screen is repainted: a hidden card's spans are painted the next time it
      // comes back, and until then nobody is reading them.
      if (!card.hidden) for (const span of card.querySelectorAll<HTMLElement>('[data-mark]')) paint(span, needle)
    }
    if (tally && words.inPosts) {
      tally.textContent = words.inPosts.replace('{n}', String(shown)).replace('{p}', String(posts))
    }
    if (noMatch) noMatch.hidden = posts > 0
    order()
    countPicked()
  }

  /**
   * The cards, in the order the strip asks for.
   *
   * `append` MOVES a node that is already in the document rather than copying it, so this is a
   * reordering and not a rebuild: every listener, tick and painted mark rides along. 'busiest'
   * counts what is ON SCREEN, and falls back to recency inside a tie so the order is never
   * arbitrary.
   */
  function order(): void {
    const busiest = pressed(sortStrip) === 'busiest'
    const seen = [...cards].sort((a, b) => {
      const an = Number(a.querySelector('[data-card-count]')?.textContent ?? 0)
      const bn = Number(b.querySelector('[data-card-count]')?.textContent ?? 0)
      const at = Number(a.dataset.newest)
      const bt = Number(b.dataset.newest)
      return busiest ? bn - an || bt - at : bt - at
    })
    host.append(...seen)
  }

  function press(strip: HTMLElement | null, key: string): void {
    for (const tab of strip?.querySelectorAll<HTMLElement>('[data-tab]') ?? []) {
      const on = tab.dataset.tab === key
      tab.setAttribute('aria-pressed', String(on))
      tab.className = on ? ON : OFF
    }
    showTab(strip)
  }
  for (const strip of [sortStrip, ageStrip]) {
    // On arrival too: the server draws the pressed key, so the painter has never run yet.
    showTab(strip)
    strip?.addEventListener('click', (e) => {
      const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')
      if (!tab?.dataset.tab) return
      press(strip, tab.dataset.tab)
      apply()
    })
  }
  search?.addEventListener('input', apply)

  // ----- what is ticked -----

  const ticked = (): HTMLInputElement[] =>
    [...screen.querySelectorAll<HTMLInputElement>('[data-comment-pick]')]
      .filter((box) => box.checked && !(box.closest('[data-comment]') as HTMLElement).hidden)

  function countPicked(): void {
    const n = ticked().length
    if (pickedCount) pickedCount.textContent = String(n)
    if (selection) selection.hidden = n === 0
  }
  screen.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).hasAttribute('data-comment-pick')) countPicked()
  })
  root.querySelector('[data-pick-clear]')?.addEventListener('click', () => {
    for (const box of screen.querySelectorAll<HTMLInputElement>('[data-comment-pick]')) box.checked = false
    countPicked()
  })

  // ----- the keyboard walk -----

  let walk = -1
  const MARK = ['-ml-3', 'border-l-2', 'border-[var(--pen-edge)]', 'pl-[calc(0.75rem-2px)]']
  function step(dir: 1 | -1): void {
    const seen = visible()
    if (seen.length === 0) return
    for (const row of seen) row.classList.remove(...MARK)
    walk = Math.max(0, Math.min(walk + dir, seen.length - 1))
    const row = seen[walk]
    if (!row) return
    row.classList.add(...MARK)
    row.scrollIntoView({ block: 'nearest' })
  }
  document.addEventListener('keydown', (e) => {
    // ⚠️ NOT WHILE TYPING. The search box is on this screen and "j" is a letter; a bare key
    // that steals a keystroke from a field is the bug every j/k list ships first.
    const el = document.activeElement
    const typing = el instanceof HTMLElement
      && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'j') { e.preventDefault(); step(1) }
    else if (e.key === 'k') { e.preventDefault(); step(-1) }
  })

  // ----- reading, and removing -----

  screen.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const open = target.closest<HTMLElement>('[data-comment-expand]')
    if (open) {
      const was = open.getAttribute('aria-expanded') === 'true'
      open.setAttribute('aria-expanded', String(!was))
      const body = open.querySelector<HTMLElement>('[data-mark]')
      body?.classList.toggle('line-clamp-3', was)
      body?.classList.toggle('whitespace-pre-wrap', !was)
      body?.classList.toggle('break-words', !was)
      return
    }
    const gone = target.closest<HTMLElement>('[data-comment-delete]')
    if (gone?.dataset.id) { void remove([gone.dataset.id]); return }
    if (target.closest('[data-pick-delete]')) {
      void remove(ticked().map((box) => box.dataset.id ?? ''))
    }
  })

  /**
   * Trashing a comment ASKS NOTHING, and the way back is in the toast.
   *
   * That was decided on 2026-09-07 and the argument is the soft delete: nothing has gone, so a
   * question before it is a question about nothing. The undo has to exist for that to be true,
   * which is why `quire:toast` learned to carry a live `run` — a bridge that could only say a
   * sentence would have forced the question back onto the screen.
   *
   * The rows come off the page at once rather than after a reload, so the queue a moderator is
   * working down does not jump under them.
   */
  async function remove(ids: string[]): Promise<void> {
    const rows = ids
      .map((id) => screen.querySelector<HTMLElement>(`[data-comment="${id}"]`))
      .filter((row): row is HTMLElement => row !== null)
    if (rows.length === 0) return
    const done: string[] = []
    for (const id of ids) {
      try {
        const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
        if (((await res.json()) as { success?: boolean }).success) done.push(id)
      } catch { /* counted as a failure below */ }
    }
    if (done.length === 0) {
      window.dispatchEvent(new CustomEvent('quire:toast', { detail: { message: words.failed, kind: 'error' } }))
      return
    }
    // ⚠️ THE CARD IS REMEMBERED BEFORE THE ROW LEAVES IT. Once a row is detached, nothing on
    // the page can say which post it belonged to any more — `contains` answers no for every
    // card — and the undo would have nowhere to put it back.
    const off = rows
      .filter((row) => done.includes(row.dataset.comment ?? ''))
      .map((row) => ({ row, into: row.closest('ul') }))
    for (const { row } of off) row.remove()
    apply()
    window.dispatchEvent(new CustomEvent('quire:toast', {
      detail: {
        message: words.trashed,
        kind: 'success',
        action: {
          label: words.undo,
          run: () => {
            void fetch('/api/trash', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ kind: 'comments', action: 'restore', ids: done }),
            }).then((r) => {
              if (!r.ok) return
              // Back where it was: the card is still on the page and its list is newest first,
              // so the top is where a comment that was just deleted came from.
              for (const { row, into } of off) into?.prepend(row)
              apply()
            })
          },
        },
      },
    }))
  }

  apply()
}
