// NARROWING THE WRITE COLUMN: the search, the two filter rows, and the sort.
//
// Every piece is already in the page (`docs/admin-one-dom.md`, trap 2), so all four of these
// are attributes and node moves rather than requests. What they are NOT is a re-render: the
// island never builds a row, because a row built here would be a second copy of
// `screens/content-pane.ts` drifting from it in silence.
//
// ⚠️ TWO LANES OF SEARCH, AND THEY ARE NOT THE SAME QUESTION. The title and a post's terms are
// in the page and answer on the keystroke. The BODY is not — it is in the database — so that
// half is a debounced request, and until it answers "nothing matched" is not a thing this
// screen is allowed to say.
import { indexIn, lanes, type Lanes } from '@/accent'

export type FilterWords = Partial<Record<string, string>>

/** One row, and the facts the filters ask about, read once. */
type Piece = {
  el: HTMLElement
  key: string
  find: Lanes
  touched: number
  created: number
  kind: string
  state: string
  needs: string
}

/** What the column is currently asking of its rows. */
export type Question = {
  needle: string
  kind: string
  state: string
  needs: string
  hits: Map<string, string> | null
}

const num = (el: HTMLElement, name: string): number => Number(el.dataset[name] ?? '0') || 0

export function pieces(pane: HTMLElement): Piece[] {
  return [...pane.querySelectorAll<HTMLElement>('[data-piece]')].map((el) => ({
    el,
    key: el.dataset.piece ?? '',
    // The RAW words, because `lanes()` wants both faces and the server folded only one of them
    // into `data-find`. That attribute stays because it is what a future exact-match check
    // would read, and because folding forty-eight strings on the first keystroke is work the
    // server already did.
    find: lanes(el.dataset.findRaw ?? ''),
    touched: num(el, 'pieceTouched'),
    created: num(el, 'pieceCreated'),
    kind: el.dataset.pieceKind ?? '',
    state: el.dataset.pieceState ?? '',
    needs: el.dataset.pieceNeeds ?? '',
  }))
}

/**
 * Paint the matched run inside a row's title and summary.
 *
 * ⚠️ NODES, NEVER `innerHTML`. What is being highlighted is a title somebody typed, so building
 * a string around it is an injection on the one screen where every piece of text came from
 * outside. `document.createElement('mark')` cannot be anything but a mark.
 *
 * The text is put back from `data-write-line` / the row's own title before each pass, so
 * clearing the box restores what the server wrote rather than leaving the last paint behind.
 */
export function paintMarks(row: HTMLElement, needle: string): void {
  for (const box of row.querySelectorAll<HTMLElement>('.write-title, [data-write-line]')) {
    const text = box.dataset.text ?? box.textContent ?? ''
    if (box.dataset.text === undefined) box.dataset.text = text
    if (!needle) { box.textContent = text; continue }
    const hay = lanes(text)
    const parts: Node[] = []
    let at = 0
    for (;;) {
      const hit = indexIn(hay, needle, at)
      if (hit === -1) break
      // The needle's own folded length, which is what `indexIn` matched: the accented text may
      // be longer in characters than the query that found it.
      const span = lanes(needle).text.length
      if (hit > at) parts.push(document.createTextNode(text.slice(at, hit)))
      const mark = document.createElement('mark')
      mark.textContent = text.slice(hit, hit + span)
      parts.push(mark)
      at = hit + span
      if (span === 0) break
    }
    if (parts.length === 0) { box.textContent = text; continue }
    if (at < text.length) parts.push(document.createTextNode(text.slice(at)))
    box.replaceChildren(...parts)
  }
}

