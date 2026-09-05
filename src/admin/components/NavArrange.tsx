// What a rail row LOOKS like while the rail is being rearranged, and the control that turns
// that mode on.
//
// The row itself is not re-implemented here and that is the point: `AdminSidebar` hands its
// own link, button or switch in as children, and this wraps it. A second set of rows drawn
// for arrange mode would be a second place for a label, an icon or a hover state to drift,
// and the owner would be arranging something that is not quite the rail.
//
// ONLY ON THE OPEN RAIL. Collapsed, the rail is 72px of centred glyphs with no room for a
// grip and two steppers beside a 20px icon, and a row with no label is a row nobody can
// place. The control that enters the mode is hidden there for the same reason the icon
// switch is (`AdminSidebar`), and leaving the mode on is harmless: nothing draws.
import type { ReactNode } from 'react'
import { useAdminT } from './I18nProvider'
import { IconGrip, IconChevronLeft } from './navIcons'
import type { Spot, Zone } from './useNavArrange'

const STEP =
  'grid h-6 w-4 shrink-0 place-items-center rounded text-neutral-400 transition-colors '
  + 'hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent '
  + 'dark:hover:bg-neutral-700 dark:hover:text-neutral-200'

/**
 * One row, wrapped so it can be picked up.
 *
 * The drop target is the ROW, not a gap between rows: a 4px seam is a target nobody hits, and
 * every list that has tried it ends up with rows that refuse to move. Dropping on the top
 * half of a row means "above it" and the bottom half means "below it", which is also what the
 * line drawn while hovering says.
 *
 * The wrapped row is inert while arranging — `pointer-events-none` on the child rather than a
 * `preventDefault` on the click, because a link that swallows its own click still shows a
 * pointer cursor and still answers a middle-click. Here the whole row is a handle.
 */
export function Arrangeable({
  id, zone, index, dragging, hovered, onDragStart, onDragEnd, onHover, onDrop, onNudge,
  first, last, children,
}: {
  id: string
  zone: Zone
  index: number
  dragging: string | null
  /** `${zone}:${index}:${'before' | 'after'}` while a row is held over this one. */
  hovered: string | null
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onHover: (key: string | null) => void
  onDrop: (to: Spot) => void
  onNudge: (id: string, dir: -1 | 1) => void
  /** Ends of the WHOLE column, not of this zone: the steppers cross zone boundaries. */
  first: boolean
  last: boolean
  children: ReactNode
}) {
  const t = useAdminT()
  const held = dragging === id
  const edge = (e: { currentTarget: HTMLElement; clientY: number }): 'before' | 'after' => {
    const box = e.currentTarget.getBoundingClientRect()
    return e.clientY < box.top + box.height / 2 ? 'before' : 'after'
  }
  const line = (side: 'before' | 'after') => hovered === `${zone}:${index}:${side}`

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); onDragStart(id) }}
      onDragEnd={() => { onHover(null); onDragEnd() }}
      onDragOver={(e) => {
        // Without BOTH of these the browser refuses the drop and the row springs back, which
        // reads as "this row cannot be moved" rather than as a missing event handler.
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        onHover(`${zone}:${index}:${edge(e)}`)
      }}
      onDragLeave={() => onHover(null)}
      onDrop={(e) => {
        e.preventDefault()
        const side = edge(e)
        onHover(null)
        onDrop({ zone, index: side === 'before' ? index : index + 1 })
      }}
      data-nav-row={id}
      className={`flex items-center gap-0.5 rounded-lg transition-opacity ${held ? 'opacity-40' : ''} ${
        line('before') ? 'border-t-2 border-neutral-900 dark:border-white' : 'border-t-2 border-transparent'
      } ${line('after') ? 'border-b-2 border-neutral-900 dark:border-white' : 'border-b-2 border-transparent'}`}
    >
      <span className="shrink-0 cursor-grab text-neutral-400 active:cursor-grabbing" aria-hidden><IconGrip /></span>
      <div className="min-w-0 flex-1 pointer-events-none">{children}</div>
      {/* The touch and keyboard route. A chevron turned a quarter, the same glyph the rail
          already uses for a direction. */}
      {/* `data-*` because the tour drives these for real, and every label here is translated
          eleven ways — a flow matching on words is a flow that passes in one language. */}
      <button type="button" data-nav-step="up" data-nav-row={id} disabled={first} onClick={() => onNudge(id, -1)} aria-label={t.navMoveUp} title={t.navMoveUp} className={STEP}>
        <span className="grid place-items-center rotate-90"><IconChevronLeft /></span>
      </button>
      <button type="button" data-nav-step="down" data-nav-row={id} disabled={last} onClick={() => onNudge(id, 1)} aria-label={t.navMoveDown} title={t.navMoveDown} className={STEP}>
        <span className="grid place-items-center -rotate-90"><IconChevronLeft /></span>
      </button>
    </div>
  )
}

/**
 * An empty list still has to be a target.
 *
 * Drag every row out of "Everything else" and the group becomes a zero-height div, so there
 * is nowhere left to drop the row that would put one back — the list would be closed for
 * good. This is the floor of each zone: invisible until something is being dragged.
 */
export function ZoneFloor({ zone, count, onDrop, onHover, hovered }: {
  zone: Zone
  count: number
  onDrop: (to: Spot) => void
  onHover: (key: string | null) => void
  hovered: string | null
}) {
  const lit = hovered === `${zone}:floor`
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onHover(`${zone}:floor`) }}
      onDragLeave={() => onHover(null)}
      onDrop={(e) => { e.preventDefault(); onHover(null); onDrop({ zone, index: count }) }}
      className={`rounded-lg border border-dashed transition-colors ${
        lit ? 'h-8 border-neutral-400 bg-neutral-100 dark:border-neutral-500 dark:bg-neutral-800' : 'h-4 border-transparent'
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
        className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] leading-none ${
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
