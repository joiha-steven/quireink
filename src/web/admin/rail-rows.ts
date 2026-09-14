// The admin rail's rows, as HTML the server sends (ADR 0054).
//
// Split from `rail.ts` at the 400-line rule, and the seam is the one the React rail already
// had: `AdminSidebar` was the frame, `NavColumn` was what stood inside it and `NavFooter` was
// the strip at the bottom. Three files became three files; only the language changed.

import type { AdminStrings } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { ICONS } from '@/icons'
import {
  BRAND_RED, MARK_DOT, MARK_Q, MARK_VIEWBOX, WORD_DOT, WORD_INK, WORD_QUIRE, WORD_VIEWBOX,
} from '@/brand-art'
import {
  PALETTE_CHORD, SIDEBAR_GROUP, SIDEBAR_NAV, SIDEBAR_NAV_ACTIVE, SIDEBAR_NAV_QUIET, SIDEBAR_UTIL,
  printChord, type RailRow,
} from '@/admin-shared/rail'

/**
 * A glyph from the shared set.
 *
 * `--admin-glyph` and not a hard 20px: the rail sets that variable to 18px on itself
 * (`.rail-glyphs` in `admin.css`) because a rail's glyph stands beside a 15px label and a 20px
 * mark out-weighs the word it belongs to. One variable on the container beats a size at
 * twenty-one call sites.
 */
export const glyph = (name: keyof typeof ICONS): string =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
  + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
  + ' class="h-[var(--admin-glyph,1.25rem)] w-[var(--admin-glyph,1.25rem)] shrink-0">'
  + `${ICONS[name]}</svg>`

/**
 * The wordmark, BOTH of it.
 *
 * `Q.` and `quireINK` are the same logo at two sizes, and which one shows is a CSS question —
 * the collapsed rail is 72px, where the word would be a smear. Outlines rather than live text
 * because the admin renders in whatever chrome font the owner picked: as text this would have
 * been a different logo per install.
 */
export const WORDMARK =
  `<svg viewBox="${WORD_VIEWBOX}" height="20" fill="currentColor" class="w-auto rail-word" role="img" aria-label="quireINK">`
  + `<path d="${WORD_QUIRE}"/><path d="${WORD_INK}"/>`
  + `<circle cx="${WORD_DOT.cx}" cy="${WORD_DOT.cy}" r="${WORD_DOT.r}" fill="${BRAND_RED}"/></svg>`
  + `<svg viewBox="${MARK_VIEWBOX}" height="22" fill="currentColor" class="w-auto shrink-0 rail-mark" role="img" aria-label="Q.">`
  + `<path d="${MARK_Q}"/>`
  + `<circle cx="${MARK_DOT.cx}" cy="${MARK_DOT.cy}" r="${MARK_DOT.r}" fill="${BRAND_RED}"/></svg>`

