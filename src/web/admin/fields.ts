// THE SETTINGS FORM'S VOCABULARY, as HTML the server sends (ADR 0054).
//
// THE RULE, and it is the only one: a setting reads top to bottom as **what it is, what to know
// about it, then the control**. Never a hint under the control it explains, never a second note
// style beside the first, never a caller's own idea of the spacing between them. The React
// screens drifted the moment that was implicit — the font pickers put their hint below the
// grid, the palette card carried a tinted callout AND a plain paragraph, and the gap between a
// label and its control was 0.5, 1 or 2 depending on the file. Deciding it once, here, is this
// module's whole argument for existing.
//
// ⚠️ EVERY CONTROL CARRIES `data-k`, ITS DOTTED KEY PATH, AND NOTHING ELSE. `typography.bodyFont`
// is one attribute; the island splits it, rebuilds the object and sends the partial, because
// `PUT /api/settings` merges. There is no settings payload in the page: what a field WAS is what
// the browser already holds for it — `defaultValue` on an input, `defaultSelected` on an option,
// `data-was` on a switch (a `<button>` has no default to read). So the unsaved count is exact
// without a baseline copy of sixty-three keys riding in an attribute.
import { escapeAttr, escapeHtml } from '@/utils'
import { CONTROL } from '@/admin-shared/kit'
import { CONTROL_NUM, KNOB_OFF, KNOB_ON, SWITCH_OFF, SWITCH_ON } from '@/admin-shared/controls'
import { FIELD_GAP, FIELD_W, NOTE, NOTE_TEXT, SECTION, SETTING_LABEL, UTIL } from '@/admin-shared/scale'

/** One field's id, from the key it stores. Settings keys are unique on a page, so this is too. */
const idOf = (k: string): string => `f-${k.replace(/[^a-zA-Z0-9_.-]/g, '-')}`

const attr = (name: string, value: string): string => value === '' ? '' : ` ${name}="${escapeAttr(value)}"`

export type SettingText = { label?: string; note?: string; noteHtml?: string; badge?: string }

/**
 * The label, the sentence under it, and nothing else — the top half of every setting.
 *
 * ⚠️ `SETTING_LABEL` GOES ON THE ELEMENT THAT HOLDS THE WORDS, which is how React had it and
 * not an aesthetic choice: a field's label is a `<label for>` wearing that class, and a setting
 * whose control cannot be pointed at by one (a picker grid, a row of keys) gets the `<div>`
 * form. The tour's index guard finds every label on the screen by that class signature and
 * skips anything with children, so a class on a WRAPPER makes 244 settings invisible to it —
 * which is precisely the "a guard that quietly stops checking" failure it exists to prevent.
 * Caught by that flow on 2026-09-15, reporting zero labels collected.
 *
 * The badge is the one thing that adds a wrapper, because two things on one line need a row to
 * sit on; React's `Setting` drew exactly the same box for exactly the same reason.
 */
function head(t: SettingText, forId = ''): string {
  if (!t.label && !t.note && !t.noteHtml) return ''
  const words = escapeHtml(t.label ?? '')
  const badge = t.badge
    ? `<code class="rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs font-normal text-neutral-500`
      + ` dark:bg-neutral-800 dark:text-neutral-400">${escapeHtml(t.badge)}</code>`
    : ''
  let name = ''
  if (t.label && badge) {
    name = `<div class="${SETTING_LABEL} flex items-center gap-2">`
      + (forId ? `<label for="${escapeAttr(forId)}">${words}</label>` : words)
      + badge + `</div>`
  } else if (t.label) {
    name = forId
      ? `<label for="${escapeAttr(forId)}" class="${SETTING_LABEL}">${words}</label>`
      : `<div class="${SETTING_LABEL}">${words}</div>`
  }
  // A DIV, not a paragraph: one of these notes is a `<details>`, and a `<details>` inside a
  // `<p>` makes the parser close the paragraph early and re-parent it — so the note loses its
  // own class list, in the browser only, where no test looks.
  const hint = t.noteHtml || t.note ? `<div class="${NOTE}">${t.noteHtml || escapeHtml(t.note ?? '')}</div>` : ''
  return `<div class="min-w-0">${name}${hint}</div>`
}

