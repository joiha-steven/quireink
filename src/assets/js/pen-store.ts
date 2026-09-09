// Where a reader's marks live: their own browser, keyed by the page, and nowhere else.
//
// The same bargain `resume.ts` made for the reading position and the comment gate made
// for identity: the blog does not need to know who you are to let you mark its pages.
// Nothing here is sent. What is kept is the quote and its surroundings (`pen-anchor.ts`),
// which gesture and which ink, and the note — enough to draw the mark again tomorrow and
// enough, later, to carry it to a notebook of the reader's own.

import type { Selector } from './pen-anchor'

export type Kind = 'hl' | 'u' | 'o'

export type Ann = Selector & {
  id: string
  kind: Kind
  /** One of the five inks for a highlight, or empty for the pen's default. */
  ink: string
  note: string
  /** When it was made, ms. */
  t: number
}

const KEY = 'quire:pen:'
/** Marks per page before the oldest go: nobody reads with five hundred highlights. */
const MAX = 500

export function load(path: string): Ann[] {
  try {
    const raw = localStorage.getItem(KEY + path)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { v: number; items: Ann[] }
    return Array.isArray(parsed?.items) ? parsed.items.filter((a) => a && typeof a.exact === 'string') : []
  } catch {
    return []
  }
}

export function save(path: string, items: Ann[]): void {
  try {
    localStorage.setItem(KEY + path, JSON.stringify({ v: 1, items: items.slice(-MAX) }))
  } catch {
    /* a full or forbidden store loses nothing the reader can see right now */
  }
}

export const newId = () => Math.random().toString(36).slice(2, 10)
