// The admin's tab strips — the two of them, because `lg` and `sm` were always two objects.
//
// Split out of `kit.tsx` on 2026-08-15 for its 400-line cap, and the seam holds up on its own:
// everything here answers "how does a set of mutually exclusive choices look", and nothing
// else in the kit asks that.

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { scrollBehavior } from '@/admin/motion'
// The class strings moved to `@/admin-shared` when the trash became a page (ADR 0054); the
// server writes the same strip from them. Re-exported, so the twenty-odd call sites that reach
// for `TAB_TRACK`, `SEGMENT_TRACK` or `tabItemClass` keep the import they had.
import {
  SEGMENT_TRACK, SEGMENT_TRACK_DENSE, SEGMENT_TRACK_DENSE_PLACE, SEGMENT_TRACK_PLACE,
  TAB_TRACK, TAB_TRACK_DENSE, tabItemClass, type TabRole, type TabSize,
} from '@/admin-shared/tabs'

export {
  SEGMENT_TRACK, SEGMENT_TRACK_DENSE, SEGMENT_TRACK_DENSE_PLACE, SEGMENT_TRACK_PLACE,
  TAB_TRACK, TAB_TRACK_DENSE, tabItemClass, type TabRole, type TabSize,
}

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
  panelId,
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
   * A tighter strip, for a 320px pane. Neither size wraps when dense — a folded second line
   * is a crooked control — so every caller owes labels short enough to fit in every language
   * (the write pane carries its own `scope*` strings for this). `sm dense` is the full-width
   * segmented row; `lg dense` is the underlined strip at 13px with a 16px gap, which is what
   * the write pane's kind row wears: six segments in 288px broke their own labels over two
   * lines in every language once Notes joined them (2026-09-09), and a strip of words on a
   * hairline is the row the desk mock drew there in the first place.
   */
  dense?: boolean
  className?: string
  /**
   * The id of the panel this strip switches, when there IS one.
   *
   * Only a strip that swaps a region of the page is a tablist; the write pane's scope filter
   * swaps nothing, it narrows a list that is already there. Naming the panel is what makes
   * the difference expressible, so this prop is also the switch: with it the strip is a
   * tablist, without it the buttons stay pressed-state buttons, which is what a filter is.
   */
  panelId?: string
}) {
  const track = useRef<HTMLDivElement>(null)
  // Only the segmented strip scrolls; the lg strip wraps and cannot clip.
  const edges = useScrollEdges(track, size === 'sm')
  const tablist = panelId !== undefined
  const index = tabs.findIndex((tb) => tb.key === value)

  /**
   * THE CHOSEN TAB COMES INTO VIEW, and on a phone that is the difference between a strip
   * and a strip you can use. Seven settings tabs are 720px of labels in a 358px sheet, so
   * four of them are off the right edge — and arriving on `?tab=account`, or arrowing to it,
   * left the selection scrolled out of sight with the strip apparently showing "Blog".
   *
   * `inline: 'center'` rather than `'nearest'`: centring also reveals what is on either
   * SIDE of the current tab, which is the whole reason the strip is a strip.
   */
  useEffect(() => {
    const el = track.current?.querySelectorAll('button')[index]
    if (!(el instanceof HTMLElement) || !track.current) return
    if (track.current.scrollWidth <= track.current.clientWidth) return
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: scrollBehavior() })
  }, [index])

  /**
   * ARROWS MOVE BETWEEN TABS, and Tab leaves the strip. That is the whole of the difference
   * between a tablist and eleven buttons: with buttons, reaching the eighth settings tab from
   * the keyboard costs eight presses of Tab, and every one of them is also a press that has to
   * NOT be Enter. In a tablist the strip is one stop and the arrows walk it.
   *
   * ⚠️ SELECTION FOLLOWS FOCUS, which is the pattern for tabs whose panels are already in
   * memory — every panel here is a render away — and it is what makes the arrows feel like
   * arrows rather than like a two-step. `Home`/`End` are the ends, as everywhere else.
   */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!tablist) return
    const to = e.key === 'ArrowRight' ? index + 1
      : e.key === 'ArrowLeft' ? index - 1
      : e.key === 'Home' ? 0
      : e.key === 'End' ? tabs.length - 1
      : null
    if (to === null) return
    e.preventDefault()
    // Wraps, because a strip that stops at its ends makes the reader look at it to find out
    // whether the key did anything.
    const next = tabs[(to + tabs.length) % tabs.length]
    if (!next) return
    onChange(next.key)
    const el = track.current?.querySelectorAll('button')[(to + tabs.length) % tabs.length]
    if (el instanceof HTMLElement) el.focus()
  }

  return (
    <div
      ref={track}
      role={tablist ? 'tablist' : undefined}
      onKeyDown={onKeyDown}
      className={`${
        size === 'lg'
          ? (dense ? TAB_TRACK_DENSE : TAB_TRACK)
          : dense
            ? (role === 'place' ? SEGMENT_TRACK_DENSE_PLACE : SEGMENT_TRACK_DENSE)
            : (role === 'place' ? SEGMENT_TRACK_PLACE : SEGMENT_TRACK)
      } ${edges ? EDGE_MASK[edges] : ''} ${className}`}
    >
      {tabs.map((tb) => (
        <button
          key={tb.key}
          type="button"
          onClick={() => onChange(tb.key)}
          role={tablist ? 'tab' : undefined}
          aria-selected={tablist ? value === tb.key : undefined}
          aria-controls={tablist ? panelId : undefined}
          // ROVING, and only in a tablist: exactly one stop for the whole strip, so Tab
          // reaches the panel rather than walking seven buttons to get there.
          tabIndex={tablist ? (value === tb.key ? 0 : -1) : undefined}
          aria-pressed={tablist ? undefined : value === tb.key}
          className={tabItemClass(value === tb.key, size, dense, role)}
        >
          {tb.label}
        </button>
      ))}
    </div>
  )
}
