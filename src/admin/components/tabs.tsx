// The admin's tab strips — the two of them, because `lg` and `sm` were always two objects.
//
// Split out of `kit.tsx` on 2026-08-15 for its 400-line cap, and the seam holds up on its own:
// everything here answers "how does a set of mutually exclusive choices look", and nothing
// else in the kit asks that.

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

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
// `overflow-x-auto`, not `overflow-hidden`, and the difference is the whole control on a
// phone. A hidden box IS a scroll container — script and focus can move it — but the browser
// gives the user no way to: a finger cannot pan it. So a segmented strip wider than its box
// did not merely look cut off, its far end was UNREACHABLE by touch. Measured 2026-08-28 on
// the Settings tabs: at 390px five of the eight tabs were past the edge, AI and System among
// them, and the only way to reach them was a `?tab=` URL. `no-scrollbar` keeps the bar
// itself out of a 32px-tall control; the strip still clips visually at its rounded edge.
// The track is carved — it CONTAINS the keys, so it wears the groove (`bg` one step off the
// card plus a 1px inner shadow); the active key is HELD DOWN in it. Ink-on-ink shading is
// invisible, so the pressed key also catches light on its lower inside edge.
// `min-h-8` — 32px, the small control height, and the height of the whole segmented family.
// The strip sets the height of the sheet's tools row: it is the widest thing on that row and
// the first thing read on it, so the save key and the search field beside it are sized to IT
// rather than the other way round. A MINIMUM rather than a fixed height, because three call
// sites let the strip wrap and a fixed one would halve their rows; a single-line strip lands
// on 32 exactly, its items stretching to 30 inside the 1px edge.
export const SEGMENT_TRACK = 'flex min-h-8 w-fit max-w-full overflow-x-auto no-scrollbar rounded-md border border-neutral-200 bg-neutral-50 shadow-[inset_0_1px_2px_rgba(0,0,0,.07)] dark:border-neutral-800 dark:bg-neutral-950/40 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,.4)]'
// The dense variant is full-width with growing items: five segments whose right edge lands
// on the pane's own edge instead of stopping short of it, which read as a gap left over.
const SEGMENT_TRACK_DENSE = 'flex min-h-8 w-full overflow-x-auto no-scrollbar rounded-md border border-neutral-200 bg-neutral-50 shadow-[inset_0_1px_2px_rgba(0,0,0,.07)] dark:border-neutral-800 dark:bg-neutral-950/40 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,.4)]'

/**
 * What an active item MEANS, which turns out to be two different things wearing one costume.
 *
 * A `place` is a tab you navigated to: Site, Layout, Reading. A `choice` is a value you set:
 * English, 3:2, framed. They had the identical black pill, and on the Settings screen that
 * put "Site" — the section you are IN — beside "English" — a field's current value — in the
 * same ink, the same size, the same shape, eight lines apart. Nothing said which of the two
 * was answering "where am I". That sameness is most of what reads as machine-made: a screen
 * where everything is the same rectangle has told you nothing by the time you have looked
 * at all of it.
 *
 * So the highlighter marks WHERE YOU ARE and nothing else. It is the meaning the ink already
 * has on paper — the line you ran a marker over to come back to — and it is the reason this
 * is not decoration: a second colour that means one thing is a signal, and a palette is not.
 * A value you picked is not a place, so it takes the sunken paper key.
 *
 * The seam is the `Tabs` component below, which is the only thing in the admin that renders
 * navigation; the ten call sites that build a chooser out of `tabItemClass` directly are all
 * choices, and get the default.
 */
export type TabRole = 'place' | 'choice'

export const tabItemClass = (
  active: boolean,
  size: TabSize = 'lg',
  dense = false,
  role: TabRole = 'choice',
): string =>
  size === 'lg'
    // `-mb-px` so the item's own 2px border sits ON the track's hairline rather than under it.
    ? `-mb-px border-b-2 pb-2.5 text-sm font-medium transition ${
        active
          // A marker stroke under the label, not a wash behind it: an underlined strip is
          // already a quiet control and a lime block in it would be the loudest thing on the
          // page. The ink stays on the word so the label is still read as a word.
          ? role === 'place'
            ? 'border-[var(--pen-edge)] text-neutral-900 dark:text-white'
            : 'border-neutral-900 text-neutral-900 dark:border-white dark:text-white'
          : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 hover:text-neutral-900 dark:hover:border-neutral-600 dark:hover:text-neutral-200'
      }`
    // `shrink-0 whitespace-nowrap` on the segmented variant, now that the track scrolls
    // rather than clipping. Without them a strip too wide for its box squeezes its items and
    // wraps their labels instead: measured at 390px, "Search & URLs" broke over three lines
    // and made a 32px control 130px tall. A scrolling strip should keep its items whole and
    // let the strip move — that is what scrolling is for.
    // `py-1` and not `py-1.5`: the track's own `min-h-8` is what sets the strip's height now,
    // and the padding only has to be small enough to let it. At `py-1.5` the item measured
    // 31.5 and pushed the track to 33.5 — a third height on a row that has a 32px key and a
    // 32px field on it.
    : `${dense ? 'grow px-2' : 'shrink-0 whitespace-nowrap px-3'} py-1 text-[0.8125rem] font-medium transition ${
        active
          // INK on the highlighter, not the reading site's olive `--on-pen`: on a control
          // the olive read as grey and dull, and the owner called it. A mark in running
          // text keeps the olive; a pressed key wants the full contrast.
          // A latched key: the active segment is held DOWN, so it carries the same
          // carved-in shadow every pressed control wears.
          // Solid ink cannot show relief — shading dies inside black — and a WHITE key
          // vanishes against the white card. The chosen key is one grey step DOWN from its
          // ground, carved: darker because a pressed key sits in its own shade. The pen
          // keeps marking a place; a chosen value is the sunken key.
          ? role === 'place'
            // `dark:text-white` for the reason set out on SIDEBAR_NAV_ACTIVE: the dark pen is
            // an olive, and near-black on it measures 3.8:1 against the 5.0 white gets.
            ? 'bg-[var(--pen)] text-neutral-950 dark:text-white shadow-[inset_0_2px_3px_rgba(0,0,0,.3),inset_0_-1px_0_rgba(255,255,255,.35)]'
            : 'bg-neutral-200 font-semibold text-neutral-950 shadow-[inset_0_2px_3px_rgba(0,0,0,.22)] dark:bg-neutral-950 dark:text-white dark:shadow-[inset_0_2px_3px_rgba(0,0,0,.6)]'
          : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
      }`

