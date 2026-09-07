// The drag itself: what the pointer does to the rail's rows, and how they get there.
//
// Split from `NavColumn.tsx` when that file passed its 400-line ceiling. The seam is by
// subject rather than by convenience: `NavColumn` decides what a row IS and `useNavArrange`
// decides where rows GO, while this is the gesture — the window listeners, the hit-testing
// against the live rows, and the animation that carries them.
//
// A `.ts` file that touches `document` is only legal under `src/admin/tsconfig.json` (the
// root project has no DOM types, deliberately — a server module reaching for `document` must
// fail to compile). Nothing under `src/content` may import it.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { findSpot, type Spot, type Zone } from './useNavArrange'
import { motionOn } from '@/admin/motion'
import type { NavOrder } from '@/types'

/**
 * Everything a drag needs from `useNavArrange`, and nothing else.
 *
 * Named rather than taking the whole object so the two files cannot quietly grow a second
 * dependency on each other.
 */
type Draggable = {
  order: NavOrder
  dragging: string | null
  setDragging: (id: string | null) => void
  preview: (id: string, to: Spot) => void
  commit: () => void
}

export function useNavDrag(arrange: Draggable): void {
  /**
   * FLIP: the rows SLIDE to their new places instead of appearing in them.
   *
   * A reorder is one repaint — every row below the moved one is simply somewhere else on the
   * next frame — and a list that teleports like that reads as a stutter rather than as a
   * move, which is what "not smooth" means when somebody says it about a drag. So: remember
   * where each row was (First), let React place it (Last), take the difference (Invert) and
   * animate that away (Play). ~140ms, the length of a movement the eye follows without
   * waiting for it.
   *
   * On the row's own element via the Web Animations API rather than a CSS transition: a
   * transition on `transform` would also animate nothing at every OTHER render, and would
   * fight the row's own hover and active states.
   *
   * The gate (`motionOn`: the owner's switch and `prefers-reduced-motion`) is honoured by
   * skipping the animation entirely — the list still reorders, it just does not travel.
   */
  const seen = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    /**
     * ONLY WHILE A ROW IS BEING CARRIED.
     *
     * `getBoundingClientRect` on the first row flushes pending layout, and this ran on every
     * render of the rail — which is every route change, every collapse, every rename — to
     * measure twenty rows that had not moved and animate none of them. Nothing outside a drag
     * reorders this list, so nothing outside a drag has a First to remember.
     *
     * Clearing on the way out is the other half: a baseline kept between drags would be
     * measured against a rail that has since collapsed, scrolled or grown a row, and the next
     * drag would open by sliding every row in from wherever it used to be.
     */
    if (!arrange.dragging) {
      seen.current.clear()
      return
    }
    const rows = [...document.querySelectorAll<HTMLElement>('[data-nav-row]')]
    const now = new Map<string, number>()
    const quiet = !motionOn()
    for (const el of rows) {
      const id = el.dataset.navRow
      if (!id) continue
      const top = el.getBoundingClientRect().top
      now.set(id, top)
      const was = seen.current.get(id)
      if (was === undefined || quiet) continue
      const dy = was - top
      // Sub-pixel differences are layout noise, not movement.
      if (Math.abs(dy) < 1) continue
      el.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: 'none' }],
        { duration: 140, easing: 'cubic-bezier(.2,.7,.3,1)' },
      )
    }
    seen.current = now
  })

  /**
   * Where the pointer is, in rail terms — and the move it implies.
   *
   * Read off the LIVE DOM rather than from measurements taken when the drag began: the list
   * reorders under the pointer, so every crossing changes where every other row is. Asking
   * the document each time is a handful of `getBoundingClientRect` calls on at most twenty
   * rows, which is nothing beside re-deriving the geometry ourselves and being wrong about
   * it after the first swap.
   *
   * ⚠️ It reads `arrange.order`, the RENDERED order, and not the ref that leads it. The two
   * halves of this decision have to come from the same instant: the rectangles are where the
   * last paint put the rows, so pairing them with an order that has already moved on gives a
   * destination the pointer is not actually over. One step per frame is the correct rate —
   * that is how often the rectangles are true.
   *
   * Returns true when the order actually changed, which is what tells the row being carried
   * to re-zero its offset.
   */
  const probeAll = (id: string, clientY: number): boolean => {
    // THE WHOLE DOCUMENT, not the aside: the rail draws itself twice — the sticky column
    // and the phone drawer — and only one of them is on screen. The hidden copy measures
    // zero and can never contain a pointer, so asking for both is also asking for the
    // right one.
    const rows = [...document.querySelectorAll<HTMLElement>('[data-nav-row]')].filter((el) => el.dataset.navRow !== id)
    for (const el of rows) {
      const box = el.getBoundingClientRect()
      if (clientY < box.top || clientY > box.bottom) continue
      const other = el.dataset.navRow
      if (!other) continue
      const to = findSpot(arrange.order, other)
      if (!to) return false
      const before = clientY < box.top + box.height / 2
      const at = { zone: to.zone, index: before ? to.index : to.index + 1 }
      const now = findSpot(arrange.order, id)
      // Already there: without this the same crossing fires on every pointermove and the
      // row re-zeroes its offset forty times a second, which reads as a row that will not
      // move at all.
      if (now && now.zone === at.zone && (now.index === at.index || now.index === at.index - 1)) return false
      arrange.preview(id, at)
      return true
    }
    // An empty zone has no rows to aim at, only its floor.
    for (const el of document.querySelectorAll<HTMLElement>('[data-nav-floor]')) {
      const box = el.getBoundingClientRect()
      if (clientY < box.top || clientY > box.bottom) continue
      const zone = el.dataset.navFloor as Zone | undefined
      if (!zone) continue
      const now = findSpot(arrange.order, id)
      if (now && now.zone === zone && now.index === arrange.order[zone].length - 1) return false
      arrange.preview(id, { zone, index: arrange.order[zone].length })
      return true
    }
    return false
  }

  /**
   * The rest of the gesture, on the WINDOW.
   *
   * Not on the row, and this is the whole reason the first drag felt stiff: reordering takes
   * the row's node out of the document and puts it back elsewhere, and a node that leaves the
   * document loses its pointer capture — so the second move never reached it, the row stopped
   * one place from where it started, and `pointerup` never arrived to save anything. The
   * window does not move.
   *
   * `probeRef` rather than `probe` in the dependency list: the probe closes over the rendered
   * order and is therefore a new function on every reorder, and re-subscribing mid-drag drops
   * the moves that land between the two listeners.
   */
  const probeRef = useRef<(id: string, clientY: number) => boolean>(() => false)
  useLayoutEffect(() => { probeRef.current = probeAll })
  useEffect(() => {
    const id = arrange.dragging
    if (!id) return
    const move = (e: PointerEvent) => { probeRef.current(id, e.clientY) }
    const up = () => { arrange.setDragging(null); arrange.commit() }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [arrange.dragging])
}
