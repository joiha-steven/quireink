// The controls the ATTRIBUTES panel needs and the settings screens do not.
//
// Everything with a single value — the slug, the excerpt, the meta fields — is already drawn by
// `fields.ts`, and is drawn by it here too. What is left is the five shapes that only a piece of
// writing has: a set of terms, a series name with suggestions, a picture, a publish date, and
// the draft/published pair.
//
// ⚠️ EVERY STATE IS IN THE MARKUP. A term already chosen and a term on offer are both drawn; a
// picture slot is drawn full AND empty; the series order is drawn and hidden. The island toggles
// `hidden` and never builds a control, which is the rule the other thirteen screens follow
// (`docs/admin-one-dom.md`) and the reason a panel can be opened, read and understood before a
// single byte of JavaScript has run.
//
// ⚠️ AND EVERY ONE OF THEM IS A `settingRow`. These five sit in a stack with the slug, the
// excerpt and the SEO pair, which `fields.ts` draws — so a caption written by hand here is a
// caption that has to match one written there, and the first cut did not: 14px/500 in
// neutral-700 against the stack's neutral-800, over a 6px gap where every other field has 8.
// Measured against the build the owner is running: four pixels of drift down the panel, and a
// grey that was a shade light on five labels out of eleven.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { PostStatus, SiteLang } from '@/types'
import { escapeAttr, escapeHtml } from '@/utils'
import { buttonClass, CHECK, CONTROL } from '@/admin-shared/kit'
import { NOTE_TEXT } from '@/admin-shared/scale'
import { EMPTY_SLOT } from '@/admin-shared/slot'
import { formatTyped, typedShape } from '@/admin-shared/date-typing'
import { settingRow } from '@/web/admin/fields'

/** DRAFT or PUBLISHED, as a pair of radios rather than a switch: neither is the "off" one. */
export function statusPair(t: AdminStrings, status: PostStatus): string {
  const one = (value: PostStatus, text: string): string =>
    `<label class="flex items-center gap-1.5"><input type="radio" name="status" value="${value}"`
    + ` data-k="status" class="${CHECK}"${status === value ? ' checked' : ''}>`
    + `${escapeHtml(text)}</label>`
  return settingRow({
    label: t.status,
    control: `<div class="flex gap-4 text-sm">`
      + one('draft', t.statusDraft) + one('published', t.statusPublished)
      + `</div>`,
  })
}

/**
 * A SET OF TERMS: the ones chosen, a box to add one, and every one not yet chosen.
 *
 * No cap on the suggestions — the editor must show them all — and the island filters them by
 * substring as the box is typed into, so a long taxonomy stays navigable without a round trip.
 */
export function chipField(f: {
  k: string
  label: string
  chosen: string[]
  options: string[]
  placeholder: string
  removeAria: string
  lowercase?: boolean
}): string {
  const low = f.lowercase ? ' lowercase' : ''
  const chip = (term: string): string =>
    `<span data-chip="${escapeAttr(term)}" class="flex items-center gap-1 rounded-full bg-neutral-900`
    + ` px-2.5 py-1 text-xs text-white dark:bg-neutral-200 dark:text-neutral-900${low}">`
    + `${escapeHtml(term)}<button type="button" data-chip-drop`
    + ` aria-label="${escapeAttr(f.removeAria)}">&times;</button></span>`
  const offer = (term: string): string =>
    `<button type="button" data-chip-add="${escapeAttr(term)}" class="rounded-full bg-neutral-100`
    + ` px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800`
    + ` dark:text-neutral-300${low}">+ ${escapeHtml(term)}</button>`
  const free = f.options.filter((o) => !f.chosen.includes(o))
  return settingRow({
    label: f.label,
    attrs: `data-chips="${escapeAttr(f.k)}"`,
    // The chips, the box and the offers are three parts of ONE control, so their own rhythm is
    // inside it and the field's own gap is the stack's.
    control: `<div class="space-y-1.5">`
      + `<div data-chip-chosen class="flex flex-wrap gap-1.5">${f.chosen.map(chip).join('')}</div>`
      + `<input data-chip-box class="${CONTROL} w-full" placeholder="${escapeAttr(f.placeholder)}">`
      + `<div data-chip-offers class="scroll-fade flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pb-4"`
      + `${free.length ? '' : ' hidden'}>${free.map(offer).join('')}</div>`
      + `</div>`,
  })
}

/**
 * Free text with a list under it — a series name that may already exist or may be new.
 *
 * It replaces `<input list>` + `<datalist>`, whose native popup cannot be styled: wrong font,
 * cramped rows, no hover. The list here inherits the admin's own chrome.
 */
