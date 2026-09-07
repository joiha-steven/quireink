// Arrange mode: the rail's rows, picked up and put down somewhere else.
//
// Split from `AdminSidebar.tsx` because that file is a rail and this is an editor that
// happens to run inside one — and because the rail was already within a dozen lines of its
// 400-line ceiling. The seam is the same one `navDestinations` uses: the rail knows how a row
// LOOKS, this knows where rows GO.
//
// TWO WAYS TO MOVE A ROW, and the second is not a courtesy. Native drag-and-drop is a mouse
// event on every browser that has it and does not exist on a touch screen at all — an iPad in
// landscape is 1024px wide, which is exactly where this rail appears, so a drag-only editor
// would ship a feature that cannot be used on the device most likely to want it. The up/down
// buttons are that answer, and they are the keyboard's answer too: a row can be moved with
// Tab and Return, which no drag can be.
//
// EVERY MOVE IS SAVED, immediately. The alternative is a Save button on a rail, and a rail is
// where you go to leave the screen — an arrangement that only survives if you remember to
// press something is an arrangement that gets lost by the second click.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { NavOrder } from '@/types'
import { reconcileNavOrder } from '@/content/nav-order'

/** The three lists, in the order they are drawn — which is also the order a row steps through. */
export const ZONES = ['primary', 'more', 'footer'] as const
export type Zone = (typeof ZONES)[number]

export type Spot = { zone: Zone; index: number }

const clone = (o: NavOrder): NavOrder =>
  ({ primary: [...o.primary], more: [...o.more], footer: [...o.footer], hidden: [...o.hidden] })

/** Where an id currently sits, or null when it is not in the order at all. */
export function findSpot(order: NavOrder, id: string): Spot | null {
  for (const zone of ZONES) {
    const index = order[zone].indexOf(id)
    if (index !== -1) return { zone, index }
  }
  return null
}

/**
 * Move `id` so that it lands at `to`.
 *
 * The index is read AFTER the row is lifted out, which is the whole reason this is a function
 * rather than a splice at the call site: dragging a row down inside its own list, the target
 * index counts the row itself, and inserting at that number leaves it one place short of
 * where it was dropped. Every off-by-one in a drag list is this one.
 */
export function moveTo(order: NavOrder, id: string, to: Spot): NavOrder {
  const from = findSpot(order, id)
  if (!from) return order
  const next = clone(order)
  next[from.zone].splice(from.index, 1)
  const shift = from.zone === to.zone && from.index < to.index ? 1 : 0
  const at = Math.max(0, Math.min(to.index - shift, next[to.zone].length))
  next[to.zone].splice(at, 0, id)
  return next
}

/**
 * One step up or down, treating the three lists as ONE column.
 *
 * The buttons are the touch and keyboard route, so they have to reach everywhere a drag can,
 * and that includes across a zone boundary: stepping off the bottom of the main column puts
 * the row at the top of the group, and off the bottom of the group puts it in the footer.
 * Stopping at each boundary would leave rows that can be dragged into the footer but never
 * walked there.
 */
export function step(order: NavOrder, id: string, dir: -1 | 1): NavOrder {
  const from = findSpot(order, id)
  if (!from) return order
  const zoneAt = ZONES.indexOf(from.zone)
  const target = from.index + dir

  if (target >= 0 && target <= order[from.zone].length - 1) {
    return moveTo(order, id, { zone: from.zone, index: dir === 1 ? target + 1 : target })
  }
  const nextZone = ZONES[zoneAt + dir]
  if (!nextZone) return order
  return moveTo(order, id, { zone: nextZone, index: dir === 1 ? 0 : order[nextZone].length })
}

/**
 * The order the rail draws, the mode it is in, and the two ways to change it.
 *
 * `stored` is what the server last said. It is reconciled here rather than by the caller so
 * that a row added by an upgrade appears the moment the rail mounts, in the place the product
 * designed for it, without anybody saving anything.
 */