/**
 * One setting whose control is not a plain text field: a picker grid, a switch, a button, a row
 * of them. The label and the note are placed for you.
 *
 * `inline` is for a short answer: a 24px switch beside its label reads better than one stranded
 * on its own line, and it keeps a list of fifteen toggles scannable. `flex-wrap` + `basis-48`,
 * so the control drops to its own line rather than crushing the sentence beside it, WITHOUT a
 * breakpoint — what decides is the width of the control, not the window.
 */
export function settingRow(t: SettingText & {
  control: string
  inline?: boolean
  className?: string
  attrs?: string
  forId?: string
}): string {
  const cls = t.className ? ` ${t.className}` : ''
  const extra = t.attrs ? ` ${t.attrs}` : ''
  const top = head(t, t.forId)
  if (t.inline) {
    return `<div class="setting-row flex flex-wrap items-start justify-between gap-x-4 gap-y-2${cls}"${extra}>`
      + `<div class="min-w-0 flex-1 basis-48">${top}</div>`
      + `<div class="max-w-full shrink-0 pt-0.5">${t.control}</div></div>`
  }
  return `<div class="${cls.trim()}"${extra}>${top}`
    + `<div class="${top ? FIELD_GAP : ''}">${t.control}</div></div>`
}

/** A SHORT ANSWER SITS BESIDE ITS QUESTION: a number is inline and narrow unless told otherwise. */
export function textField(f: SettingText & {
  k: string
  value: string | number
  type?: 'text' | 'number' | 'url' | 'email' | 'password'
  inline?: boolean
  width?: keyof typeof FIELD_W
  placeholder?: string
  attrs?: string
}): string {
  const id = idOf(f.k)
  const type = f.type ?? 'text'
  const width = FIELD_W[f.width ?? (type === 'number' ? 'short' : 'full')]
  const chrome = type === 'number' ? `${CONTROL_NUM} min-h-9 px-3 py-1.5 text-sm` : CONTROL
  const input = `<input id="${id}" class="${chrome} ${width}" type="${type}" data-k="${escapeAttr(f.k)}"`
    + ` value="${escapeAttr(String(f.value))}"`
    + attr('placeholder', f.placeholder ?? '')
    + (f.attrs ? ` ${f.attrs}` : '') + `>`
  const inline = f.inline ?? type === 'number'
  if (inline && (f.label || f.note || f.noteHtml)) {
    return `<div class="setting-row flex flex-wrap items-start justify-between gap-x-4 gap-y-2">`
      + `<span class="min-w-0 flex-1 basis-48">${head(f, id)}</span>`
      + `<span class="shrink-0">${input}</span></div>`
  }
  return `<div class="block">${head(f, id)}`
    + (f.label || f.note || f.noteHtml ? `<div class="${FIELD_GAP}">${input}</div>` : input)
    + `</div>`
}

export function textArea(f: SettingText & {
  k: string; value: string; rows?: number; className?: string; attrs?: string
}): string {
  const id = idOf(f.k)
  const cls = f.className ? ` ${f.className}` : ''
  return `<div class="block">${head(f, id)}`
    + `<textarea id="${id}" class="${CONTROL} ${FIELD_W.full} resize-y`
    + `${f.label || f.note || f.noteHtml ? ` ${FIELD_GAP}` : ''}${cls}"`
    + ` rows="${f.rows ?? 4}" data-k="${escapeAttr(f.k)}"`
    + `${f.attrs ? ` ${f.attrs}` : ''}>${escapeHtml(f.value)}</textarea></div>`
}

