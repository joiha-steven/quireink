// THE WRITE COLUMN'S TWO DRAWERS: every category and tag across the blog, and every series.
//
// They belong to the column rather than to a screen of their own, because what they rename is
// what the rows in that column are filed under. Both were React components inside a `SlideOver`
// (ADR 0054 converts them with the column).
//
// ⚠️ BOTH ARE DRAWN AND BOTH ARE HIDDEN. The server knows every term and every series — it is a
// tally over the post index it already read for the list — so there is nothing to fetch when a
// drawer opens, and opening one is an attribute. The alternative was two more round trips on a
// screen that has just done one.
//
// ⚠️ ALWAYS MODAL, never docked. `SlideOver` can dock beside the writing at 1360px and these
// two never asked to: a drawer that renames things across the whole blog is not a companion to
// the sentence being typed, and 384px of docked sheet took 232px off the writing column at 1280
// — 34.5% of every line (measured 2026-09-12).
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { Post } from '@/types'
import { escapeAttr, escapeHtml } from '@/utils'
import { seriesEntries } from '@/content/series-order'
import { OVERLAY_LIFT, buttonClass } from '@/admin-shared/kit'
import { icon } from '@/web/admin/kit'

/** A 40px hit target for a 16px mark, which is the floor a finger needs. */
const ICON_BTN = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md'
  + ' text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
  + ' dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white'

const BOX = 'overflow-hidden rounded-lg border border-neutral-200 bg-white'
  + ' dark:border-neutral-800 dark:bg-neutral-900'

const ROW = 'flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5 last:border-0'
  + ' dark:border-neutral-800'

/** Rename and remove, the pair every row in both drawers carries. */
const rowKeys = (t: AdminStrings, kind: string, name: string): string =>
  `<button type="button" data-term-rename aria-label="${escapeAttr(t.rename)}"`
  + ` title="${escapeAttr(t.rename)}" class="${ICON_BTN}">${icon('nib', 'h-4 w-4')}</button>`
  + `<button type="button" data-term-delete aria-label="${escapeAttr(t.delete)}"`
  + ` title="${escapeAttr(t.delete)}" class="${ICON_BTN}">${icon('trash', 'h-4 w-4')}</button>`
  + `<span hidden data-term-kind="${escapeAttr(kind)}" data-term-name="${escapeAttr(name)}"></span>`

