// The dashboard's numbers strip: one tile, and the band that draws the edges between them.
//
// Split out of `kit.tsx` on 2026-08-29, when the card's shadow argument took that file past
// its 400-line cap. The guard says a file at the cap is SPLIT rather than squeezed, and this
// was the piece that could leave whole: two components about one strip, and nothing else in
// the kit reaches into them.
import type { ReactNode } from 'react'
import Link from '@/admin/router'
import { CARD } from './kit'
import { FIGURE, META } from './scale'

// A headline figure with its label under it. ONE of these, used by the Overview tiles, the
// Analytics tiles and the newsletter counts — `analytics-kit`'s `StatTile` was a second copy
// of the same twelve classes that had already drifted by one shade on its sub-line.
//
// Optional `icon`, `sub` line, `after` (the analytics trend arrow, which sits inside the
// figure) and `href` (wraps the whole tile in a link with a hover lift).
export function StatCard({
  label,
  value,
  sub,
  icon,
  after,
  href,
  bare = false,
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  after?: ReactNode
  href?: string
  /** Inside a `StatBand`: drop the sheet, the band draws the edges. */
  bare?: boolean
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={FIGURE}>{value}{after}</div>
        {icon && <span className="text-neutral-300 dark:text-neutral-600">{icon}</span>}
      </div>
      <div className={`${META} mt-2.5`}>{label}</div>
      {sub && <div className={`${META} mt-1`}>{sub}</div>}
    </>
  )
  // The hover LIFT is gone with the shadow it lifted into. A tile that rises and casts a
  // shadow is the dashboard costume again; a tile that darkens its own edge says the same
  // "this is clickable" without pretending to be a physical object on a tray.
  if (href) {
    return (
      <Link href={href} className={`${bare ? BARE_TILE : `${CARD} p-5`} block transition ${bare ? 'hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40' : 'hover:border-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40'}`}>
        {inner}
      </Link>
    )
  }
  return <div className={bare ? BARE_TILE : `${CARD} p-5`}>{inner}</div>
}

/** A tile inside a band: no edge of its own, the band's divider does that job. */
const BARE_TILE = 'px-5 py-4'

/**
 * The figures of a page as ONE BAND, divided by hairlines, instead of five floating sheets.
 *
 * Measured on the Overview at 1440px: each tile was 98px tall around ~50px of content, so 49%
 * of every box was empty, and the row of five sat between a 40px gap above and a 40px gap
 * below. The owner circled exactly that region on 2026-08-15 — *"trên dưới cách nhau cả
 * khúc"*. Five separate sheets is also the reading the kit's own contract rejects: a card is
 * for "genuinely independent data", and Posts / Pages / Comments / Images / Storage are five
 * readings of ONE thing, which is how much blog there is.
 *
 * `divide-x` alone is wrong once the grid wraps — it skips only the very first child, so the
 * first cell of every later ROW keeps a left edge. The border goes on every cell and the
 * per-row firsts are cleared by column position, which is why the counts are spelled out.
 */
export function StatBand({ children }: { children: ReactNode }) {
  return (
    // `overflow-hidden`: the band wears the 10px corner and its cells are deliberately bare,
    // so without it a cell's hover background paints square straight through the rounded
    // corner. The cells stay square — they are cells — and the band keeps its shape.
    <div className={`${CARD} overflow-hidden grid grid-cols-2 divide-neutral-200 sm:grid-cols-3 lg:grid-cols-5 dark:divide-neutral-800
      [&>*]:border-l [&>*]:border-t [&>*]:border-neutral-200 dark:[&>*]:border-neutral-800
      [&>*:nth-child(-n+2)]:border-t-0 [&>*:nth-child(odd)]:border-l-0
      sm:[&>*:nth-child(-n+3)]:border-t-0 sm:[&>*:nth-child(odd)]:border-l sm:[&>*:nth-child(3n+1)]:border-l-0
      lg:[&>*]:border-t-0 lg:[&>*:nth-child(3n+1)]:border-l lg:[&>*:first-child]:border-l-0`}>
      {children}
    </div>
  )
}