/**
 * The bare on/off switch.
 *
 * `label` is required and it is not decoration: the switch draws no text, so its name has to be
 * handed to it. The row's own label is a SIBLING, and a sibling names nothing.
 *
 * `disabled` is not decoration either: a switch whose feature has no engine behind it — the AI
 * jobs with no model connected — has to look unavailable rather than off, or the owner flips it,
 * sees it flip back, and concludes the admin is broken.
 */
export function switchControl(f: { k: string; on: boolean; label: string; disabled?: boolean }): string {
  return `<button type="button" role="switch" id="${idOf(f.k)}" data-k="${escapeAttr(f.k)}"`
    + ` data-switch data-was="${f.on ? '1' : '0'}" aria-checked="${f.on}"`
    + ` aria-label="${escapeAttr(f.label)}"${f.disabled ? ' disabled' : ''}`
    + ` class="${f.on ? SWITCH_ON : SWITCH_OFF}">`
    + `<span class="${f.on ? KNOB_ON : KNOB_OFF}"></span></button>`
}

/**
 * One row inside a bordered list: label, note, switch.
 *
 * A disabled row dims as ONE thing — label, note and switch together. Dimming only the control
 * leaves a black label over a grey switch, which reads as a rendering fault.
 */
export function switchRow(f: SettingText & {
  k: string
  on: boolean
  label: string
  disabled?: boolean
  className?: string
  attrs?: string
}): string {
  return settingRow({
    ...f,
    inline: true,
    control: switchControl(f),
    // ⚠️ `switch-row` AND `p-4`, and both have work to do in `admin.css` (771-796). The first
    // is how a boolean keeps its far-end alignment with the explanations switched off — with
    // no sentence between the label and the switch, an inline row collapses and the switches
    // stop lining up down the card. The second is where a row inside a `panel-list` gets its
    // padding: `.switch-row.p-4` zeroes the sides and `.panel-list .switch-row.p-4` puts 16px
    // back. React's `ToggleRow` always carried both, and the first version of this primitive
    // carried neither — which would have shipped a card of switches that went ragged the
    // moment somebody hid the explanations.
    className: `switch-row p-4 ${f.className ?? ''}${f.disabled ? ' opacity-50' : ''}`.trim(),
    attrs: f.attrs,
  })
}

/**
 * A LIST OF BOOLEANS, which is what most settings cards are made of.
 *
 * Rows with a rule between them and no edge of their own — the third rank. Every tab was
 * composing `panelList` and the two switch classes by hand, which is four chances to get one
 * of them wrong per card.
 */
export const switchList = (rows: string[] | string, attrs = ''): string =>
  `<div class="panel-list -mx-4 divide-y divide-neutral-100 dark:divide-neutral-800"`
  + `${attrs ? ` ${attrs}` : ''}>${Array.isArray(rows) ? rows.join('') : rows}</div>`

/**
 * A SETTING WITH NO CONTROL, carried in a hidden field.
 *
 * ⚠️ IT MUST CARRY `data-was`. A hidden input keeps its `value` IDL attribute in "default mode",
 * so setting `.value` writes the content attribute too and `defaultValue` moves with it — the
 * field can never look changed, and the form's diff would send nothing. Every other control on
 * this screen answers that question out of the DOM itself; this one cannot.
 */
export const hiddenField = (k: string, value: string, extra = ''): string =>
  `<input type="hidden" data-k="${escapeAttr(k)}" value="${escapeAttr(value)}"`
  + ` data-was="${escapeAttr(value)}"${extra ? ` ${extra}` : ''}>`

