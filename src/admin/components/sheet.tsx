// "Mỗi trang một tờ" — the one-sheet page, from the admin-pages mock the owner approved
// on 2026-08-17 ("ok, làm lần lượt đi"). Four laws, and these primitives are where they
// live so no screen re-types them:
//
//   1. Every page is ONE full-width sheet at ONE width, at least the window tall —
//      the editor's paper, given to every screen. Long prose gets a reading column
//      INSIDE the sheet; the page never changes size ("ko muốn chiều ngang trang có
//      cái bự, có cái nhỏ").
//   2. A page's tools live on the sheet's own FIRST ROW (`SheetTop`), like the editor's
//      action line — never scattered over the paper around it.
//   3. Writing first; the numbers are one line of small print after it. Where a page IS
//      numbers (analytics), they stand directly on the paper in a `NumBand`, divided by
//      hairlines — not floated in five little cards.
//   4. One accent: the pen. Search hits and work-in-progress dots only.
import type { ReactNode } from 'react'
import { CARD } from './kit'

/** The sheet itself. Height matches the editor's paper so every page stands as tall. */
export const SHEET = `${CARD} flex flex-col lg:min-h-[calc(100vh-1.5rem)]`

/** The sheet's closing line of small print: counts, hints, what a click does. */
export const SHEET_FOOT =
  'mt-auto border-t border-neutral-100 px-4 py-2.5 text-xs text-neutral-400 dark:border-neutral-800 dark:text-neutral-500'

/** A quiet tool on the sheet-top row — same voice as the write pane's sort cycle. */
export const SHEET_TOOL =
  'text-xs text-neutral-400 transition hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-500 dark:hover:text-neutral-200'

/** The sheet's first row: the page's tools on one thin band over a hairline. */
export function SheetTop({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">
      {children}
    </div>
  )
}

/** Numbers standing directly on the paper, divided by vertical hairlines. */
export function NumBand({ items }: { items: { n: ReactNode; label: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap border-b border-neutral-100 dark:border-neutral-800">
      {items.map((it, i) => (
        <div
          key={i}
          className="min-w-32 flex-1 border-r border-neutral-100 px-5 py-4 last:border-r-0 dark:border-neutral-800"
        >
          <b className="block text-2xl font-semibold tracking-tight tabular-nums">{it.n}</b>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{it.label}</span>
        </div>
      ))}
    </div>
  )
}
