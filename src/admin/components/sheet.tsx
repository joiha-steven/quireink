// One sheet per page — from the admin-pages mock approved on 2026-08-17, to be worked
// through one page at a time. Four laws, and these primitives are where they
// live so no screen re-types them:
//
//   1. Every page is ONE full-width sheet at ONE width, as long as what is ON it, with a
//      60vh floor — the editor's paper, given to every screen. Long prose gets a reading
//      column INSIDE the sheet; the page never changes size, and no two pages come out at
//      different widths.
//   2. A page's tools live on the sheet's own FIRST ROW (`SheetTop`), like the editor's
//      action line — never scattered over the paper around it.
//   3. Writing first; the numbers are one line of small print after it. Where a page IS
//      numbers (analytics), they stand directly on the paper in a `NumBand`, divided by
//      hairlines — not floated in five little cards.
//   4. One accent: the pen. Search hits and work-in-progress dots only.
import type { ReactNode } from 'react'
// The sheet's own class strings moved to `@/admin-shared/kit` with ADR 0054's screens: the
// server draws a sheet now. Re-exported, so every call site keeps the import it had.
import { SHEET, SHEET_FIXED, SHEET_FOOT, SHEET_TOOL, SHEET_TOOL_ON_CANVAS, SHEET_TOOL_DANGER, SHEET_TOP } from '@/admin-shared/kit'

export { SHEET, SHEET_FIXED, SHEET_FOOT, SHEET_TOOL, SHEET_TOOL_ON_CANVAS, SHEET_TOOL_DANGER, SHEET_TOP }

/**
 * The sheet itself: as long as its content, with a floor under it.
 *
 * ⚠️ **60vh, and it was `calc(100dvh-1.5rem)` until 2026-09-07.** A window-height minimum
 * gives a sparse page a page-height slab of white: Trash, the assistant and an empty Write
 * screen each drew about 2,000px of it under one sentence, which reads as a page that failed
 * to load rather than as a page with nothing on it. A FLOOR is what the rule was reaching for
 * — it keeps a short page reading as paper — and 60vh is high enough to do that without
 * printing blank paper to reach the fold.
 *
 * `min-h`, still, and not a height: a page taller than the fold scrolls, as pages do.
 */

/** The sheet's first row: the page's tools on one thin band over a hairline. */
export function SheetTop({ children }: { children: ReactNode }) {
  return <div className={SHEET_TOP}>{children}</div>
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

/**
 * The lift, and the ONE thing in this admin allowed to have it.
 *
 * `docs/admin-design.md` reserves the drop shadow for what genuinely floats, and the five
 * things that do had drifted into five opinions: the palette rounded 12 on `shadow-xl`, the
 * mobile nav and the two modals rounded 16 — one radius step past the top of the scale — and
 * of those two modals NEITHER carried a shadow at all, so the one signal reserved for them
 * was the one they were missing. `shadow-xl` was also the only stock Tailwind shadow left in
 * a file tree where every other shadow is written out.
 *
 * Two steps, because a real one has two: the contact under the near edge, and the spread the
 * sheet casts across the paper. NO inset lip — in this grammar a light lip means PRESSABLE,
 * and an overlay is not a key. It floats; it does not depress.
 */
// Both moved to `@/admin-shared/kit` on 2026-09-14: the server renders overlays too now (ADR 0054)
// and may not import from `src/admin`. Re-exported, so nothing that had them has to move.
export { OVERLAY, OVERLAY_LIFT } from '@/admin-shared/kit'
