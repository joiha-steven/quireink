// The composed front page's options, drawn. ADR 0014, part 2.
//
// Split out of `settings-home.ts` on 2026-09-15 at that file's 400-line ceiling. It is the right
// piece to move: everything else on the Home tab chooses ONE value, and this validates a layout
// GRAMMAR — a lead block, a featured row, named strips, a popular row and a latest row — which
// is also why `content/settings-front.ts` exists beside `settings-sanitize.ts`.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { FrontSettings, FrontStrip } from '@/types'
import { escapeAttr, escapeHtml } from '@/utils'
import { buttonClass } from '@/admin-shared/kit'
import { NOTE_TEXT, SETTING_GAP, SETTING_LABEL } from '@/admin-shared/scale'
import { settingRow, textControl, textField, switchRow } from '@/web/admin/fields'
import { pairGrid } from '@/web/admin/fields-box'
import { gate } from '@/web/admin/fields-pic'
import { choice, plainPick } from '@/web/admin/fields-pick'
import { addPick, listField, BAND } from '@/web/admin/screens/settings-home-kit'
import type { HomeTabView } from '@/web/admin/screens/settings-home'

/** A switch at the head of a band, the same shape the rest of the Home tab uses. */
const toggle = (k: string, label: string, on: boolean, note = ''): string =>
  switchRow({ k, label, note, on })

/**
 * A count and a column choice: the two numbers almost every row has.
 *
 * ⚠️ `numeric: true` ON THE COLUMNS, and it was missing until 2026-09-15. A `<select>` value is
 * a string, `data-k-number` is what turns it into one on the way out, and `columns()` in
 * `content/settings-front.ts` accepts only `1 | 2 | 3` — so the string `"2"` failed the check and
 * fell back to 3. The setting saved, the screen reported success, and the number went nowhere.
 */
function rowSize(t: AdminStrings, k: string, count: number, columns: number, max: number): string {
  return pairGrid(
    textField({ k: `${k}.count`, label: t.frontCount, type: 'number', value: count,
      attrs: `min="1" max="${max}"` })
    + plainPick({ k: `${k}.columns`, label: t.frontColumns, value: String(columns), numeric: true,
      options: [['1', '1'], ['2', '2'], ['3', '3']] }),
  )
}

/**
 * The same two numbers for a STRIP, which stores through the list's one field rather than its
 * own — so neither control carries a `data-k`. See `listField`.
 */
function stripSize(t: AdminStrings, count: number, columns: number): string {
  return pairGrid(
    settingRow({
      label: t.frontCount,
      control: textControl({ value: count, type: 'number', label: t.frontCount,
        attrs: 'min="1" max="12" data-strip-count' }),
    })
    + plainPick({ label: t.frontColumns, value: String(columns), attrs: 'data-strip-columns',
      options: [['1', '1'], ['2', '2'], ['3', '3']] }),
  )
}

/**
 * The composed front page's options. ADR 0014, part 2.
 *
 * The ROW ORDER is not here, and that is the point: it is fixed in the renderer. This is a
 * prepared layout with options, not a block composer, so every control below chooses whether a
 * row appears, how big it is, or where its posts come from — never where it sits.
 */
