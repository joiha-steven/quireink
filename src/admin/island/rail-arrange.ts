// Arrange mode: the rail's rows, picked up and put down somewhere else.
//
// Its own file, and loaded only on the way IN — a dynamic import from `rail.ts`, so a rail
// nobody is rearranging costs nothing for this. That is also why the mode is the one place the
// island adds elements: the grip and two steppers on eighteen rows would be ~14 KB of SVG in
// every page for something entered twice a year.
//
// IT ADDS NO MARKUP OF ITS OWN. The wrapper is a `<template>` the server put in the page, the
// footer's labelled rows and the two switches are drawn there too and merely unhidden. This
// file moves nodes and writes attributes; what a row looks like stays one file's business.
//
// TWO WAYS TO MOVE A ROW, and the second is not a courtesy. A drag is a pointer event on every
// browser that has one and does not exist on a touch screen at all — an iPad in landscape is
// 1024px wide, which is exactly where this rail appears, so a drag-only editor would ship a
// feature that cannot be used on the device most likely to want it. The steppers are that
// answer, and they are the keyboard's too: a row can be moved with Tab and Return.
//
// EVERY MOVE IS SAVED, immediately. The alternative is a Save button on a rail, and a rail is
// where you go to leave the screen — an arrangement that only survives if you remember to press
// something is an arrangement that gets lost by the second click.
import { ZONES, findSpot, moveTo, step, type Spot, type Zone } from '@/admin-shared/rail'
import { reconcileNavOrder } from '@/content/nav-order'
import { motionOn } from '@/admin/motion'
import type { NavOrder } from '@/types'
import type { RailData } from './rail'

const html = document.documentElement

/** The sticky column is the one that arranges. The phone's drawer has no room for a grip. */
const rail = (): HTMLElement | null => document.getElementById('admin-rail')

/** Where each zone's rows live in the DOM, in the order they are drawn. */
const HOST: Record<Zone, string> = {
  primary: '#admin-rail .rail-column',
  more: '#admin-rail .rail-group',
  footer: '#admin-rail .rail-foot-rows',
}

const hostOf = (zone: Zone): HTMLElement | null => document.querySelector<HTMLElement>(HOST[zone])

/** Every row element, by id, across the three zones. */
function rowsById(): Map<string, HTMLElement> {
  const out = new Map<string, HTMLElement>()
  for (const zone of ZONES) {
    for (const el of hostOf(zone)?.querySelectorAll<HTMLElement>(':scope > [data-rail-id], :scope > .rail-arrangeable') ?? []) {
      const id = el.dataset.railId ?? el.dataset.navRow
      if (id) out.set(id, el)
    }
  }
  return out
}