/** A text control ALONE, for a row that shares its line with something else. */
export function textControl(f: {
  k?: string
  value: string | number
  type?: 'text' | 'number' | 'url' | 'email' | 'password'
  width?: keyof typeof FIELD_W
  placeholder?: string
  label?: string
  attrs?: string
}): string {
  const type = f.type ?? 'text'
  const chrome = type === 'number' ? `${CONTROL_NUM} min-h-9 px-3 py-1.5 text-sm` : CONTROL
  return `<input class="${chrome} ${FIELD_W[f.width ?? 'full']}" type="${type}"`
    + (f.k ? ` data-k="${escapeAttr(f.k)}"` : '')
    + ` value="${escapeAttr(String(f.value))}"`
    + (f.label ? ` aria-label="${escapeAttr(f.label)}"` : '')
    + (f.placeholder ? ` placeholder="${escapeAttr(f.placeholder)}"` : '')
    + (f.attrs ? ` ${f.attrs}` : '') + `>`
}

/**
 * A PANEL: a card living INSIDE the one-sheet page — one radius step under the sheet's, hairline
 * edges, its title on a ruled header row. A card floating on the canvas keeps the sheet
 * register; a box in a box does not.
 *
 * `lampHtml` takes the position beside the name, and ONE mark may. A second one there — a group
 * marker beside a state marker — shipped once and read as two unrelated things.
 */
export function panelCard(c: {
  title?: string
  titleHtml?: string
  actions?: string
  lampHtml?: string
  body: string
  className?: string
  bodyClass?: string
  attrs?: string
}): string {
  const name = c.titleHtml || (c.title ? escapeHtml(c.title) : '')
  // `flex`, and it is the whole fix: a lamp is an inline-block, so inside an ordinary span it
  // sits on the text baseline of the title's line box, about 15px below where an 8px mark
  // belongs, and the row reads visibly out of true. A flex wrapper has no baseline to sit on,
  // so the 7px offset below is the only thing positioning it.
  //
  // ⚠️ `flex` ON THE LAMP'S OWN WRAPPER TOO, and it is not decoration. Without it that wrapper
  // is a block with an inline-block inside, so it gets a LINE BOX — 24px of it at this type
  // size, for an 8px mark — and 7px + 24px makes the title 31px where it should be 24. Every
  // card with a lamp then wears a header 7px taller than every card without one. Measured
  // 2026-09-15 against the React build, which had `flex shrink-0` here and lost it in the port.
  const titled = name
    ? (c.lampHtml
      ? `<h2 class="${SECTION}"><span class="flex items-start gap-2.5">`
        + `<span class="mt-[7px] flex shrink-0">${c.lampHtml}</span><span>${name}</span></span></h2>`
      : `<h2 class="${SECTION}">${name}</h2>`)
    : ''
  const header = titled || c.actions
    ? `<div class="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2.5`
      + ` dark:border-neutral-800">${titled}${c.actions ?? ''}</div>`
    : ''
  return `<section class="rounded-lg border border-neutral-100 dark:border-neutral-800`
    + `${c.className ? ` ${c.className}` : ''}"${c.attrs ? ` ${c.attrs}` : ''}>`
    + header + `<div class="card-body p-4${c.bodyClass ? ` ${c.bodyClass}` : ''}">${c.body}</div></section>`
}

/**
 * A named group of settings INSIDE one card — the MIDDLE of the three ranks.
 *
 * A group draws ONE hairline above its title and no box: a box inside a card at the card's own
 * radius is the arrangement that made the innermost frame shout loudest. An EYEBROW, not a
 * heading: 12px uppercase against a 16px/600 card title is four points and two weights, which
 * is the whole job, and the decoration the card used to need comes off.
 *
 * `first` drops the rule, because a rule directly under the card's own header row is two lines
 * with nothing between them.
 */
export function group(g: { title: string; note?: string; first?: boolean; body: string }): string {
  return `<section class="${g.first ? '' : 'mt-6 border-t border-neutral-100 pt-5 dark:border-neutral-800'}">`
    + `<h3 class="${UTIL} mb-1.5">${escapeHtml(g.title)}</h3>`
    + (g.note ? `<p class="${NOTE_TEXT} mb-3">${escapeHtml(g.note)}</p>` : '')
    + g.body + `</section>`
}
