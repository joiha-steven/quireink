// WHERE THE "/" MENU OPENS: whole, clear of the caret's line, and opaque to the last pixel.
//
// It had a fixed 360px box and the admin's `scroll-fade`. The fade is a MASK, so the last 24px
// of a FLOATING menu turned see-through and the sheet's hint line underneath was printed across
// "Tasks"; and 360px was shorter than the thirteen rows (433px measured at 1440), so the fade was
// always on. Now the menu takes the room the window has — the VISIBLE part, above a phone's
// keyboard: under the caret's line when it fits there, over it when it fits there instead, and
// on a window too short for either the roomier side, scrolling. Only on a window too short even
// for that does it cover the line.
import type { SlashAt } from './editor-menus'

/** Distance from the window's edges. */
const EDGE = 8
/** The gap kept from the caret's line, above or below. */
const CLEAR = 4
/** Below this the menu would show three rows; it covers the line instead and keeps more. */
const MIN = 140
/** The menu's width (`w-64`), for keeping it inside the window sideways. */
const WIDTH = 256

/**
 * The part of the window a reader can SEE, in the coordinates a fixed box is placed in. On a
 * phone the soft keyboard shrinks the VISUAL viewport and leaves `innerHeight` alone, so a menu
 * measured against `innerHeight` opened under the keyboard; `offsetTop` is how far the visual
 * viewport has been scrolled down inside the layout one while the keyboard is up.
 */
function seen(): { top: number; bottom: number } {
  const vv = window.visualViewport
  return vv ? { top: vv.offsetTop, bottom: vv.offsetTop + vv.height } : { top: 0, bottom: window.innerHeight }
}

export function placeSlashMenu(box: HTMLElement, at: SlashAt): void {
  const view = seen()
  box.style.left = `${Math.max(EDGE, Math.min(at.left, window.innerWidth - WIDTH - EDGE))}px`
  box.style.maxHeight = `${view.bottom - view.top - 2 * EDGE}px`
  const h = box.offsetHeight
  // The caret's FOOT: the reading face's line is 27px at 1440, and `top + 24` sat on it.
  const below = (at.bottom ?? at.top + 24) + CLEAR
  const roomBelow = view.bottom - EDGE - below
  const roomAbove = at.top - CLEAR - EDGE - view.top
  let top: number
  if (h <= roomBelow) top = below
  else if (h <= roomAbove) top = at.top - CLEAR - h
  else if (Math.max(roomBelow, roomAbove) >= MIN) {
    const down = roomBelow >= roomAbove
    box.style.maxHeight = `${down ? roomBelow : roomAbove}px`
    top = down ? below : view.top + EDGE
  } else top = Math.max(view.top + EDGE, view.bottom - EDGE - h)
  box.style.top = `${top}px`
}
