// Settings → Appearance → THE TYPE SCALE: nine roles, three numbers each, and what each one
// actually looks like set at its own figures.
//
// ⚠️ EVERY ROW SHOWS ITSELF, since 2026-09-07. This was twenty-seven number boxes and one
// specimen block underneath showing three of the nine roles — so seven of the nine sizes on the
// screen could only be judged by reading a decimal, and `1.35` against `1.4` is not a question
// anybody can answer from the number. The size carries a SLIDER as well as its figure, and the
// row's last cell is that role set at its own size, line and spacing, in the reading face.
//
// ⚠️ THE SLIDER STORES NOTHING AND THE BOX DOES. They are one value with two controls, which is
// the arrangement `colourField` already has: the hex saves, the OS picker echoes. Two `data-k`
// over one key would count one drag as two unsaved changes and send the key twice, so the
// slider carries `data-type-slider` instead and the island keeps the pair in step — the same
// job it already does for a colour.
//
// The card is FULL WIDTH on the tab (2026-09-07): nine roles by four numbers plus a live
// specimen is a five-column table, and in a half-width column that gave the specimen — the
// whole point of the card — 150px to draw a 2.5rem heading in.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteSettings, TypeRole } from '@/types'
import { TYPE_ROLES } from '@/content/themes'
import { escapeAttr, escapeHtml } from '@/utils'
import { SHEET_TOOL } from '@/admin-shared/kit'
import { NOTE, NOTE_TEXT, READING } from '@/admin-shared/scale'
import { numberCell, slider } from '@/web/admin/fields-pick'

/** The three ranges, exactly as `content/settings-type.ts` clamps them. */
const SIZE = { min: 0.5, max: 6, step: 0.01 }
const LINE = { min: 0.8, max: 3, step: 0.05 }
const SPACING = { min: -0.2, max: 0.5, step: 0.005 }

const roleLabel = (t: AdminStrings, role: TypeRole): string => ({
  h1: t.typoH1, h2: t.typoH2, h3: t.typoH3, h4: t.typoH4, h5: t.typoH5,
  body: t.typoBody, small: t.typoSmall, caption: t.typoCaption, code: t.typoCode,
}[role])

/** One row of the table: the name, the slider, its three figures, and the specimen. */
function row(t: AdminStrings, s: SiteSettings, role: TypeRole): string {
  const st = s.typography.roles[role]
  const name = roleLabel(t, role)
  const cell = (dim: 'size' | 'line' | 'spacing', col: string,
    r: { min: number; max: number; step: number }): string =>
    `<td class="px-1 text-right align-middle">`
    // "H1 (titles) — Size", and it is not decoration: this table is 27 identical number boxes
    // in a nine-by-three grid, so a column head alone names none of them to anything that
    // cannot see the grid. A visible label per cell would be 27 more words on the screen.
    + numberCell({
      k: `typography.roles.${role}.${dim}`, value: st[dim], label: `${name} — ${col}`,
      step: String(r.step), min: r.min, max: r.max,
    }) + `</td>`
  return `<tr>`
    + `<td class="whitespace-nowrap pr-2 align-middle text-neutral-700 dark:text-neutral-300">`
    + `${escapeHtml(name)}</td>`
    // The slider is the CONTROL and the box beside it is the readout you can also type into.
    // Both write the same value; neither is the master.
    + `<td class="px-1 align-middle">`
    + slider({
      value: st.size, min: SIZE.min, max: SIZE.max, step: SIZE.step,
      attrs: `data-type-slider="${escapeAttr(role)}"`
        + ` aria-label="${escapeAttr(`${name} — ${t.colSize}`)}"`,
    })
    + `</td>`
    + cell('size', t.colSize, SIZE) + cell('line', t.colLine, LINE)
    + cell('spacing', t.colSpacing, SPACING)
    // THE SPECIMEN. The `READING` class is what does it: these samples ARE the reader's roles, so
    // they show the reading face at the size the reader will get — not the admin's normalised
    // one (`admin.css`, the note on `font-size-adjust`). A preview of a size control that
    // quietly resizes is the one preview that must not. `truncate` keeps a 6rem heading inside
    // its cell; the row's height follows the size, which is the honest answer to "how big is
    // that".
    //
    // A HEADING sample for the heading roles and a sentence for the rest: "Heading sample" set
    // at the caption size is showing the right size and saying the wrong thing about what it
    // is for.
    // ⚠️ NO `data-specimen` ON THIS CELL. It carried one until 2026-09-15 and nothing read it:
    // `admin.css` names it only in a comment, and the element the island reaches for is the
    // `data-type-specimen` below. A hook with no reader is a claim that something happens here.
    + `<td class="w-1/3 pl-3 align-middle ${READING}">`
    + `<div class="truncate text-neutral-900 dark:text-neutral-100"`
    + ` data-type-specimen="${escapeAttr(role)}"`
    + ` style="font-size:${st.size}rem;line-height:${st.line};letter-spacing:${st.spacing}em">`
    + `${escapeHtml(role.startsWith('h') ? t.typographyPreview : t.typographyPreviewBody)}`
    + `</div></td></tr>`
}

/**
 * Reset every role's size, line and spacing — and to the CHOSEN FONT's tuning, not to one
 * font's numbers for all of them.
 *
 * Every preset carries a reading setup tuned for its own face: a serif runs small and wants a
 * tighter leading than a sans, and the two book serifs zero out the sans's negative heading
 * tracking. React's reset used `DEFAULT_TYPOGRAPHY` unconditionally, which is Inter's setup, so
 * an owner reading in Literata who pressed Reset silently got the sans's numbers and the only
 * way back was to notice and re-pick the font tile.
 *
 * ⚠️ IT IS THE ISLAND'S, and the font it resets to is the one PRESSED on this screen rather
 * than the one stored — the two differ the moment somebody picks a face and has not saved.
 */
export const typeResetKey = (t: AdminStrings): string =>
  `<button type="button" data-reset-type class="${SHEET_TOOL} shrink-0">`
  + `${escapeHtml(t.resetDefault)}</button>`

/** The type card, as the tab's `panelCard` body. */
export function typeScale(t: AdminStrings, s: SiteSettings): string {
  // The note runs the full width and Reset is NOT beside it. It used to be, and at this column
  // width the note wrapped to two lines while the key floated against its first — so the one
  // control on the card sat on no line of its own. The card header owns it now, which is the
  // same rail the palette's reset sits on.
  return `<div class="space-y-5">`
    + `<p class="${READING} ${NOTE_TEXT}">${escapeHtml(t.typographyHint)}</p>`
    + `<div class="overflow-x-auto">`
    + `<table class="w-full border-separate border-spacing-y-1 text-sm">`
    + `<thead><tr class="text-xs text-neutral-500 dark:text-neutral-400">`
    + `<th class="text-left font-medium"></th>`
    + `<th class="px-1 text-left font-medium" colspan="2">${escapeHtml(t.colSize)}</th>`
    + `<th class="px-1 text-right font-medium">${escapeHtml(t.colLine)}</th>`
    + `<th class="px-1 text-right font-medium">${escapeHtml(t.colSpacing)}</th>`
    // The specimen column is deliberately unheaded: a column of examples labelled "Example"
    // spends a word saying what the reader can already see.
    + `<th class="w-1/3 font-medium"></th></tr></thead>`
    + `<tbody>${TYPE_ROLES.map((role) => row(t, s, role)).join('')}</tbody>`
    + `</table></div>`
    + `<p class="${NOTE}">${escapeHtml(t.typographyUnits)}</p>`
    + `</div>`
}
