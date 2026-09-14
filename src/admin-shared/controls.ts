// WHAT A CONTROL LOOKS LIKE, in the states it can be in.
//
// Beside `@/admin-shared/kit` rather than in it, and the seam is not the line count: everything
// there says what a SURFACE looks like — a sheet, a card, a table, a tool row — and everything
// here says what a CONTROL looks like, including the pairs that exist because the server draws
// one face and an island swaps to the other.
//
// A PAIR rather than a CSS rule keyed on state, wherever the two faces differ by a Tailwind
// colour with a dark variant: writing that pair by hand in `admin.css` is a second copy of a
// token, and `:has()` — the other way of asking — takes Safari down (`docs/admin-one-dom.md`).
import { CONTROL_CHROME } from '@/admin-shared/kit'

/**
 * The same chrome worn by a box that CONTAINS controls instead of being one.
 *
 * For a field made of more than one element — a colour swatch welded to its hex, a unit glued to
 * a number — where the border has to belong to the PAIR or they read as two unrelated controls
 * sitting near each other. That is what the palette editor looked like: an OS-drawn swatch and a
 * rounded pill with an 8px gap between them, twenty-eight times.
 *
 * DERIVED, not re-typed, for the reason `SHEET_TOOL_ON_CANVAS` is: a hand-copy of
 * `CONTROL_CHROME` is exactly the drift `check:admin-kit` exists to catch, and the only
 * difference that belongs between them is which element the focus ring answers to.
 */
export const CONTROL_GROUP = CONTROL_CHROME.replaceAll('focus:', 'focus-within:')

/**
 * The same chrome for a NUMBER.
 *
 * The spinners come off: a two-digit setting with a pair of 12px arrows welded to its right edge
 * is a control whose loudest feature is a way to change it by one. `tabular-nums` for the same
 * reason the hex fields have it — a column of numbers that changes width per digit wobbles.
 */
export const CONTROL_NUM = `${CONTROL_CHROME} tabular-nums [appearance:textfield]`
  + ` [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`

/**
 * The on/off switch.
 *
 * A `<button role="switch">` and not a checkbox: the switch draws no text of its own, so its
 * name is handed to it with `aria-label`. A `<label>` element cannot name a `<button>`, and
 * before that was fixed every switch in Settings announced itself as "switch, on" with no word
 * for WHAT was on — measured across twenty-six of them.
 */
const SWITCH_TRACK = 'relative h-6 w-11 shrink-0 rounded-full transition-colors'
  + ' disabled:cursor-not-allowed shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,.3)]'

export const SWITCH_ON = `${SWITCH_TRACK} bg-neutral-900 dark:bg-white`
export const SWITCH_OFF = `${SWITCH_TRACK} bg-neutral-300 dark:bg-neutral-700`

/**
 * The knob, standing proud of the groove — lit on top, shaded underneath — so the control reads
 * as a physical slide in both themes. It TRAVELS on a transform, not on `left`: motion costs a
 * composite and never a layout.
 */
const KNOB = 'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform'
  + ' dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,.35),inset_0_1px_1px_rgba(255,255,255,.45),inset_0_-1.5px_2px_rgba(0,0,0,.2)]'

export const KNOB_ON = `${KNOB} translate-x-5`
export const KNOB_OFF = KNOB