export function pickField(f: {
  k: string; label: string; value: string; options: string[]; placeholder: string
}): string {
  const row = (term: string): string =>
    `<li><button type="button" data-pick-one="${escapeAttr(term)}" class="block w-full px-3.5 py-2`
    + ` text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200`
    + ` dark:hover:bg-neutral-800">${escapeHtml(term)}</button></li>`
  const id = `sheet-${f.k}`
  return settingRow({
    label: f.label,
    forId: id,
    attrs: `data-pick="${escapeAttr(f.k)}"`,
    control: `<div class="relative">`
      + `<input id="${id}" data-pick-box data-k="${escapeAttr(f.k)}" class="${CONTROL} w-full"`
      + ` value="${escapeAttr(f.value)}" placeholder="${escapeAttr(f.placeholder)}">`
      + `<ul data-pick-list hidden class="scroll-fade absolute z-20 mt-1 max-h-60 w-full overflow-auto`
      + ` rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700`
      + ` dark:bg-neutral-900">${f.options.map(row).join('')}</ul>`
      + `</div>`,
  })
}

/** A picture: the slot full, the slot empty, and the two keys. Both slots ship. */
export function pictureField(f: {
  k: string; label: string; hint: string; value: string; t: AdminStrings
}): string {
  return settingRow({
    label: f.label,
    note: f.hint,
    attrs: `data-picture="${escapeAttr(f.k)}"`,
    control: `<div class="space-y-1.5">`
      + `<img data-picture-shot src="${escapeAttr(f.value)}" alt=""`
      + ` class="aspect-video w-full rounded-lg object-cover"${f.value ? '' : ' hidden'}>`
      + `<div data-picture-empty class="${EMPTY_SLOT} aspect-video w-full rounded-lg"`
      + `${f.value ? ' hidden' : ''}>${escapeHtml(f.t.noImageSelected)}</div>`
      + `<div class="flex gap-2">`
      + `<button type="button" data-picture-pick class="${escapeAttr(buttonClass('secondary'))}">`
      + `${escapeHtml(f.t.chooseImage)}</button>`
      + `<button type="button" data-picture-drop class="${escapeAttr(buttonClass('ghost'))}"`
      + `${f.value ? '' : ' hidden'}>${escapeHtml(f.t.removeSelection)}</button>`
      + `</div></div>`,
  })
}

/**
 * THE PUBLISH DATE, TYPED.
 *
 * It was a button that opened a grid, and the grid's only way to another month was a pair of
 * arrows: nine clicks to next March, twelve to correct a year. The box takes writing, in this
 * language's own day/month order — `admin-shared/date-typing.ts` holds the reading of it, and
 * holds the reason the order is ASKED of `Intl` rather than tabulated.
 *
 * The calendar is the island's: it is a grid of forty-two cells that changes every month, and
 * the one control on this panel that would be dishonest to ship drawn. Everything else here is
 * in the markup.
 */
export function typedDate(f: {
  k: string; label: string; value: string; lang: SiteLang; t: AdminStrings; note: string
}): string {
  const id = `sheet-${f.k}`
  return settingRow({
    label: f.label,
    forId: id,
    attrs: `data-date="${escapeAttr(f.k)}"`,
    control: `<div class="${CONTROL} flex w-full items-center gap-2">`
    + `<input id="${id}" data-date-box data-k="${escapeAttr(f.k)}" inputmode="numeric" spellcheck="false"`
    + ` value="${escapeAttr(formatTyped(f.value, f.lang))}"`
    + ` placeholder="${escapeAttr(typedShape(f.lang))}"`
    + ` class="min-w-0 flex-1 bg-transparent tabular-nums outline-none">`
    + `<button type="button" data-date-open aria-haspopup="dialog" aria-expanded="false"`
    + ` aria-label="${escapeAttr(f.t.dateCalendar)}" class="shrink-0 text-neutral-500`
    + ` hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">`
    + `<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.6"`
    + ` stroke-linecap="round" aria-hidden="true">`
    + `<rect x="4" y="5.5" width="16" height="14" rx="1.5"></rect>`
      + `<path d="M4 9.5h16M8.5 3.5v3M15.5 3.5v3"></path></svg></button></div>`
      // The scheduled line: drawn, and shown by the island when the date is ahead of now and
      // the piece is published. A note that arrives late moves every field under it.
      + `<p data-date-note class="${NOTE_TEXT} mt-1.5"${f.note ? '' : ' hidden'}>`
      + `${escapeHtml(f.note)}</p>`,
  })
}

/** A sentence about the fields around it, in the stack's own small print. */
export const fieldNote = (text: string): string =>
  `<p class="${NOTE_TEXT}">${escapeHtml(text)}</p>`