/** Count each term across every post, by name. */
function tally(lists: string[][]): { name: string; count: number }[] {
  const seen = new Map<string, number>()
  for (const list of lists) for (const v of list) seen.set(v, (seen.get(v) ?? 0) + 1)
  return [...seen].map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function termColumn(t: AdminStrings, title: string, kind: 'category' | 'tag', posts: Post[]): string {
  const terms = tally(posts.map((p) => (kind === 'tag' ? p.tags : p.categories)))
  const body = terms.length === 0
    ? `<p class="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">${escapeHtml(t.noTerms)}</p>`
    : `<ul>` + terms.map((term) =>
      `<li class="${ROW}" data-term="${escapeAttr(term.name)}">`
      + `<span class="min-w-0 flex-1 truncate text-sm${kind === 'tag' ? ' lowercase' : ''}">`
      + `${escapeHtml(term.name)}</span>`
      + `<span class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">${term.count}</span>`
      + rowKeys(t, kind, term.name) + `</li>`).join('') + `</ul>`
  return `<div class="${BOX}">`
    + `<h2 class="border-b border-neutral-200 px-4 py-3 text-sm font-semibold dark:border-neutral-800">`
    + `${escapeHtml(title)}</h2>${body}</div>`
}

/**
 * ONE COLUMN, not two. This lives in a 384px sheet, where `lg:grid-cols-2` would have squeezed
 * two term lists into about 170px each — `lg:` reads the VIEWPORT and not the box it is in.
 */
const taxonomy = (t: AdminStrings, posts: Post[]): string =>
  `<div class="grid items-start gap-6">`
  + termColumn(t, t.categories, 'category', posts)
  + termColumn(t, t.tags, 'tag', posts)
  + `</div>`

function series(t: AdminStrings, posts: Post[]): string {
  const entries = seriesEntries(posts)
  if (entries.length === 0) {
    return `<p class="text-sm text-neutral-500 dark:text-neutral-400">${escapeHtml(t.noSeries)}</p>`
  }
  const dim = 'disabled:pointer-events-none disabled:opacity-30'
  return `<div class="space-y-6">` + entries.map((s) => {
    const parts = s.parts.map((p, i) =>
      `<li class="${ROW}" data-part="${escapeAttr(p.slug)}">`
      + `<span class="w-6 shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">${i + 1}.</span>`
      + `<a href="/admin/editor/${escapeAttr(p.slug)}" class="min-w-0 flex-1 truncate text-sm hover:underline">`
      + `${escapeHtml(p.title)}</a>`
      + `<button type="button" data-part-up aria-label="${escapeAttr(t.moveUp)}" title="${escapeAttr(t.moveUp)}"`
      + `${i === 0 ? ' disabled' : ''} class="${ICON_BTN} ${dim}">`
      + `${icon('down', 'h-4 w-4 rotate-180')}</button>`
      + `<button type="button" data-part-down aria-label="${escapeAttr(t.moveDown)}" title="${escapeAttr(t.moveDown)}"`
      + `${i === s.parts.length - 1 ? ' disabled' : ''} class="${ICON_BTN} ${dim}">`
      + `${icon('down', 'h-4 w-4')}</button></li>`).join('')
    return `<div class="${BOX}" data-series="${escapeAttr(s.name)}">`
      + `<div class="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">`
      // The one link out of the admin and into the public site: a series has a page of its own,
      // and checking what a reader sees of it is the question this row answers.
      + `<a href="/series/${escapeAttr(s.slug)}" class="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">`
      + `${escapeHtml(s.name)}</a>`
      + `<span class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">${s.parts.length}</span>`
      + rowKeys(t, 'series', s.name)
      + `</div><ol>${parts}</ol></div>`
  }).join('') + `</div>`
}

/**
 * The sheet a drawer slides into: a scrim, a panel, and the two bodies inside it.
 *
 * `aria-modal` and `role=dialog` because it IS one — the scrim takes the page behind it out of
 * reach, so saying anything else would be a lie a screen reader repeats. Escape and the scrim
 * both close it, which the island wires; the close key is here because it carries a word.
 */
export function writeDrawers(t: AdminStrings, posts: Post[]): string {
  const panel = (name: string, title: string, body: string): string =>
    `<section data-drawer="${escapeAttr(name)}" hidden role="dialog" aria-modal="true"`
    + ` aria-label="${escapeAttr(title)}"`
    + ` class="admin-sheet ${OVERLAY_LIFT} fixed inset-y-0 right-0 z-50 flex w-full flex-col`
    + ` border-l border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">`
    + `<header class="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3`
    + ` dark:border-neutral-800">`
    + `<h2 class="text-sm font-semibold">${escapeHtml(title)}</h2></header>`
    + `<div class="scroll-fade min-h-0 flex-1 overflow-y-auto p-5">${body}</div>`
    + `<footer class="border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">`
    + `<button type="button" data-drawer-close class="${buttonClass('secondary')}">`
    + `${escapeHtml(t.close)}</button></footer></section>`
  return `<div data-write-drawers>`
    // The scrim, which is what makes the panel modal: the page behind it is out of reach for
    // the pointer, and `aria-modal` says the same thing to everyone else.
    + `<div data-drawer-scrim hidden class="fixed inset-0 z-40 bg-black/20"></div>`
    + panel('taxonomy', t.tabTaxonomy, taxonomy(t, posts))
    + panel('series', t.tabSeries, series(t, posts))
    + `</div>`
}