/**
 * Show the rows that answer every question at once, and say how many there are.
 *
 * ⚠️ ONE MECHANISM, AND THE COUNT IS WHY. The first cut left kind, status and "needs" to CSS
 * rules against attributes on the column and kept only the search here. It drew correctly and
 * could not COUNT: `shown` was the number of rows that passed the SEARCH, so a filter that hid
 * every row still reported every row, and the "nothing matches your filter" line never came up.
 * Two things deciding whether a row is on screen is one thing too many — and the half that was
 * wrong was the half nothing could see.
 *
 * The four stack, which is the point: "drafts of posts, missing a share image" is one question
 * and not three lists.
 */
/**
 * `limit` is the REVEAL, and it is deliberately inside this one function.
 *
 * The column shows a page of rows at a time and reveals another when its foot scrolls into view
 * (`admin-shared/write.ts`). That could have been a second mechanism — a CSS rule, an index
 * attribute — and the comment above says what happened the last time there were two: the count
 * came from one of them and the drawing from the other, and the half that was wrong was the
 * half nothing could see. So a row is hidden for exactly one reason, computed here, and the
 * number returned is how many ANSWER the question rather than how many are on screen. That
 * number is what "nothing matches" is decided on, and it must not change because somebody has
 * not scrolled yet.
 *
 * The list is walked in DOM order, which `sortBy` keeps true.
 */
export function applyAll(list: Piece[], q: Question, limit = Infinity): number {
  let matched = 0
  for (const p of list) {
    const ok = (q.kind === 'all' || p.kind === q.kind)
      && (q.state === 'all' || p.state === q.state)
      && (q.needs === '' || p.needs.split(' ').includes(q.needs))
      && (!q.needle
        || indexIn(p.find, q.needle) !== -1
        || (q.hits?.has(p.key) ?? false))
    if (ok) matched += 1
    const show = ok && matched <= limit
    p.el.hidden = !show
    if (show) paintMarks(p.el, q.needle)
  }
  return matched
}

/** The summary line: the matched passage while searching, the standing line otherwise. */
export function showHits(list: Piece[], hits: Map<string, string> | null): void {
  for (const p of list) {
    const box = p.el.querySelector<HTMLElement>('[data-write-summary]')
    const line = p.el.querySelector<HTMLElement>('[data-write-line]')
    if (!box || !line) continue
    const found = hits?.get(p.key)
    if (found !== undefined) {
      // A body hit replaces the standing line, and `data-text` has to go with it or the next
      // paint would highlight inside the sentence that is no longer there.
      delete line.dataset.text
      line.textContent = found
      box.hidden = false
    } else if (line.dataset.standing !== undefined) {
      delete line.dataset.text
      line.textContent = line.dataset.standing
      box.hidden = line.dataset.standing === ''
      delete line.dataset.standing
    }
  }
}

/** Remember what the server wrote, so a body hit can be taken back off again. */
export function keepStanding(list: Piece[]): void {
  for (const p of list) {
    const line = p.el.querySelector<HTMLElement>('[data-write-line]')
    if (line && line.dataset.standing === undefined) line.dataset.standing = line.textContent ?? ''
  }
}

/**
 * Reorder by the other date.
 *
 * Moving nodes, not rebuilding them: `appendChild` on an element already in the list MOVES it,
 * so the whole sort is one pass and the rows keep every listener and every attribute they have.
 */
/**
 * ⚠️ THE ARRAY IS SORTED IN PLACE, so it goes on mirroring the DOM.
 *
 * It used to sort a COPY and move the nodes by it, which was invisible while every matching row
 * was on screen — visibility is per-row and does not care about order. It stopped being
 * invisible the moment the column began revealing a page at a time: `applyAll` would have
 * revealed the first hundred of the ORIGINAL order while the reader was looking at the sorted
 * one, so switching from "last edited" to "written" would have shown a hundred rows from the
 * middle of the list.
 */
export function sortBy(box: HTMLElement, list: Piece[], by: 'updated' | 'created'): void {
  const key = by === 'created' ? (p: Piece) => p.created : (p: Piece) => p.touched
  list.sort((a, b) => key(b) - key(a))
  for (const p of list) box.appendChild(p.el)
}
