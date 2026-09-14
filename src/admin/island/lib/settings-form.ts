// WHAT THE SETTINGS FORM KNOWS ABOUT ITS OWN UNSAVED STATE: how much of it there is, how to
// store it, and what to ask when somebody tries to walk away from it.
//
// ⚠️ THERE IS NO COPY OF THE SETTINGS IN THE PAGE, and that is the whole design. What a field
// WAS is what the browser already holds for it: `defaultValue` on an input or a textarea (the
// `value=` the server wrote), `defaultSelected` on an option, `data-was` on a switch — a
// `<button role="switch">` has no default to read. So the unsaved count is exact, and
// sixty-three settings keys do not ride into the browser twice.
//
// A COUNT rather than a boolean, because the count is what makes the Save key worth pressing:
// a button reading "Save settings" says only that saving exists, and one reading "Save 3
// changes" says there is work on this screen and how much.

/**
 * Every control that stores an ordinary settings key.
 *
 * `HTMLElement` and not a union of the form elements, because two of them are not form elements
 * at all: a switch is a `<button role="switch">` and a segmented choice is a `<div>` of buttons.
 * Both carry `data-was`, which is what a control with no `defaultValue` has instead.
 */
export type Field = HTMLElement

export const fieldsIn = (root: ParentNode): Field[] =>
  [...root.querySelectorAll<Field>('[data-k]')]

const isSwitch = (el: Field): el is HTMLButtonElement => el.hasAttribute('data-switch')
const isChoice = (el: Field): boolean => el.hasAttribute('data-choice-track')

