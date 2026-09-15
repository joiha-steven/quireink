// THE CONTROLS THAT OFFER A CHOICE: a segmented strip, the two kinds of select, a colour, a
// slider, a tick. Drawn by the server; the three that are not native form controls are moved by
// the island, which is why each of those exports its two faces rather than one.
//
// Everything here takes its classes from `@/admin-shared` and draws nothing of its own, which is
// what keeps `check:admin-kit` meaningful and what makes the server version a reduction rather
// than an eleventh variant of a control the admin already has.
import { escapeAttr, escapeHtml } from '@/utils'
import { CONTROL, TICK_BOX, TICK_MARK, TICK_PATH, TICK_WRAP } from '@/admin-shared/kit'
import { CONTROL_GROUP, CONTROL_NUM } from '@/admin-shared/controls'
import { SEGMENT_TRACK, edgeAt, tabItemClass } from '@/admin-shared/tabs'
import { FIELD_W, NOTE, SETTING_LABEL } from '@/admin-shared/scale'
import { settingRow, type SettingText } from '@/web/admin/fields'
import { icon } from '@/web/admin/kit'

/** The strip's two faces, so the island moves `aria-pressed` and swaps a string it was given. */
/** A choice key, at its position in the strip: only the two ends take a curve. */
const choiceKey = (on: boolean, i: number, n: number): string =>
  tabItemClass(on, 'sm', false, 'choice', edgeAt(i, n))

/**
 * A SEGMENTED CHOICE: three or four answers read at a glance.
 *
 * `flex-wrap` on the track, because five short options in eleven languages do not all fit one
 * line and a track that cannot wrap scrolls sideways inside a card instead.
 *
 * Buttons and not radios, which is what the React face was. A radio group would be the more
 * obvious HTML and it is not what this control looks like: the pressed one is CARVED into the
 * track, and `aria-pressed` is what says so.
 */
export function choice(f: SettingText & {
  k: string
  value: string
  options: [string, string][]
  /**
   * ⚠️ THE STORED VALUE IS A BOOLEAN, not the string the track holds.
   *
   * `figure.ink` is a two-option strip over a boolean, and `sanitizeFigure`'s `bool()` discards
   * anything that is not one — so a plain `choice` on it saved NOTHING AT ALL. It typechecked,
   * it rendered, and the setting never moved. Options are `'1'`/`'0'`; the form's diff reads
   * this attribute and sends `true`/`false`.
   */
  bool?: boolean
  attrs?: string
}): string {
  const items = f.options.map(([v, label], i) =>
    `<button type="button" data-choice="${escapeAttr(v)}" aria-pressed="${v === f.value}"`
    + ` class="${choiceKey(v === f.value, i, f.options.length)}">${escapeHtml(label)}</button>`).join('')
  return settingRow({
    ...f,
    // `data-was` because a `<div>` of buttons has no `defaultValue` for the form's diff to
    // read. Every other control on this screen answers that question out of the DOM itself.
    control: `<div class="${SEGMENT_TRACK} flex-wrap" data-k="${escapeAttr(f.k)}" data-choice-track`
      + ` data-was="${escapeAttr(f.value)}"${f.bool ? ' data-k-bool' : ''}`
      + `${f.attrs ? ` ${f.attrs}` : ''}>${items}</div>`,
  })
}

/**
 * A NATIVE select wearing the admin's own chrome.
 *
 * `appearance-none` plus a drawn chevron, and the chevron is `pointer-events-none` so the click
 * still reaches the field under it.
 */
export type PickSpec = {
  /** Absent for a picker that CHOOSES rather than stores — the "add a link" row's target. */
  k?: string
  value: string
  options: [string, string][]
  width?: keyof typeof FIELD_W
  /** The record holds a number here, and a select's value is always a string. */
  numeric?: boolean
  label?: string
  attrs?: string
}

