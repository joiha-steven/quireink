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
// Components, like the kit's field and button: the long lists below are what the names stand
// for, and the page carries the names (`component.ts`). A face swapped by an island is a pair
// of NAMES now, which the island reads from this file exactly as it read the lists.
import { component, utilitiesOf } from '@/admin-shared/component'
import { TAP_TOUCH } from '@/admin-shared/scale'

/**
 * THE SQUARE KEY ON A LIST ROW: rename, remove, move up, move down. Moved here from `kit.ts`
 * on 2026-10-03, when that file's strings became components and it reached its line ceiling.
 *
 * ⚠️ ONE DEFINITION, because there were five. A row's remove key was 40px and `rounded-md` in
 * the taxonomy drawer, 36px and `rounded-lg` on the settings Home tab, 36px and `rounded-md`
 * one ink lighter in the subscriber list, 40px with a border in the rail, and on the redirects
 * card it had no box at all — a bare 16px glyph, which is a 16px hit target on a phone. All
 * five are the same gesture on the same kind of row.
 *
 * 36 and `rounded-md`, because that is the admin's control step (`docs/admin-design.md`: sheet
 * 10 / panel 8 / control 6) and 36 is what every other control on a settings row measures.
 * `TAP_TOUCH` is not decoration: a 36px key is under the 44px a fingertip needs, and the
 * pseudo-element that fixes that takes no space and moves nothing. It rides beside the name
 * rather than inside it, because it is `admin.css`'s own class.
 *
 * The `disabled:` pair is for the two that can be at the end of their list — move up on the
 * first row, move down on the last. A key that cannot act has to look unavailable rather than
 * absent, or the row's controls move as you use them.
 */
export const ICON_KEY = `${TAP_TOUCH} ${component('kit-key', 'grid h-9 w-9 shrink-0 place-items-center rounded-md'
  + ' text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900'
  + ' disabled:opacity-30 disabled:hover:bg-transparent'
  + ' dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white')}`

/**
 * The same square key, in red, for the one on a row that DESTROYS something. Built by replacing
 * the neutral's inks, so a change to the key's box cannot reach one of the pair and miss the other.
 */
export const ICON_KEY_DANGER = `${TAP_TOUCH} ${component('kit-key-danger', utilitiesOf('kit-key')
  .replace('text-neutral-500', 'text-[var(--ink-danger)]')
  .replace(' hover:text-neutral-900', '')
  .replace(' dark:text-neutral-400', '')
  .replace(' dark:hover:text-white', ''))}`

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
 *
 * ⚠️ THAT RING HAS NEVER BEEN DRAWN. Found 2026-10-03, when the build began giving this list a
 * name and refused five of its utilities: `focus-within:border-neutral-500`, `focus-within:ring-2`,
 * `focus-within:ring-neutral-200` and their two dark twins have no rule in `utilities.css`, and
 * never had — `check:admin-css` reads class lists written in the source, and this one is made by
 * `replaceAll` at run time, so it could not see them. The pair has shown no focus at all since it
 * was written, which on the hex field (`outline-none`) means a keyboard user cannot see where
 * they are. They are left OUT of the name rather than carried as dead weight, and the ring is
 * not added here: drawing it is a visible change, and this change is the one that must not make
 * any. The whole fix is the five rules in `utilities.css` and the filter below going back to
 * `.replaceAll('focus:', 'focus-within:')`.
 */
export const CONTROL_GROUP = component('kit-field-group', utilitiesOf(CONTROL_CHROME).split(' ')
  .filter((u) => !u.includes('focus:')).join(' '))

/**
 * The same chrome for a NUMBER.
 *
 * The spinners come off: a two-digit setting with a pair of 12px arrows welded to its right edge
 * is a control whose loudest feature is a way to change it by one. `tabular-nums` for the same
 * reason the hex fields have it — a column of numbers that changes width per digit wobbles.
 */
export const CONTROL_NUM = `${CONTROL_CHROME} ${component('kit-num', 'tabular-nums [appearance:textfield]'
  + ' [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')}`

/**
 * The on/off switch.
 *
 * A `<button role="switch">` and not a checkbox: the switch draws no text of its own, so its
 * name is handed to it with `aria-label`. A `<label>` element cannot name a `<button>`, and
 * before that was fixed every switch in Settings announced itself as "switch, on" with no word
 * for WHAT was on — measured across twenty-six of them.
 */
// The state's two colours stay written out beside the name, so the pair below still differs
// in nothing but the colour — the island swaps whole class strings, and one name for the groove
// plus two utilities for its fill is the shortest pair that keeps that true.
const SWITCH_TRACK = component('kit-switch', 'relative h-6 w-11 shrink-0 rounded-full transition-colors'
  + ' disabled:cursor-not-allowed shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,.3)]')

export const SWITCH_ON = `${SWITCH_TRACK} bg-neutral-900 dark:bg-white`
export const SWITCH_OFF = `${SWITCH_TRACK} bg-neutral-300 dark:bg-neutral-700`

/**
 * The knob, standing proud of the groove — lit on top, shaded underneath — so the control reads
 * as a physical slide in both themes. It TRAVELS on a transform, not on `left`: motion costs a
 * composite and never a layout.
 */
const KNOB = component('kit-knob', 'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform'
  + ' dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,.35),inset_0_1px_1px_rgba(255,255,255,.45),inset_0_-1.5px_2px_rgba(0,0,0,.2)]')

export const KNOB_ON = `${KNOB} translate-x-5`
export const KNOB_OFF = KNOB

/**
 * THE COLOUR FIELD'S TWO INSIDES: the well the OS picker is laid over, and the hex beside it.
 *
 * Here rather than in `web/admin/fields-pick.ts`, which draws them, because a component is
 * registered where `components.ts` can reach it, and that file may not import from `src/web`.
 * The palette editor draws 93 of these pairs on the settings screen; spelled out, the well was
 * 176 characters and the hex 138, each time (measured 2026-10-03).
 *
 * ⚠️ `font-mono` IS NOT IN THE HEX'S LIST, and the field writes it beside the name. It is the
 * hook `settings-controls.ts` tells the hex from the picker by (`classList.contains`), and a
 * class that has become a name cannot be found that way.
 */
export const COLOUR_WELL = component('kit-well', 'relative h-[1.05rem] w-[1.05rem] shrink-0 rounded-full ring-1 ring-black/15'
  + ' shadow-[inset_0_1.5px_2px_rgba(0,0,0,.35),inset_0_-1px_1px_rgba(255,255,255,.28)] dark:ring-white/20')

export const COLOUR_HEX = `font-mono ${component('kit-hex', 'h-full min-w-0 flex-1 border-0 bg-transparent text-xs uppercase tabular-nums'
  + ' text-neutral-900 outline-none dark:text-neutral-100')}`