export function frontCard(t: AdminStrings, f: FrontSettings, v: HomeTabView): string {
  const k = 'home.front'
  // A category can hold at most one row. Offering the same one twice would produce a second strip
  // that is empty, because the first row has already used those posts.
  const taken = new Set(f.strips.map((s) => s.category))
  const free = v.categories.filter((c) => !taken.has(c))
  const strip = (s: FrontStrip, i: number): string =>
    `<div class="mt-3 space-y-2 border-l-2 border-neutral-200 pl-3 dark:border-neutral-800"`
    + ` data-strip="${escapeAttr(s.category)}">`
    + `<div class="flex items-center justify-between gap-2">`
    + `<span class="text-sm text-neutral-700 dark:text-neutral-300" data-strip-name>`
    + `${escapeHtml(s.category)}</span>`
    // Order is the owner's, so it is MOVED rather than dragged: two keys are the whole
    // interaction and they work on a phone and with a keyboard.
    + `<div class="flex gap-1">`
    + `<button type="button" data-strip-up class="${buttonClass('ghost', 'sm')}"`
    + `${i === 0 ? ' disabled' : ''}>↑</button>`
    + `<button type="button" data-strip-remove class="${buttonClass('ghost', 'sm')}">`
    + `${escapeHtml(t.removeSelection)}</button></div></div>`
    + stripSize(t, s.count, s.columns) + `</div>`
  return `<div class="${SETTING_GAP}">`
    // The one dial that moves the whole page.
    + choice({
      k: `${k}.kind`, label: t.frontKindLabel, note: t.frontKindHint, value: f.kind,
      options: [['image', t.frontKindImage], ['text', t.frontKindText]],
    })
    // ----- the lead -----
    + `<div class="${BAND}">` + toggle(`${k}.lead.on`, t.frontLead, f.lead.on, t.frontLeadHint)
    + gate(f.lead.on, plainPick({
      k: `${k}.lead.source`, label: t.frontLeadSource, value: f.lead.source,
      options: [['latest', t.frontLeadLatest], ['pinned', t.frontLeadPinned]],
    })
      // Its only name was its first option, which stops being on screen the moment something is
      // chosen and was never announced as a name at all.
      + gate(f.lead.source === 'pinned', plainPick({
        k: `${k}.lead.slug`, value: f.lead.slug, options: [['', t.frontLeadPickPost],
          ...v.posts.map((p) => [p.slug, p.title] as [string, string])],
        attrs: `aria-label="${escapeAttr(t.frontLeadPickPost)}"`,
      }), `data-gate-when="${k}.lead.source=pinned"`)
      + textField({ k: `${k}.lead.secondary`, label: t.frontSecondary, type: 'number',
        value: f.lead.secondary, attrs: 'min="0" max="3"' }),
    `class="mt-3 space-y-3 pl-1" data-gate="${k}.lead.on"`) + `</div>`
    // ----- the owner's own list -----
    + `<div class="${BAND}">`
    + toggle(`${k}.featured.on`, t.frontFeaturedRow, f.featured.on, t.frontFeaturedHint)
    + gate(f.featured.on, rowSize(t, `${k}.featured`, f.featured.count, f.featured.columns, 12),
      `class="mt-3" data-gate="${k}.featured.on"`) + `</div>`
    // ----- one row per category -----
    + `<div class="${BAND}" data-strips>`
    + `<div class="space-y-3"><span class="${SETTING_LABEL}">${escapeHtml(t.frontStrips)}</span>`
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.frontStripsHint)}</p></div>`
    + `<div data-strip-rows>${f.strips.map(strip).join('')}</div>`
    + gate(f.strips.length < 8 && free.length > 0, addPick({
      label: t.frontStripAdd, attrs: 'data-strip-add', taken,
      options: v.categories.map((c) => [c, c] as [string, string]),
    }), 'class="mt-3" data-strip-add-box')
    + listField(`${k}.strips`, f.strips)
    + `<template data-strip-tpl>${strip({ category: '', count: 3, columns: 3 }, 1)}</template>`
    + `</div>`
    // ----- what people are actually reading -----
    + `<div class="${BAND}">`
    + toggle(`${k}.popular.on`, t.frontPopularRow, f.popular.on, t.frontPopularHint)
    + gate(f.popular.on, pairGrid(
      textField({ k: `${k}.popular.count`, label: t.frontCount, type: 'number',
        value: f.popular.count, attrs: 'min="1" max="12"' })
      // `numeric: true` for the same reason the columns need it: `settings-front.ts` compares
      // against 7, 30 and 0, and a string never equals any of them.
      + plainPick({ k: `${k}.popular.days`, label: t.frontWindow, value: String(f.popular.days),
        numeric: true,
        options: [['7', t.frontWindow7], ['30', t.frontWindow30], ['0', t.frontWindowAll]] }),
    ), `class="mt-3" data-gate="${k}.popular.on"`) + `</div>`
    // ----- and everything else -----
    + `<div class="${BAND}">`
    + toggle(`${k}.latest.on`, t.frontLatestRow, f.latest.on, t.frontLatestHint)
    + gate(f.latest.on, rowSize(t, `${k}.latest`, f.latest.count, f.latest.columns, 24),
      `class="mt-3" data-gate="${k}.latest.on"`) + `</div>`
    // ----- what each item says -----
    + `<div class="space-y-3 ${BAND}">`
    + toggle(`${k}.showDate`, t.frontShowDate, f.showDate)
    + toggle(`${k}.showReadingTime`, t.frontShowReading, f.showReadingTime)
    + toggle(`${k}.tagLinks`, t.frontTagLinks, f.tagLinks, t.frontTagLinksHint)
    + `</div></div>`
}