export function enterArrangeMode(data: RailData, publishWidth: () => void): void {
  if (!rail() || html.getAttribute('data-rail-arranging') === '1') return

  let order: NavOrder = data.order
  let dragging: string | null = null
  const template = document.querySelector<HTMLTemplateElement>('#rail-arrangeable')
  if (!template) return

  /**
   * Put the rows where `order` says, wrapping each so it can be picked up.
   *
   * The wrapper is MOVED rather than rebuilt on every reorder: a row that is re-created loses
   * whatever the pointer was doing to it, and re-creating the one being dragged is how a list
   * ends up dropping the gesture halfway down the column.
   */
  function paint(): void {
    const found = rowsById()
    for (const zone of ZONES) {
      const host = hostOf(zone)
      const floorEl = host?.querySelector<HTMLElement>(':scope > [data-nav-floor]')
      if (!host || !floorEl) continue
      for (const id of order[zone]) {
        let el = found.get(id)
        if (!el) continue
        if (!el.classList.contains('rail-arrangeable')) {
          const wrap = template!.content.firstElementChild!.cloneNode(true) as HTMLElement
          wrap.dataset.navRow = id
          el.replaceWith(wrap)
          wrap.querySelector('.rail-carried')!.append(el)
          el = wrap
          found.set(id, wrap)
        }
        // ⚠️ BEFORE THE FLOOR, never appended to the host.
        //
        // The floor is each zone's end marker as well as its drop target, and inserting there
        // is what keeps the rest of the host intact. `.rail-column` holds the primary rows AND
        // the group's own div after them, so `host.append()` walked every primary row past the
        // group — the rail came up with "everything else" on top, and a drag then started from
        // whichever row that put first.
        //
        // It is also what keeps `aside nav > a` meaning "a primary destination", which is how
        // the tour tells a promoted assistant from one sitting in the group.
        host.insertBefore(el, floorEl)
      }
      // Room of its own only while the zone is empty — a zero-height div is a list that cannot
      // be dropped into again.
      floorEl.toggleAttribute('data-empty', order[zone].length === 0)
    }
    ends()
  }

  /** The steppers at the ends of the WHOLE column are dead: there is nowhere further to go. */
  function ends(): void {
    const walk = ZONES.flatMap((zone) => order[zone])
    const found = rowsById()
    walk.forEach((id, i) => {
      const el = found.get(id)
      el?.querySelector<HTMLButtonElement>('[data-nav-step="up"]')?.toggleAttribute('disabled', i === 0)
      el?.querySelector<HTMLButtonElement>('[data-nav-step="down"]')?.toggleAttribute('disabled', i === walk.length - 1)
    })
  }

  /**
   * FLIP: the rows SLIDE to their new places instead of appearing in them.
   *
   * A reorder is one repaint — every row below the moved one is simply somewhere else on the
   * next frame — and a list that teleports like that reads as a stutter rather than a move.
   * So: remember where each row was, let the DOM place it, take the difference and animate that
   * away. ~140ms, the length of a movement the eye follows without waiting for it.
   *
   * On the row's own element via the Web Animations API rather than a CSS transition: a
   * transition on `transform` would fight the row's own hover and active states.
   */
  function withSlide(change: () => void): void {
    if (!motionOn()) { change(); return }
    const before = new Map<string, number>()
    for (const [id, el] of rowsById()) before.set(id, el.getBoundingClientRect().top)
    change()
    for (const [id, el] of rowsById()) {
      const was = before.get(id)
      if (was === undefined) continue
      const dy = was - el.getBoundingClientRect().top
      // Sub-pixel differences are layout noise, not movement.
      if (Math.abs(dy) < 1) continue
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }],
        { duration: 140, easing: 'cubic-bezier(.2,.7,.3,1)' })
    }
  }

  /**
   * Store the order, and put it back if the server refuses.
   *
   * WHAT IS STORED AND WHAT IS DRAWN ARE NOT THE SAME OBJECT, and Reset is why: it stores three
   * empty lists, which mean "whatever the code says". Drawn literally the rail would go blank
   * the moment it was pressed. Everything shown goes through the same reconcile the server's
   * copy does; for an ordinary move the two are identical anyway.
   */
  async function save(next: NavOrder): Promise<void> {
    const before = order
    order = reconcileNavOrder(next, data.defaults)
    withSlide(paint)
    const undo = (why: string): void => {
      // PUT BACK, not left as it was. Keeping an arrangement the server refused means the
      // message says it was not saved while the screen goes on showing it, and the next drag is
      // made on top of a state that does not exist anywhere.
      order = reconcileNavOrder(before, data.defaults)
      withSlide(paint)
      window.dispatchEvent(new CustomEvent('quire:toast', {
        detail: { message: `${data.words.navArrangeFailed} (${why})`, kind: 'error' },
      }))
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
  }

  /**
   * Where the pointer is, in rail terms — and the move it implies.
   *
   * Read off the LIVE DOM rather than from measurements taken when the drag began: the list
   * reorders under the pointer, so every crossing changes where every other row is. Asking the
   * document each time is a handful of rectangles on at most twenty rows, which is nothing
   * beside re-deriving the geometry ourselves and being wrong about it after the first swap.
   */
  function probe(id: string, clientY: number): void {
    const here = findSpot(order, id)
    for (const [other, el] of rowsById()) {
      if (other === id) continue
      const box = el.getBoundingClientRect()
      if (clientY < box.top || clientY > box.bottom) continue
      const to = findSpot(order, other)
      if (!to) return
      const at: Spot = { zone: to.zone, index: clientY < box.top + box.height / 2 ? to.index : to.index + 1 }
      // Already there: without this the same crossing fires on every pointermove and the row
      // re-settles forty times a second, which reads as a row that will not move at all.
      if (here && here.zone === at.zone && (here.index === at.index || here.index === at.index - 1)) return
      order = moveTo(order, id, at)
      withSlide(paint)
      return
    }
    // An empty zone has no rows to aim at, only its floor.
    for (const el of document.querySelectorAll<HTMLElement>('#admin-rail [data-nav-floor]')) {
      const box = el.getBoundingClientRect()
      if (clientY < box.top || clientY > box.bottom) continue
      const zone = el.dataset.navFloor as Zone | undefined
      if (!zone) continue
      if (here && here.zone === zone && here.index === order[zone].length - 1) return
      order = moveTo(order, id, { zone, index: order[zone].length })
      withSlide(paint)
      return
    }
  }

  /**
   * THE PRESS GOES TO THE ROW, EVERYTHING AFTER IT TO THE WINDOW.
   *
   * Not because it is tidier: reordering takes the row's node out of its place and puts it back
   * elsewhere, and a node that moves in the document can lose its pointer capture. Bound to the
   * row, the second move never arrived, the row stopped one place from where it started, and
   * `pointerup` never came to save anything. The window does not move.
   */
  const onMove = (e: PointerEvent): void => { if (dragging) probe(dragging, e.clientY) }
  const onUp = (): void => {
    if (!dragging) return
    document.querySelector(`[data-nav-row="${dragging}"]`)?.removeAttribute('data-held')
    dragging = null
    void save(order)
  }
  const onDown = (e: PointerEvent): void => {
    // Left button or a finger. A right-click on a row should still be a right-click, and the
    // steppers are buttons that have to keep their own clicks.
    if (e.button !== 0) return
    const target = e.target as HTMLElement | null
    if (target?.closest('[data-nav-step]')) return
    const row = target?.closest<HTMLElement>('[data-nav-row]')
    if (!row?.dataset.navRow) return
    e.preventDefault()
    dragging = row.dataset.navRow
    row.setAttribute('data-held', '')
  }
  const onStep = (e: Event): void => {
    const button = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-nav-step]')
    const row = button?.closest<HTMLElement>('[data-nav-row]')
    if (!button || !row?.dataset.navRow) return
    void save(step(order, row.dataset.navRow, button.dataset.navStep === 'up' ? -1 : 1))
  }
  const onSwitch = (e: Event): void => {
    const b = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-nav-switch]')
    const id = b?.dataset.navSwitch
    if (!b || !id) return
    const on = b.getAttribute('aria-checked') !== 'true'
    b.setAttribute('aria-checked', String(on))
    html.setAttribute(`data-rail-${id}`, on ? '1' : '0')
    void save({ ...order, hidden: on ? order.hidden.filter((h) => h !== id) : [...order.hidden, id] })
  }

  const column = rail()!
  column.addEventListener('pointerdown', onDown)
  column.addEventListener('click', onStep)
  column.addEventListener('click', onSwitch)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)

  /**
   * Back to the rail the product ships: three empty lists mean "whatever the code says".
   *
   * `hidden` is deliberately kept. Putting the rows back where they started is one wish and
   * asking for the wordmark back is another, and a reset that did both would take away the only
   * way to say the first without the second.
   */
  const onReset = (): void => { void save({ primary: [], more: [], footer: [], hidden: order.hidden }) }
  const reset = document.querySelector('[data-nav-reset]')
  reset?.addEventListener('click', onReset)

  function leave(): void {
    column.removeEventListener('pointerdown', onDown)
    column.removeEventListener('click', onStep)
    column.removeEventListener('click', onSwitch)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    reset?.removeEventListener('click', onReset)
    done?.removeEventListener('click', leave)
    for (const wrap of document.querySelectorAll<HTMLElement>('.rail-arrangeable')) {
      const row = wrap.querySelector('.rail-carried')?.firstElementChild
      if (row) wrap.replaceWith(row)
    }
    html.setAttribute('data-rail-arranging', '0')
    publishWidth()
    // The order this mode leaves behind is what the rest of the rail draws from now on, so the
    // page's own copy is updated rather than left describing the arrangement it opened with.
    data.order = order
  }
  const done = document.querySelector('[data-nav-arrange="on"]')
  done?.addEventListener('click', leave)

  html.setAttribute('data-rail-arranging', '1')
  publishWidth()
  paint()
}
