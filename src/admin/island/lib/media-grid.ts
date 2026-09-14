// The grid's behaviour, shared by the library page and the picker overlay.
//
// Both draw the same tiles from the same description (`admin-shared/media-marks.ts`), and both
// need the same four things done to them: tick a box, tick a RUN of boxes, narrow by name, and
// put them in a different order. Neither ever rebuilds a tile — narrowing hides, sorting moves
// the node the server already sent (`docs/admin-one-dom.md`).
//
// In `island/lib/` because `scripts/build-admin.ts` globs `island/*.ts` without recursing: a
// file one directory down is a module, not a browser entry of its own.
import { TICK_HOLD_OFF, TICK_HOLD_ON, TRAY_IDLE, TRAY_ON } from '@/admin-shared/media-marks'

export type Grid = {
  root: HTMLElement
  tiles: () => HTMLElement[]
  /** The tiles still on screen, in the order they are on screen. */
  shown: () => HTMLElement[]
  picked: () => string[]
  pick: (url: string, shift: boolean) => void
  clear: () => void
  narrow: (query: string) => number
  order: (by: 'new' | 'name' | 'size') => void
  onChange: (run: () => void) => void
}

const HTML = (el: Element | null): HTMLElement | null => el instanceof HTMLElement ? el : null

/**
 * What a chosen tile looks like.
 *
 * A chosen thing in this admin is pressed INTO the page, and a picture in a tray is the most
 * literal case of it there is — so the tray deepens and takes an ink edge, and the tick stops
 * waiting for a pointer. Both faces are written in `admin-shared/media-marks.ts`, where the
 * server reads them too, so the two cannot hold different opinions about it.
 */
function paint(tile: HTMLElement, on: boolean): void {
  const tray = tile.querySelector<HTMLElement>('[data-tray]')
  if (tray) tray.className = on ? TRAY_ON : TRAY_IDLE
  const hold = tile.querySelector<HTMLElement>('label')
  if (hold) hold.className = on ? TICK_HOLD_ON : TICK_HOLD_OFF
  if (on) tile.dataset.on = ''
  else delete tile.dataset.on
}

export function wireGrid(root: HTMLElement): Grid {
  const listeners: (() => void)[] = []
  const changed = (): void => { for (const run of listeners) run() }

  const tiles = (): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('[data-media]')]
  const shown = (): HTMLElement[] => tiles().filter((el) => !el.hidden)

  const box = (el: HTMLElement): HTMLInputElement | null =>
    el.querySelector<HTMLInputElement>('input[data-pick]')

  const picked = (): string[] =>
    tiles().filter((el) => box(el)?.checked).map((el) => el.dataset.media ?? '')

  /**
   * The anchor a shift-click measures its run from: the last box ticked ON ITS OWN.
   *
   * It is an index into what is VISIBLE, not into the library, so narrowing or re-sorting
   * silently re-points it — which is the same thing the React face did and the only definition
   * that matches what the eye sees.
   */
  let anchor: number | null = null

  /**
   * Tick one box, or — with shift — the whole run between the last one and this one.
   *
   * A run always turns ON rather than mirroring the clicked box: shift-click is reached for to
   * take a batch, and a modifier that sometimes clears is a modifier nobody trusts. To drop
   * something from a run, click its own box. A shift-click does not move the anchor, so a run
   * can be re-measured wider or narrower from the same starting box.
   */
  function pick(url: string, shift: boolean): void {
    const list = shown()
    const i = list.findIndex((el) => el.dataset.media === url)
    if (shift && anchor !== null && i >= 0) {
      const [a, b] = anchor < i ? [anchor, i] : [i, anchor]
      for (let k = a; k <= b; k++) {
        const t = list[k]
        const input = t && box(t)
        if (input) { input.checked = true; paint(t, true) }
      }
    } else if (i >= 0) {
      const input = box(list[i]!)
      if (input) {
        input.checked = !input.checked
        paint(list[i]!, input.checked)
      }
      anchor = i
    }
    changed()
  }

  function clear(): void {
    for (const el of tiles()) {
      const input = box(el)
      if (input) input.checked = false
      paint(el, false)
    }
    anchor = null
    changed()
  }

  /** Narrows by NAME only, the way the React face did, and answers how many are left. */
  function narrow(query: string): number {
    const q = query.trim().toLowerCase()
    let left = 0
    for (const el of tiles()) {
      const hitName = !q || (el.dataset.name ?? '').includes(q)
      const hitSweep = el.dataset.onlyUnused !== '1' || el.dataset.unusedNow === '1'
      const on = hitName && hitSweep
      el.hidden = !on
      if (on) left += 1
    }
    anchor = null
    return left
  }

  /**
   * Put them in a different order by MOVING the nodes, never by drawing them again.
   *
   * `appendChild` on a node that is already in the document moves it, so the whole re-order is
   * one pass and nothing is destroyed — a picture keeps the bytes it has already decoded.
   */
  function order(by: 'new' | 'name' | 'size'): void {
    const list = tiles()
    const sorted = [...list].sort((a, b) =>
      by === 'name'
        ? (a.dataset.name ?? '').localeCompare(b.dataset.name ?? '')
        : by === 'size'
          ? Number(b.dataset.size ?? 0) - Number(a.dataset.size ?? 0)
          : Number(b.dataset.at ?? 0) - Number(a.dataset.at ?? 0))
    const host = HTML(list[0]?.parentElement ?? null)
    if (!host) return
    for (const el of sorted) host.appendChild(el)
    anchor = null
  }

  root.addEventListener('click', (e) => {
    const input = e.target
    if (!(input instanceof HTMLInputElement) || !input.dataset.pick) return
    // The box has already flipped itself by the time a click lands, and `pick` flips it again,
    // so the two agree. The modifier is read here because it is the only place it exists.
    input.checked = !input.checked
    pick(input.dataset.pick, (e as MouseEvent).shiftKey)
  })
  // Without this, shift-clicking a box also drags a text selection across the grid, so a
  // range-select leaves the page highlighted blue.
  root.addEventListener('mousedown', (e) => {
    if ((e as MouseEvent).shiftKey && (e.target as HTMLElement).closest('input[data-pick]')) e.preventDefault()
  })

  return {
    root, tiles, shown, picked, pick, clear, narrow, order,
    onChange: (run) => { listeners.push(run) },
  }
}