// A scrolling strip that says so. 2026-08-28 made the far tabs REACHABLE; this makes them
// visible. At 360px the Settings strip holds four of its eight tabs (607px of strip in a
// 292px box), and `w-fit max-w-full` plus the rounded border meant the fourth tab closed
// the frame flush at the edge — a strip that had lost half its tabs looked finished.
// Nothing said Connections, AI or System existed, on the one device where a settings
// screen is most often somebody's only way in.
//
// The cue is a mask on the strip's own pixels, not an overlaid gradient: the strip sits on
// white cards and on the bare canvas, in two themes, and a painted fade would have to know
// what is behind it. Fading the strip's edge — labels, border and all — assumes no colour
// and reads the same everywhere: an edge that dissolves is an edge that continues. Scroll
// position drives which end dissolves, so the fade retires at the end of travel instead of
// dimming a last tab that is fully there.
const EDGE_MASK: Record<'left' | 'right' | 'both', string> = {
  right: '[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]',
  left: '[mask-image:linear-gradient(to_right,transparent,#000_2rem)]',
  both: '[mask-image:linear-gradient(to_right,transparent,#000_2rem,#000_calc(100%-2rem),transparent)]',
}

function useScrollEdges(ref: RefObject<HTMLDivElement | null>, watch: boolean): '' | 'left' | 'right' | 'both' {
  const [edges, setEdges] = useState<'' | 'left' | 'right' | 'both'>('')
  useEffect(() => {
    const el = ref.current
    if (!watch || !el) return
    const read = () => {
      const spare = el.scrollWidth - el.clientWidth
      // Sub-pixel layout makes scrollWidth and clientWidth disagree by fractions on a strip
      // that does not scroll at all, so anything within a pixel of flush counts as flush.
      if (spare <= 1) return setEdges('')
      const left = el.scrollLeft > 1
      const right = el.scrollLeft < spare - 1
      setEdges(left && right ? 'both' : left ? 'left' : 'right')
    }
    read()
    el.addEventListener('scroll', read, { passive: true })
    // Re-read on resize rather than on renders: the strip overflows or stops overflowing
    // when the pane changes width, not when React does. Guarded because the test DOM has
    // no ResizeObserver and the initial read alone is correct for a box that never moves.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read)
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', read)
      ro?.disconnect()
    }
  }, [ref, watch])
  return edges
}

export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  size = 'lg',
  dense = false,
  className = '',
  role = 'place',
}: {
  tabs: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  size?: TabSize
  /** 'place' is the default — a Tabs strip is navigation. The write pane's scope strip
      opts down to 'choice': the pen beside the writing pulled the eye on every keystroke,
      and a filter is closer to a value than a destination anyway. */
  role?: TabRole
  /**
   * A tighter `sm`, for a row of five in a 320px pane. The row does NOT wrap — the owner
   * called the folded second line crooked — so every caller owes labels short enough to
   * fit in every language (the write pane carries its own `scope*` strings for this).
   */
  dense?: boolean
  className?: string
}) {
  const track = useRef<HTMLDivElement>(null)
  // Only the segmented strip scrolls; the lg strip wraps and cannot clip.
  const edges = useScrollEdges(track, size === 'sm')
  return (
    <div
      ref={track}
      className={`${size === 'lg' ? TAB_TRACK : dense ? SEGMENT_TRACK_DENSE : SEGMENT_TRACK} ${edges ? EDGE_MASK[edges] : ''} ${className}`}
    >
      {tabs.map((tb) => (
        <button
          key={tb.key}
          type="button"
          onClick={() => onChange(tb.key)}
          aria-pressed={value === tb.key}
          className={tabItemClass(value === tb.key, size, dense, role)}
        >
          {tb.label}
        </button>
      ))}
    </div>
  )
}
