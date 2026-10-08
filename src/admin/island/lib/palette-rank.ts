// HOW THE COMMAND PALETTE ORDERS WHAT MATCHED.
//
// A row matches when the query is anywhere in its words, and the words include a description
// (the Activity log's "who signed in, what was uploaded"). Drawn order alone put the Activity log
// above the setting called "Largest upload (MB)" for "upload", because the settings are listed
// in an order that has nothing to do with the query. The TITLE is what a person typed towards,
// so a hit in it comes first: from its start, then from the start of one of its words, then
// inside a word; a hit only in the description or the keywords comes last. Rows of equal rank
// keep the order they were drawn in.
import { indexIn, lanes, type Lanes } from '@/accent'

export type Rank = 0 | 1 | 2 | 3

const LETTER = /[\p{L}\p{N}]/u

/** Where `needle` first starts a word of `title`, or -1. */
function wordStart(title: Lanes, needle: string): number {
  for (let at = indexIn(title, needle); at !== -1; at = indexIn(title, needle, at + 1)) {
    if (at === 0 || !LETTER.test(title.folded[at - 1] ?? '')) return at
  }
  return -1
}

/**
 * 0 the title starts with the query, 1 a word of the title does, 2 the query is inside the
 * title, 3 only the rest of the row's words hold it, -1 no match at all.
 */
export function rankLanes(t: Lanes, all: Lanes, needle: string): Rank | -1 {
  const at = indexIn(t, needle)
  if (at === 0) return 0
  if (at !== -1) return wordStart(t, needle) !== -1 ? 1 : 2
  return indexIn(all, needle) === -1 ? -1 : 3
}

/** The same from plain strings. */
export const rankMatch = (title: string, everything: string, needle: string): Rank | -1 =>
  rankLanes(lanes(title), lanes(everything), needle)

type Folded = { title: Lanes; all: Lanes }
// A row's two lanes, folded the first time a query reaches it and kept: a keystroke should not
// fold a hundred rows again (the markup carries the words once, `web/admin/overlays.ts`).
const folded = new WeakMap<HTMLElement, Folded>()
const foldedOf = (r: HTMLElement): Folded => {
  let f = folded.get(r)
  if (!f) {
    f = { title: lanes(r.firstElementChild?.textContent ?? ''), all: lanes(r.dataset.palSearch ?? '') }
    folded.set(r, f)
  }
  return f
}

/** Each row's rank for `needle`, worked out once per row. */
export function rankRows(rows: HTMLElement[], needle: string): Map<HTMLElement, Rank | -1> {
  const ranks = new Map<HTMLElement, Rank | -1>()
  for (const r of rows) {
    const f = foldedOf(r)
    ranks.set(r, rankLanes(f.title, f.all, needle))
  }
  return ranks
}

const drawn = new WeakMap<HTMLElement, number>()
let drawnCount = 0
/** The groups whose rows are one unbroken run and so can be re-ordered in place. */
export const ARRANGED_GROUPS = ['action', 'screen', 'setting']

/**
 * Re-orders each of the groups by rank (unmatched last), stably; with no ranks, back to the drawn
 * order. The sorted run goes back in front of whatever followed it, so the recent group, the
 * writing slot and the headings are never touched.
 */
export function arrangeRows(rows: HTMLElement[], ranks: Map<HTMLElement, Rank | -1> | null): void {
  for (const r of rows) if (!drawn.has(r)) drawn.set(r, drawnCount++)
  for (const group of ARRANGED_GROUPS) {
    const run = rows.filter((r) => r.dataset.palGroup === group)
    const last = run[run.length - 1]
    const parent = last?.parentNode
    if (!last || !parent) continue
    const key = (r: HTMLElement): number => {
      const k = ranks?.get(r) ?? 0
      return k === -1 ? 9 : k
    }
    const sorted = [...run].sort((a, b) => key(a) - key(b) || (drawn.get(a) ?? 0) - (drawn.get(b) ?? 0))
    const after = last.nextSibling
    for (const r of sorted) parent.insertBefore(r, after)
  }
}