/** What the server last gave us for this control. */
function was(el: Field): string {
  // ⚠️ `data-was` FIRST, AND `input[type=hidden]` NEEDS IT. A hidden input keeps its `value` IDL
  // attribute in "default mode": setting `.value` writes the content attribute, so `value` and
  // `defaultValue` are the same string forever and the field can NEVER look changed. Five
  // settings ride hidden fields — both logos, the portrait, `enabledPalettes`, `customFont` —
  // and every one of them would have been chosen in the picker, drawn on screen, and then not
  // sent. Caught by `settings-form.test.ts` on 2026-09-14, before it shipped.
  if (el.dataset.was !== undefined) return el.dataset.was
  if (isSwitch(el) || isChoice(el)) return '0'
  if (el instanceof HTMLSelectElement) {
    // The ATTRIBUTE, not `defaultSelected`: what the server wrote is `selected` in the markup,
    // and reading the attribute says so without depending on how a DOM chose to reflect it.
    const picked = [...el.options].find((o) => o.hasAttribute('selected'))
    return picked ? picked.value : (el.options[0]?.value ?? '')
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.defaultValue
  return ''
}

/** What it holds now. */
function now(el: Field): string {
  if (isSwitch(el)) return el.getAttribute('aria-checked') === 'true' ? '1' : '0'
  if (isChoice(el)) return el.querySelector<HTMLElement>('[aria-pressed="true"]')?.dataset.choice ?? ''
  return (el as HTMLInputElement).value
}

export const isDirty = (el: Field): boolean => was(el) !== now(el)

/** The value as the settings record wants it, not as the DOM spells it. */
function typed(el: Field): unknown {
  if (isSwitch(el)) return now(el) === '1'
  // A segmented choice over a BOOLEAN. `figure.ink` is two buttons over a `true`/`false`, and
  // `sanitizeFigure`'s `bool()` discards a string — so without this the setting never moved.
  if (isChoice(el)) return el.hasAttribute('data-k-bool') ? now(el) === '1' : now(el)
  if (el instanceof HTMLInputElement && el.type === 'range') return Number(el.value)
  if (el instanceof HTMLInputElement && el.type === 'number') {
    // ⚠️ EMPTY IS NOT ZERO, and `Number('')` is. A cleared number field sends NOTHING, which
    // leaves the stored value alone; sending 0 would set "posts per page" to none, "excerpt
    // length" to nothing and "upload limit" to zero bytes, each of which is a working setting
    // turned off by a field somebody was in the middle of retyping.
    if (el.value.trim() === '') return undefined
    const n = Number(el.value)
    return Number.isFinite(n) ? n : undefined
  }
  if (el instanceof HTMLInputElement && el.type === 'checkbox') return el.checked
  // ⚠️ A LIST IN A HIDDEN FIELD. `enabledPalettes` is an array and no control holds one, so it
  // rides as space-separated names. This one fails in the WORST direction without the split:
  // `sanitizeEnabledPalettes` reads a non-array as "turn all six on", so sending the string
  // would switch on every palette the owner had deliberately switched off.
  if (el.hasAttribute('data-k-list')) {
    return (el as HTMLInputElement).value.split(' ').filter(Boolean)
  }
  // ⚠️ A WHOLE OBJECT IN A HIDDEN FIELD. `customFont` is a family plus a variable-length list of
  // faces, and removing the 600 weight is not something a dotted path can say. Sent as JSON and
  // parsed here; anything that will not parse sends NOTHING, because `sanitizeFont` reads a
  // string as no font at all and would drop every uploaded face.
  if (el.hasAttribute('data-k-json')) {
    try { return JSON.parse((el as HTMLInputElement).value) as unknown } catch { return undefined }
  }
  // A select whose stored value is a NUMBER. `home.front.columns` is 1, 2 or 3 and
  // `popular.days` is 7, 30 or 0 — both are numbers in the record, and a select's value is
  // always a string, so without this they save `"7"` and the sanitiser drops them.
  if (el.hasAttribute('data-k-number')) {
    const n = Number((el as HTMLInputElement).value)
    return Number.isFinite(n) ? n : undefined
  }
  return (el as HTMLInputElement).value
}

/**
 * The changed fields as one partial, nested from their dotted paths.
 *
 * ⚠️ IT IS A DEEP PARTIAL, and the type says so rather than pretending to be
 * `Partial<SiteSettings>` — which would typecheck `{ inks: { yellow } }` only by lying about
 * the other eight ink keys being present.
 *
 * Sending one leaf is safe because `saveSettings` DEEP-MERGES: every nested group goes through
 * its own sanitiser with the CURRENT value as the fallback, so a partial that mentions one leaf
 * leaves the other 244 exactly where they were. That is not an assumption made here —
 * `content/settings.test.ts` has pinned "a partial save leaves everything it did not mention
 * alone" since 2026-08-02, when a patch carrying only a title reset `home.mode` and turned off
 * somebody's composed front page.
 */
export function partialOf(fields: Field[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const el of fields) {
    const path = el.dataset.k
    if (!path || !isDirty(el)) continue
    const value = typed(el)
    if (value === undefined) continue
    place(out, path.split('.'), value)
  }
  return out
}

/** A path segment that is all digits is an ARRAY INDEX, and the box it opens is an array. */
const isIndex = (step: string): boolean => /^\d+$/.test(step)

/**
 * Put one value at the end of a dotted path, opening the right kind of box on the way.
 *
 * ⚠️ `menu.0.label` IS AN ARRAY, and this is the whole reason the walk is a function rather
 * than four lines inline. Building a plain object at every step sends `{menu:{0:{label}}}` —
 * which typechecks, renders and writes the wrong shape, because `sanitizeMenu` walks an array
 * and an object with a `"0"` key is not one. Three settings are arrays (`menu`, `featured`,
 * `home.front.strips`), and all three would have saved as nothing at all.
 */
type Box = Record<string, unknown> | unknown[]

const read = (box: Box, step: string): unknown =>
  Array.isArray(box) ? box[Number(step)] : box[step]

const write = (box: Box, step: string, value: unknown): void => {
  if (Array.isArray(box)) box[Number(step)] = value
  else box[step] = value
}

function place(root: Record<string, unknown>, parts: string[], value: unknown): void {
  let box: Box = root
  for (let i = 0; i < parts.length - 1; i++) {
    const step = parts[i]!
    const wantArray = isIndex(parts[i + 1]!)
    const held = read(box, step)
    const reusable = typeof held === 'object' && held !== null && Array.isArray(held) === wantArray
    const open: Box = reusable ? (held as Box) : (wantArray ? [] : {})
    write(box, step, open)
    box = open
  }
  write(box, parts[parts.length - 1]!, value)
}

/**
 * The form agrees with the server again.
 *
 * Called after a save lands, and it moves the BASELINE rather than the value: the count goes to
 * zero because what the server holds has caught up, not because anything on screen changed.
 */
export function settle(fields: Field[]): void {
  for (const el of fields) {
    if (!el.dataset.k) continue
    // Anything that answers with `data-was` is settled by moving it — the two controls that are
    // not form elements, and every hidden input.
    if (el.dataset.was !== undefined) { el.dataset.was = now(el); continue }
    if (el instanceof HTMLSelectElement) {
      for (const o of el.options) o.toggleAttribute('selected', o.value === el.value)
      continue
    }
    if (el instanceof HTMLTextAreaElement) { el.defaultValue = el.value; continue }
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox' || el.type === 'radio') el.defaultChecked = el.checked
      else el.defaultValue = el.value
    }
  }
}

/**
 * How many KEYS differ from what the server last handed us — not how many controls.
 *
 * One setting can be drawn on two tabs (the comments master switch is), and the island keeps the
 * copies in step. Counting controls would say "2 changes" for one answer, on a key whose whole
 * job is to say how much work is waiting.
 */
export const changedCount = (fields: Field[]): number =>
  new Set(fields.filter((el) => Boolean(el.dataset.k) && isDirty(el)).map((el) => el.dataset.k)).size

/** Whether any of the named roots has unsaved work, for a card that lights its own lamp. */
export const changedIn = (fields: Field[], ...roots: string[]): boolean =>
  fields.some((el) => {
    const k = el.dataset.k
    return Boolean(k) && isDirty(el) && roots.some((r) => k === r || k!.startsWith(`${r}.`))
  })
