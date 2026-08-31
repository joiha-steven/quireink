// One sheet per page — from the admin-pages mock approved on 2026-08-17, to be worked
// through one page at a time. Four laws, and these primitives are where they
// live so no screen re-types them:
//
//   1. Every page is ONE full-width sheet at ONE width, at least the window tall —
//      the editor's paper, given to every screen. Long prose gets a reading column
//      INSIDE the sheet; the page never changes size, and no two pages come out at
//      different widths.
//   2. A page's tools live on the sheet's own FIRST ROW (`SheetTop`), like the editor's
//      action line — never scattered over the paper around it.
//   3. Writing first; the numbers are one line of small print after it. Where a page IS
//      numbers (analytics), they stand directly on the paper in a `NumBand`, divided by
//      hairlines — not floated in five little cards.
//   4. One accent: the pen. Search hits and work-in-progress dots only.
import type { ReactNode } from 'react'
import { CARD, TAP } from './kit'

/** The sheet itself. Height matches the editor's paper so every page stands as tall. */
export const SHEET = `${CARD} flex flex-col lg:min-h-[calc(100dvh-1.5rem)]`

/**
 * The sheet for a page that must fit the WINDOW instead of growing past it.
 *
 * `SHEET` sets a FLOOR, so a page taller than the fold simply scrolls — right for every
 * screen whose content is a list. It is wrong for a conversation: the composer belongs to
 * the sheet's bottom edge, and with a floor that edge walks off the screen the moment the
 * transcript is longer than the window. Here the sheet is exactly as tall as the room it
 * has and the TRANSCRIPT scrolls inside it.
 *
 * The 9rem is the chrome above and below, measured rather than guessed: the canvas pads
 * `lg:py-9` (36 top, 36 bottom) and `PageHeader` is a 22px title on `mb-10` (~68). 144px
 * covers it with a few pixels to spare, and being a few pixels out costs a few pixels of
 * scroll rather than a broken layout. Below `lg` the page scrolls as pages do.
 */
export const SHEET_FIXED = `${CARD} flex flex-col min-h-[70dvh] lg:h-[calc(100dvh-9rem)]`

/** The sheet's closing line of small print: counts, hints, what a click does. */
export const SHEET_FOOT =
  'mt-auto border-t border-neutral-100 px-4 py-2.5 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400'

/** A quiet tool on the sheet-top row — same voice as the write pane's sort cycle. */
export const SHEET_TOOL =
  `${TAP} text-xs text-neutral-500 transition hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-200`

/**
 * The same tool, for a `PageHeader` action — which is NOT on a sheet.
 *
 * Everything else that wears `SHEET_TOOL` sits on a white card and measures 4.61:1. A page
 * header sits on the canvas, which is tinted, and the same ink there measures 4.39:1 — under
 * the 4.5:1 a 12px line has to clear. The call site that needs it is the newsletter's SMTP
 * link; Analytics used to be the other, and its CSV export was removed on 2026-08-30.
 *
 * DERIVED from `SHEET_TOOL` rather than typed out, because a hand-copy of this constant is a
 * thing that has already happened here more than once — and because the ONLY difference that
 * belongs between them is the one notch of ink.
 */
export const SHEET_TOOL_ON_CANVAS = SHEET_TOOL.replace('text-neutral-500', 'text-neutral-600')

/**
 * The same tool, in red ballpoint, for one that DESTROYS something.
 *
 * "Restore" and "Delete permanently" sat side by side in the Trash wearing the identical
 * class — the same size, the same weight, the same grey — with a native `confirm()` as the
 * only thing between a mis-tap and a post that is gone. Nothing on the row said which of the
 * two was the one you cannot undo.
 *
 * DERIVED, not re-typed, for the reason `SHEET_TOOL_ON_CANVAS` is: the two must differ by
 * exactly one thing — the ink — and a hand-written copy drifts on the other five within a
 * month. The ink is the product's own red ballpoint (`--pen-red`, PEN_AUX_LIGHT in
 * `render/pen.ts`), which is what you strike a line through something with on paper.
 */
export const SHEET_TOOL_DANGER = SHEET_TOOL
  .replace('text-neutral-500', 'text-[var(--pen-red)]')
  .replace('hover:text-neutral-900', 'hover:text-[var(--pen-red)] hover:underline')
  .replace('dark:text-neutral-400', 'dark:text-[var(--pen-red)]')
  .replace('dark:hover:text-neutral-200', 'dark:hover:text-[var(--pen-red)]')

/** The sheet's first row: the page's tools on one thin band over a hairline. */
export function SheetTop({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">
      {children}
    </div>
  )
}

/** Numbers standing directly on the paper, divided by vertical hairlines. */
export function NumBand({ items }: { items: { n: ReactNode; label: ReactNode; after?: ReactNode; sub?: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap border-b border-neutral-100 dark:border-neutral-800">
      {items.map((it, i) => (
        <div
          key={i}
          className="min-w-32 flex-1 border-r border-neutral-100 px-5 py-4 last:border-r-0 dark:border-neutral-800"
        >
          <span className="flex items-baseline gap-2">
            <b className="text-2xl font-semibold tracking-tight tabular-nums">{it.n}</b>
            {it.after}
          </span>
          <span className="block text-xs text-neutral-500 dark:text-neutral-400">{it.label}</span>
          {it.sub && <span className="block text-xs text-neutral-500 dark:text-neutral-400">{it.sub}</span>}
        </div>
      ))}
    </div>
  )
}