export function useNavArrange(stored: NavOrder, defaults: NavOrder, onError: (message: string) => void) {
  const [order, setOrder] = useState<NavOrder>(() => reconcileNavOrder(stored, defaults))
  // The order as of RIGHT NOW, not as of the last render.
  //
  // A drag asks "where is this row?" on every pointermove, and several moves can land inside
  // one frame — a quick drag, or a test firing them in a loop. Read from `order` those all see
  // the state the last render closed over, compute the same destination, and the row walks one
  // step instead of six. The ref is written the moment anything moves.
  const live = useRef(order)
  const remember = (next: NavOrder): NavOrder => { live.current = next; return next }
  const [arranging, setArranging] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)

  // The server's answer wins on arrival and whenever it CHANGES — and on nothing else.
  //
  // ⚠️ `dragging` was in this list, so letting go re-ran the effect against the `stored` prop
  // the shell was still holding — the copy from before the PUT — and the row sprang back to
  // where it came from a beat after it landed. The server had it right and the screen had it
  // wrong, which is the worst way round: the arrangement was saved and looked lost.
  //
  // `stored` and `defaults` are fresh objects on every render of the shell, so the effect is
  // keyed on their CONTENT. Keyed on the objects themselves it would run on every render and
  // undo every move a beat after it was made.
  useEffect(() => {
    setOrder(remember(reconcileNavOrder(stored, defaults)))
  }, [JSON.stringify(stored), JSON.stringify(defaults)])


  const save = useCallback(async (next: NavOrder) => {
    // WHAT IS STORED AND WHAT IS DRAWN ARE NOT THE SAME OBJECT, and Reset is why. It stores
    // three empty lists, which mean "whatever the code says" — draw that literally and the
    // rail goes blank the moment it is pressed, staying blank until the next page load put
    // the reconciliation back. Everything shown goes through the same reconcile the server's
    // copy does; for an ordinary move the two are identical anyway.
    // What was on screen before the move, so a refusal can put it back.
    const before = live.current
    setOrder(remember(reconcileNavOrder(next, defaults)))
    const undo = (why: string) => {
      // PUT BACK, not left as it was. The rail used to keep an arrangement the server had
      // refused, so the toast said it was not saved while the screen went on showing it,
      // and the next drag was made on top of a state that does not exist anywhere.
      setOrder(remember(reconcileNavOrder(before, defaults)))
      onError(why)
    }
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ navOrder: next }),
      })
      if (!res.ok) undo(`PUT /api/settings -> ${res.status}`)
    } catch {
      // Offline, or the tab was closed mid-flight.
      undo('offline')
    }
  }, [onError, JSON.stringify(defaults)])

  return {
    order,
    arranging,
    dragging,
    setDragging,
    toggleArranging: () => setArranging((v) => !v),
    /** Where a row is at this instant — the drag reads this, never the rendered `order`. */
    latest: () => live.current,
    /** Drop `id` at `to`. */
    drop: (id: string, to: Spot) => { void save(moveTo(live.current, id, to)) },
    /**
     * Move a row WITHOUT saving — what a drag in progress does.
     *
     * The rail reorders under the finger on every crossing, so the row being dragged is
     * always already in the place it would land and the two rows around it have already
     * opened for it. Only letting go writes anything: a drag across six rows would otherwise
     * be six PUTs, five of them describing an arrangement nobody asked for.
     */
    preview: (id: string, to: Spot) => { setOrder(remember(moveTo(live.current, id, to))) },
    /** Let go: store whatever the drag left on screen. */
    commit: () => { void save(live.current) },
    /** Walk `id` one row up or down, across zones when it reaches an end. */
    nudge: (id: string, dir: -1 | 1) => { void save(step(live.current, id, dir)) },
    /** Whether a switchable row is off. Only `logo` and `search` are, today. */
    isHidden: (id: string) => order.hidden.includes(id),
    /** Turn the wordmark or the search button off, or back on. */
    toggleHidden: (id: string) => {
      const next = clone(live.current)
      next.hidden = next.hidden.includes(id) ? next.hidden.filter((h) => h !== id) : [...next.hidden, id]
      void save(next)
    },
    /**
     * Back to the rail the product ships: three empty lists mean "whatever the code says".
     *
     * `hidden` is deliberately kept. Putting the rows back where they started is one wish and
     * asking for the wordmark back is another, and a reset that did both would take away the
     * only way to say the first without the second.
     */
    reset: () => { void save({ primary: [], more: [], footer: [], hidden: live.current.hidden }) },
  }
}