/** The control ALONE, for a row that has something else to say about its own label. */
export function pickControl(f: PickSpec): string {
  const opts = f.options.map(([v, label]) =>
    `<option value="${escapeAttr(v)}"${v === f.value ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')
  return `<span class="relative inline-flex ${FIELD_W[f.width ?? 'full']}">`
    + `<select class="${CONTROL} w-full cursor-pointer appearance-none pr-9"`
    + (f.k ? ` data-k="${escapeAttr(f.k)}"` : '')
    + (f.numeric ? ' data-k-number' : '')
    + (f.label ? ` aria-label="${escapeAttr(f.label)}"` : '')
    + `${f.attrs ? ` ${f.attrs}` : ''}>${opts}</select>`
    // ⚠️ `icon()`, NOT A HAND-WRITTEN `<svg data-glyph>`. That attribute is how a Mark tree
    // carries a drawing for `mark-html.ts` and `mark-dom.ts` to fill in — nothing fills it in
    // raw markup, so the chevron shipped as an EMPTY svg and every select in the admin lost its
    // affordance: a dropdown that looks exactly like a text box, with `appearance-none` having
    // already taken the platform's own caret away. Measured 2026-09-15 against the React build.
    + `<span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500`
    + ` dark:text-neutral-400">${icon('down', 'h-4 w-4')}</span></span>`
}

export const pick = (f: SettingText & PickSpec & { inline?: boolean }): string =>
  settingRow({ ...f, control: pickControl(f), inline: f.inline })

/**
 * A select with the PLATFORM's own chevron still on it.
 *
 * ⚠️ This is drift, reproduced deliberately. Seven selects on this screen were written by hand
 * as `CONTROL w-full` without `appearance-none`, so they wear the OS control where every other
 * dropdown in the admin wears the drawn one. Converting the screen is not the moment to change
 * how seven controls look — that is a decision about the design, and it belongs in a commit that
 * says so. The name is what makes the drift countable.
 */
export function plainPick(f: SettingText & {
  k?: string
  value: string
  options: [string, string][]
  numeric?: boolean
  attrs?: string
}): string {
  const opts = f.options.map(([v, label]) =>
    `<option value="${escapeAttr(v)}"${v === f.value ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')
  // ⚠️ `attrs` BELONGS TO THE SELECT AND NOT TO THE ROW AROUND IT. Spreading `...f` handed both
  // the same attribute, so `querySelector('[data-strip-columns]')` found the wrapping `<div>`
  // first and read `undefined` off it — a hook that resolves to the wrong element is worse than
  // one that resolves to nothing, because it resolves.
  const { attrs, ...row } = f
  return settingRow({
    ...row,
    control: `<select class="${CONTROL} ${FIELD_W.full}"`
      + (f.k ? ` data-k="${escapeAttr(f.k)}"` : '')
      + (f.numeric ? ' data-k-number' : '')
      + `${attrs ? ` ${attrs}` : ''}>${opts}</select>`,
  })
}

const WELL = 'relative h-[1.05rem] w-[1.05rem] shrink-0 rounded-full ring-1 ring-black/15'
  + ' shadow-[inset_0_1.5px_2px_rgba(0,0,0,.35),inset_0_-1px_1px_rgba(255,255,255,.28)] dark:ring-white/20'

const HEX = 'h-full min-w-0 flex-1 border-0 bg-transparent font-mono text-xs uppercase tabular-nums'
  + ' text-neutral-900 outline-none dark:text-neutral-100'

/**
 * A COLOUR: the OS picker welded to the hex that names it.
 *
 * The border belongs to the PAIR — `CONTROL_GROUP` is `CONTROL_CHROME` with its focus rules moved
 * to `focus-within` — because a swatch and a pill with an 8px gap between them read as two
 * unrelated controls sitting near each other, which is what the palette editor looked like
 * twenty-eight times over. The native `input[type=color]` is transparent and laid over the well:
 * the OS paints its own chrome and there is no styling it, so the well is drawn underneath and
 * the control is the click target.
 *
 * ⚠️ TWO INPUTS, ONE VALUE, and only the hex carries `data-k`. The picker is `data-k-echo`: the
 * island keeps them in step, and if it never runs the hex is still the field that saves. A
 * colour that could be stored from either would be two answers to one question.
 */
export function colourField(f: { k: string; value: string; label?: string }): string {
  const hex = f.value.startsWith('#') ? f.value : `#${f.value}`
  return `<span class="flex h-8 shrink-0 items-center gap-1.5 px-2 ${CONTROL_GROUP} w-[8.25rem]">`
    + `<span class="${WELL}" style="background:${escapeAttr(hex)}">`
    + `<input type="color" data-k-echo="${escapeAttr(f.k)}" value="${escapeAttr(hex)}"`
    + (f.label ? ` aria-label="${escapeAttr(f.label)}"` : ' aria-hidden="true" tabindex="-1"')
    + ` class="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0"></span>`
    + `<span aria-hidden="true" class="font-mono text-xs text-neutral-400 dark:text-neutral-500">#</span>`
    + `<input type="text" data-k="${escapeAttr(f.k)}" value="${escapeAttr(hex.slice(1))}"`
    + (f.label ? ` aria-label="${escapeAttr(f.label)}"` : '')
    + ` class="${HEX}"></span>`
}

/** One colour on its own line, named at the left and picked at the right. */
export const colourRow = (f: { k: string; value: string; label: string }): string =>
  `<label class="flex max-w-sm items-center justify-between gap-3">`
  + `<span class="text-sm text-neutral-700 dark:text-neutral-300">${escapeHtml(f.label)}</span>`
  + colourField(f) + `</label>`

export const colourGrid = (rows: string): string =>
  `<div class="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">${rows}</div>`

const FADER = 'fader h-6 w-48 cursor-pointer focus-visible:outline-none focus-visible:ring-2'
  + ' focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-700'
  + ' disabled:cursor-not-allowed disabled:opacity-40'

/**
 * A SLIDER with its number beside it.
 *
 * The whole appearance is `.fader` in `admin.css`: a range input is the one control a browser
 * will not let you style from utilities, so it is drawn once, there, for both themes.
 *
 * The readout is live — the island writes it — so it ships with the value the server knows and
 * the unit the caller gave.
 *
 * ⚠️ `k` IS OPTIONAL, for the same reason `pickControl`'s is: a slider that MOVES a value its
 * neighbour stores must not also store it. The type scale pairs each slider with a number box
 * over one setting — the box is the field that saves, exactly as the hex is in `colourField` —
 * and two controls under one `data-k` would count one drag as two unsaved changes and send the
 * key twice.
 */
export function slider(f: SettingText & {
  k?: string
  value: number
  min: number
  max: number
  step?: number
  /**
   * Whether the number beside the fader is shown at all.
   *
   * ⚠️ IT IS NOT A STRING ANY MORE. It was, and the server drew "60%" while the island — which
   * rewrites this box on every drag from `value` plus `data-unit` — drew "60", so the percent
   * sign vanished on load and never came back (measured 2026-09-15 against the React build).
   * Two places printing the same number two ways is the fault; taking the string away is the
   * fix, because now both read the fader's own value and the unit written beside it.
   */
  readout?: boolean
  /** What follows the number — `%`, `px`. Written once here, read by both faces. */
  unit?: string
  attrs?: string
}): string {
  const head = f.label || f.note || f.noteHtml
  return `<label class="block">`
    + (f.label ? `<span class="${SETTING_LABEL}">${escapeHtml(f.label)}</span>` : '')
    + (f.noteHtml || f.note ? `<span class="${NOTE} block">${f.noteHtml || escapeHtml(f.note ?? '')}</span>` : '')
    + `<span class="flex items-center gap-3${head ? ' mt-2' : ''}">`
    + `<input type="range"${f.k ? ` data-k="${escapeAttr(f.k)}"` : ''} class="${FADER}"`
    + ` min="${f.min}" max="${f.max}"${f.step === undefined ? '' : ` step="${f.step}"`}`
    + ` value="${escapeAttr(String(f.value))}"${f.attrs ? ` ${f.attrs}` : ''}>`
    + (f.readout
      ? `<span class="w-10 shrink-0 text-sm tabular-nums text-neutral-500 dark:text-neutral-400"`
        + ` data-readout${f.unit ? ` data-unit="${escapeAttr(f.unit)}"` : ''}>`
        + `${escapeHtml(`${f.value}${f.unit ?? ''}`)}</span>`
      : '')
    + `</span></label>`
}

/**
 * The admin's checkbox, DRAWN.
 *
 * Still a real `input[type=checkbox]`: `appearance-none` removes the widget and leaves the
 * element, so it stays focusable, keyboard-operable, announced as a checkbox and nameable by a
 * wrapping `<label>`. The tick is an overlaid SVG with `pointer-events-none`, which is why the
 * input alone is the hit target — and `peer-checked:` drives it, so this one needs no island.
 */
export function tickBox(f: { k?: string; label: string; on: boolean; attrs?: string }): string {
  return `<span class="${TICK_WRAP}">`
    + `<input type="checkbox" class="${TICK_BOX}"`
    + (f.k ? ` data-k="${escapeAttr(f.k)}"` : '')
    + ` aria-label="${escapeAttr(f.label)}"${f.on ? ' checked' : ''}${f.attrs ? ` ${f.attrs}` : ''}>`
    + `<svg viewBox="0 0 16 16" aria-hidden="true" class="${TICK_MARK}">`
    + `<path d="M4 8.4 6.6 11 12 5" fill="none" stroke-width="2" stroke-linecap="round"`
    + ` stroke-linejoin="round" class="${TICK_PATH}"></path></svg></span>`
}

/** A tick with its name beside it, on one small line. */
export const checkField = (f: { k?: string; label: string; on: boolean; attrs?: string }): string =>
  `<label class="flex items-center gap-2 text-xs">${tickBox(f)}`
  + `<span class="text-neutral-700 dark:text-neutral-300">${escapeHtml(f.label)}</span></label>`

/**
 * A number in a table cell: no spinners, right-aligned, and as wide as four digits.
 *
 * `min` and `max` are not decoration. The type scale's sanitiser clamps every figure on the way
 * in (`content/settings-type.ts`: size [0.5,6], line [0.8,3], spacing [-0.2,0.5]), so a cell
 * without them accepts `60`, says nothing, and saves `6` — the field and the record disagree
 * and only one of them is on screen. The browser refusing it is the only feedback there is.
 */
export const numberCell = (f: {
  k: string; value: number; label: string; step?: string; min?: number; max?: number
}): string =>
  `<input type="number" data-k="${escapeAttr(f.k)}" value="${escapeAttr(String(f.value))}"`
  + ` aria-label="${escapeAttr(f.label)}"${f.step ? ` step="${escapeAttr(f.step)}"` : ''}`
  + `${f.min === undefined ? '' : ` min="${f.min}"`}${f.max === undefined ? '' : ` max="${f.max}"`}`
  + ` class="${CONTROL_NUM} h-8 w-[4.25rem] px-2 text-right text-xs">`
