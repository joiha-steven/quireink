// What a rail row LOOKS like while the rail is being rearranged, and the pointer handling
// that moves it.
//
// The row itself is not re-implemented here and that is the point: `NavColumn` hands its own
// link, button or switch in as children, and this wraps it. A second set of rows drawn for
// arrange mode would be a second place for a label, an icon or a hover state to drift, and
// the owner would be arranging something that is not quite the rail.
//
// ONLY ON THE OPEN RAIL. Collapsed, the rail is 72px of centred glyphs with no room for a
// grip and two steppers beside a 20px icon, and a row with no label is a row nobody can
// place. The control that enters the mode is hidden there for the same reason the icon switch
// is (`NavColumn`), and leaving the mode on is harmless: nothing draws.
//
// POINTER EVENTS, NOT HTML5 DRAG-AND-DROP, since 2026-09-06. The first version used the
// native API and the report was that a row could be grabbed and would not come: `dragstart`
// on a container whose children are links is where that API is least reliable, it does not
// fire at all on a touch screen, and — the part that decided it — a native drag can only show
// a ghost of the row under the cursor. It cannot open the list. What it has to do instead is
// what a hand expects: the rows above and below PART where the row would land, the row is
// already there while it is still being held, and letting go leaves it exactly there. So the
// list reorders live under the pointer, and the pointer stream stays ours the whole way.
import type { ReactNode } from 'react'
import { useAdminT } from './I18nProvider'
import { IconGrip, IconChevronLeft } from './navIcons'
import type { Zone } from './useNavArrange'

const STEP =
  'grid h-6 w-4 shrink-0 place-items-center rounded text-neutral-400 transition-colors '
  + 'hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent '
  + 'dark:hover:bg-neutral-700 dark:hover:text-neutral-200'

/**
 * One row, wrapped so it can be picked up.
 *
 * `touch-none` is load-bearing on a touch screen: without it the browser claims the gesture
 * for scrolling the instant the finger moves vertically, which is every drag in a vertical
 * list. The wrapped row is inert while arranging — `pointer-events-none` on the child — so a
 * press anywhere along the row is a grab rather than a click on the link inside it.
 */
export function Arrangeable({
  id, held, onGrab, onNudge, first, last, children,
}: {
  id: string
  /** This row is the one in the hand. */
  held: boolean
  onGrab: (id: string) => void
  onNudge: (id: string, dir: -1 | 1) => void
  /** Ends of the WHOLE column, not of this zone: the steppers cross zone boundaries. */
  first: boolean
  last: boolean
  children: ReactNode
}) {
  const t = useAdminT()

  // NO TRANSFORM ON THE CARRIED ROW, and that was tried first. Following the pointer by a few
  // pixels between crossings looks right in isolation and is wrong here: the column scrolls
  // (`overflow-y-auto`, because arrange mode makes the rail taller than the glass), so a row
  // pushed past the edge of that box is CLIPPED — carried towards the footer it simply
  // vanished, mid-drag, with the pointer still down. The row's own movement is the reorder:
  // it steps to each new place as the pointer crosses a neighbour, which is also the thing
  // the list has to show anyway.
  //
  // ⚠️ THE ROW LISTENS FOR NOTHING BUT THE FIRST PRESS. Everything after it is on the window
  // (`NavColumn`), and that is the fix for a drag that moved one row and then died: reordering
  // the list means React takes this node out of the DOM and puts it back somewhere else, and
  // a node that leaves the document LOSES ITS POINTER CAPTURE. So the second `pointermove`
  // never arrived, `pointerup` never arrived either, and the arrangement was never saved —
  // which is exactly what "it feels stiff" was describing.

  return (
    <div
      data-nav-row={id}
      onPointerDown={(e) => {
        // Left button or a finger. A right-click on a row should still be a right-click, and
        // the steppers are buttons that have to keep their own clicks.
        if (e.button !== 0) return
        if ((e.target as HTMLElement).closest('[data-nav-step]')) return
        e.preventDefault()
        onGrab(id)
      }}
      className={`flex touch-none select-none items-center gap-0.5 rounded-lg ${
        held
          ? 'relative z-10 cursor-grabbing bg-white shadow-[0_2px_8px_rgba(0,0,0,.16)] dark:bg-neutral-800'
          : 'cursor-grab'
      }`}
    >
      <span className="shrink-0 text-neutral-400" aria-hidden><IconGrip /></span>
      <div className="min-w-0 flex-1 pointer-events-none">{children}</div>
      {/* The keyboard's route, and the one a finger can take without dragging at all. A
          chevron turned a quarter, the same glyph the rail already uses for a direction. */}
      <button type="button" data-nav-step="up" disabled={first} onClick={() => onNudge(id, -1)} aria-label={t.navMoveUp} title={t.navMoveUp} className={STEP}>
        <span className="grid place-items-center rotate-90"><IconChevronLeft /></span>
      </button>
      <button type="button" data-nav-step="down" disabled={last} onClick={() => onNudge(id, 1)} aria-label={t.navMoveDown} title={t.navMoveDown} className={STEP}>
        <span className="grid place-items-center -rotate-90"><IconChevronLeft /></span>
      </button>
    </div>
  )
}

/**
 * An empty list still has to be reachable.
 *
 * Move every row out of "Everything else" and the group becomes a zero-height div with no
 * rows to aim at, so the list would be closed for good. This is each zone's floor: a target
 * with a height of its own, and it only takes up room while the zone is empty.
 */
export function ZoneFloor({ zone, empty }: { zone: Zone; empty: boolean }) {
  return (
    <div
      data-nav-floor={zone}
      className={`rounded-lg border border-dashed transition-colors ${
        empty ? 'h-9 border-neutral-300 dark:border-neutral-600' : 'h-3 border-transparent'
      }`}
    />
  )
}

/**
 * A thing on the rail that can only be ON or OFF.
 *
 * The wordmark and the search button are not rows and never go in a list, so there is nothing
 * to drag and nothing to reorder — the only question they answer is whether they are there.
 * A tick rather than a switch, because it reads the same way the rail's other preferences do
 * and needs no colour to say which state it is in.
 */
export function SwitchRow({ id, label, on, onToggle }: { id: string; label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      data-nav-switch={id}
      aria-checked={on}
      onClick={onToggle}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      <span
        aria-hidden
        className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-xs leading-none ${
          on
            ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
            : 'border-neutral-300 text-transparent dark:border-neutral-600'
        }`}
      >
        ✓
      </span>
      <span className="truncate">{label}</span>
    </button>
  )
}