/** Is this row the page we are on? `/admin` matches only itself; the rest match their tree. */
const active = (href: string, path: string): boolean =>
  href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`)

/**
 * The row class, with the active row taking the QUIET base.
 *
 * A highlighted row has nothing to gain from a hover state — you are already there — and the
 * grey one would paint over the mark. `group` so the GLYPH can answer the pointer as well as
 * the ground: 2px to the right over 120ms, the smallest movement that reads as the row leaning
 * towards the page it opens. The row itself never moves; a label that shifts under the cursor
 * is the thing you were about to click moving away from you.
 */
export const rowClass = (isActive: boolean): string =>
  `group ${isActive ? SIDEBAR_NAV_QUIET : SIDEBAR_NAV} rail-row ${isActive ? SIDEBAR_NAV_ACTIVE : ''}`

/**
 * The glyph wrapper. Never leans on the active row: it is already home.
 *
 * `rail-glyph` is what the icons switch hides, and it is a CLASS rather than a state written
 * into the markup — see the file header.
 */
export const leaning = (body: string, isActive: boolean): string =>
  `<span class="rail-glyph flex shrink-0 transition-transform duration-[120ms]${isActive ? '' : ' group-hover:translate-x-0.5'}">${body}</span>`

/** The label, which the collapsed rail hides and the island copies into a tooltip. */
export const labelOf = (row: RailRow): string =>
  `<span class="rail-label truncate">${escapeHtml(row.label)}</span>`

/**
 * One row, by id.
 *
 * `data-rail-id` is on EVERY row and says which row this is. `data-nav-row`, which arrange mode
 * adds to its wrapper, says something else: that this row can be picked up right now. They
 * were one attribute for a day and the difference matters — the drag hit-tests against
 * `[data-nav-row]`, so a rail that carried it at rest would have every row answering a probe
 * no one had started.
 */
export function renderRow(row: RailRow, path: string): string {
  const id = row.id
  const body = (isActive: boolean): string =>
    (row.icon ? leaning(glyph(row.icon), isActive) : '') + labelOf(row)

  if (row.href) {
    const isActive = active(row.href, path)
    const rel = row.external ? ' target="_blank" rel="noopener"' : ''
    return `<a href="${escapeAttr(row.href)}" data-rail-id="${id}"${rel}`
      + `${isActive ? ' aria-current="page"' : ''} class="${rowClass(isActive)}">${body(isActive)}</a>`
  }

  if (id === 'more') {
    // AN EYEBROW, not a fifth destination. It names no page — it folds the rest of the rail
    // out — and at the destinations' 15px/500 it read as one more place to go, which is what
    // put a chevron and a glyph on a row that had to compete with them for width. 12px
    // uppercase settles both: it is visibly a heading, and the label has room again in all
    // eleven languages.
    //
    // `aria-expanded` is written here as the CLOSED state and corrected by the boot script in
    // the same breath as the attribute it describes — an ARIA state that lags the visual one
    // is worse than none.
    return `<button type="button" data-rail-id="more" aria-expanded="false"`
      + ` class="group rail-row rail-more ${SIDEBAR_GROUP}">`
      + `<span class="rail-more-face flex min-w-0 items-center">`
      + `${leaning(glyph('more'), false)}${labelOf({ ...row })}</span>`
      // The one row carrying TWO glyphs, so the one row that runs out of width: 16px in a 16px
      // box on an 8px gap, where a destination's glyph is 20. A glyph says WHAT the row is and
      // a state chevron says which way it will move, so they are not peers and need not be
      // drawn at one size.
      + `<span class="rail-more-chevron grid h-4 w-4 shrink-0 place-items-center [&>svg]:h-4 [&>svg]:w-4 transition-transform">`
      + `${glyph('prev')}</span></button>`
  }

  // A control that is not a link and not the group row. Every one of them is a key in the
  // strip at the foot, drawn by `footStrip`; reaching here means a stored order put a control
  // among the destinations, which the owner is allowed to do.
  //
  // `SIDEBAR_UTIL`, not the destinations' class: a control is smaller and quieter than a place,
  // and for a while they wore `SIDEBAR_NAV` — four more destinations, one apparently a page
  // named "Light".
  return `<button type="button" data-rail-id="${id}" class="${SIDEBAR_UTIL} rail-row gap-2.5">${body(false)}</button>`
}

/**
 * A zone's floor.
 *
 * Move every row out of "Everything else" and the group becomes a zero-height div with no rows
 * to aim at, so the list would be closed for good. This is a target with a height of its own,
 * and it only takes up room while the zone is empty — which the island marks, since it is the
 * one that knows what has just been dragged where.
 */
/**
 * The chord badge, in BOTH spellings.
 *
 * Printing a chord on the thing the mouse clicks is the whole reason this control is visible: a
 * chord cannot be discovered, and a shortcut sheet on another screen teaches nobody. The server
 * has no platform to ask, so it writes both and the boot script picks — see `printChord`.
 */
export const chordBadge = (extra = ''): string =>
  `<span data-rail-chord data-mac="${escapeAttr(printChord(PALETTE_CHORD, true))}"`
  + ` class="rail-chord rounded border border-neutral-200 px-1 py-px text-xs tabular-nums leading-none dark:border-neutral-700${extra ? ` ${extra}` : ''}">`
  + `${escapeHtml(printChord(PALETTE_CHORD, false))}</span>`

/** Search as chrome, on the wordmark's row. */
export const searchKey = (t: AdminStrings): string =>
  `<button type="button" data-nav-search aria-label="${escapeAttr(t.paletteTitle)}"`
  + ` class="rail-search-key flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-transparent px-2 text-neutral-500 transition-colors hover:border-neutral-200 hover:bg-neutral-50 hover:text-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200">`
  + `${glyph('search')}${chordBadge()}</button>`

/** Search as a ROW, for a rail with no wordmark. One control in two dresses. */
export const searchRow = (t: AdminStrings): string =>
  `<button type="button" data-nav-search class="${rowClass(false)} rail-search-row justify-between">`
  + `<span class="flex min-w-0 items-center gap-3">${glyph('search')}`
  + `<span class="rail-label truncate">${escapeHtml(t.paletteTitle)}</span></span>`
  + chordBadge('text-neutral-500 dark:text-neutral-400') + '</button>'


export const floor = (zone: string): string => `<div data-nav-floor="${zone}" class="rail-floor"></div>`
