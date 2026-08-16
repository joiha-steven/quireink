// The admin's tab strips — the two of them, because `lg` and `sm` were always two objects.
//
// Split out of `kit.tsx` on 2026-08-15 for its 400-line cap, and the seam holds up on its own:
// everything here answers "how does a set of mutually exclusive choices look", and nothing
// else in the kit asks that.

import type { ReactNode } from 'react'

// Tabs — and the two sizes are now two DIFFERENT objects, because they always were.
//
// Both used to be a pill on a tinted `bg-neutral-200/70` tray, the loudest remaining tell of a
// stock dashboard, and it was doing a job a rule does better: a strip of section names needs a
// line to stand on, not a tray under it.
//
// `lg` NAMES A SECTION — Posts / Pages / Taxonomy / Series. The page's own navigation, on its
// own row in all five call sites, so it is an underlined strip on a hairline. (The retired
// `variant='underline'` was this: the name outlived the design, and a pill replaced it.)
// `sm` FILTERS WITHIN one — All / Published / Draft, a date range. It sits inline beside a
// field or a button, so it cannot be a strip on a rule; outlined segments instead of a tray.
export type TabItem<K extends string = string> = { key: K; label: ReactNode }
export type TabSize = 'lg' | 'sm'

// The tracks and the item are exported separately because Analytics' range control is made of
// LINKS: the range lives in the URL, so it cannot be a `<Tabs>` with an `onChange`. It had its
// own copy of the markup, one padding step off and with a different hover, which is how one
// control came to look like two. A link-driven strip wears these and gets the real thing.
export const TAB_TRACK = 'flex w-full flex-wrap items-end gap-6 border-b border-neutral-200 dark:border-neutral-800'
export const SEGMENT_TRACK = 'flex w-fit max-w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800'
// The dense variant is full-width with growing items: five segments whose right edge lands
// on the pane's own edge instead of stopping short of it ("hụt", the owner called the gap).
const SEGMENT_TRACK_DENSE = 'flex w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800'

export const tabItemClass = (active: boolean, size: TabSize = 'lg', dense = false): string =>
  size === 'lg'
    // `-mb-px` so the item's own 2px border sits ON the track's hairline rather than under it.
    ? `-mb-px border-b-2 pb-2.5 text-sm font-medium transition ${
        active
          ? 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white'
          : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-900 dark:hover:border-neutral-600 dark:hover:text-neutral-200'
      }`
    : `${dense ? 'grow px-2' : 'px-3'} py-1.5 text-[0.8125rem] font-medium transition ${
        active
          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
      }`

export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  size = 'lg',
  dense = false,
  className = '',
}: {
  tabs: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  size?: TabSize
  /**
   * A tighter `sm`, for a row of five in a 320px pane. The row does NOT wrap — the owner
   * called the folded second line crooked — so every caller owes labels short enough to
   * fit in every language (the write pane carries its own `scope*` strings for this).
   */
  dense?: boolean
  className?: string
}) {
  return (
    <div className={`${size === 'lg' ? TAB_TRACK : dense ? SEGMENT_TRACK_DENSE : SEGMENT_TRACK} ${className}`}>
      {tabs.map((tb) => (
        <button
          key={tb.key}
          type="button"
          onClick={() => onChange(tb.key)}
          aria-pressed={value === tb.key}
          className={tabItemClass(value === tb.key, size, dense)}
        >
          {tb.label}
        </button>
      ))}
    </div>
  )
}
