// The moderation queue, as HTML the server sends (ADR 0054).
//
// GROUPED BY POST, because that is the unit a moderator thinks in, and the server does the
// grouping. It always did: the React face fetched one flat list of up to 200 comments and
// grouped them in the browser on every keystroke, so the grouping was never a client decision,
// only a client COST. Here the cards arrive built, in the order the default answer wants them.
//
// WHAT THE ISLAND DOES to that arrangement is narrow it and reorder it, never rebuild it. A
// filter hides comments and then hides any card left holding none; "busiest" moves the cards
// that are already there. No row, card, count or highlight is ever constructed from data — the
// only thing it writes is the highlighter over a matched word, and it writes that from the
// row's own text, kept on the element for the purpose.
//
// THE BAND'S FOUR NUMBERS ARE OFF THE FULL SET, not the filtered one. A total that changes as
// you type is not a total, and the React face said so; the server can therefore write them once
// and the island never touches them.
import type { AdminComment, SiteSettings } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml, formatDateTimeShort } from '@/utils'
import { formatCount } from '@/i18n/format'
import { SHEET_FOOT, SHEET_TOOL, SHEET_TOOL_DANGER } from '@/admin-shared/kit'
import { emptyState, pageHeader, selectionBar, sheet, sheetTop, tabs, tick } from '@/web/admin/kit'
import { numBand } from '@/web/admin/kit-figures'
import { commentsView } from '@/web/admin/views'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** The commenter's initial, for the small square that opens every row. */
const initialOf = (name: string): string => (name.trim()[0] ?? '?').toUpperCase()

const INITIAL = 'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-neutral-100'
  + ' text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
const META = 'flex items-baseline gap-x-2 text-xs text-neutral-500 dark:text-neutral-400'
const WHO = 'truncate font-medium text-neutral-700 dark:text-neutral-300'
const BADGE = 'shrink-0 rounded-full border border-neutral-200 px-1.5 text-xs tabular-nums'
  + ' text-neutral-500 dark:border-neutral-700 dark:text-neutral-400'
const TITLE_LINK = 'min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900 hover:underline dark:text-white'
const FORENSICS = 'mt-1 flex flex-wrap items-baseline gap-x-2 text-xs text-neutral-400 dark:text-neutral-500'

/**
 * One comment.
 *
 * `data-text` on each markable span is the SAME string the span renders, and it is the whole
 * reason the island can paint a highlighter without ever losing the original: it rebuilds the
 * span's children from this attribute rather than from whatever it painted last time. A
 * `<mark>` written over a `<mark>` is how a search box eats the text it was searching.
 *
 * `data-find` is the haystack the search reads: the comment, the name and the post's title, as
 * typed. Not folded — this screen keeps `accent.ts`'s rule, where a word typed WITH accents
 * means them, and folding here would throw them away before the browser saw them.
 */
function comment(t: AdminStrings, c: AdminComment, title: string): string {
  const mark = (text: string, cls: string): string =>
    `<span data-mark data-text="${escapeAttr(text)}" class="${cls}">${escapeHtml(text)}</span>`
  return `<li data-comment="${c.id}" data-at="${Date.parse(c.createdAt) || 0}"`
    + ` data-find="${escapeAttr(`${c.content} ${c.name} ${title}`)}" class="group flex gap-2.5 py-2">`
    + tick({ label: c.name, className: 'mt-1 self-start', attrs: `data-comment-pick data-id="${c.id}"` })
    + `<span aria-hidden="true" class="${INITIAL}">${escapeHtml(initialOf(c.name))}</span>`
    + `<div class="min-w-0 flex-1">`
    + `<div class="${META}">${mark(c.name, WHO)}`
    + `<span class="whitespace-nowrap">${escapeHtml(formatDateTimeShort(c.createdAt))}</span>`
    // Delete waits for the pointer and takes no room while it waits: a moderator reads far more
    // rows than they act on. Red ballpoint, the ink this admin reserves for striking out.
    + `<button type="button" data-comment-delete data-id="${c.id}"`
    + ` class="ml-auto shrink-0 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 ${SHEET_TOOL_DANGER}">`
    + `${escapeHtml(t.commentsColDelete)}</button></div>`
    + `<button type="button" data-comment-expand aria-expanded="false"`
    + ` class="mt-0.5 block w-full text-left text-sm text-neutral-800 dark:text-neutral-200">`
    + mark(c.content, 'line-clamp-3')
    + `</button>`
    // The forensics, one line, and only where it exists: the third question a moderator asks.
    + (c.email || c.ip
      ? `<div class="${FORENSICS}">`
        + (c.email ? `<span class="truncate">${escapeHtml(c.email)}</span>` : '')
        + (c.ip ? `<span class="whitespace-nowrap">${escapeHtml(c.ip)}${c.country ? ` (${escapeHtml(c.country)})` : ''}</span>` : '')
        + `</div>`
      : '')
    + `</div></li>`
}

/** A post, and the comments under it. The count on the card is what says "look here first". */
function card(t: AdminStrings, g: { slug: string; title: string; items: AdminComment[]; newest: number }): string {
  // ⚠️ THE MARK RIDES ON THE LINK ITSELF, not on a span inside it. The link holds nothing but
  // the title, so a wrapper would buy nothing and would put an element in the tree that the
  // React face did not have: measured against it, the first span inside this row stopped being
  // the count badge and the two builds' DOMs no longer lined up for comparison.
  return `<section data-card data-newest="${g.newest}" class="px-5 py-4">`
    + `<div class="mb-2 flex items-baseline gap-2 border-b border-neutral-100 pb-2 dark:border-neutral-800">`
    + `<a href="/${escapeAttr(g.slug)}" target="_blank" rel="noopener" title="${escapeAttr(g.title)}"`
    + ` data-mark data-text="${escapeAttr(g.title)}" class="${TITLE_LINK}">${escapeHtml(g.title)}</a>`
    + `<span data-card-count class="${BADGE}">${g.items.length}</span></div>`
    + `<ul>${g.items.map((c) => comment(t, c, g.title)).join('')}</ul></section>`
}

export async function commentsScreen(settings: SiteSettings): Promise<string> {
  const t = adminT(settings.language)
  const n = (x: number): string => formatCount(x, settings.language)
  const { rows } = await commentsView()

  if (rows.length === 0) {
    return `<div data-screen="comments">`
      + pageHeader({ title: t.commentsNavTitle })
      + emptyState({ title: t.commentsEmpty, description: t.commentsEmptyHint, glyph: 'letter' })
      + `</div>`
  }

  // The DEFAULT answer, built here: newest first, and every post that has anything.
  const by = new Map<string, { slug: string; title: string; items: AdminComment[]; newest: number }>()
  for (const c of rows) {
    const g = by.get(c.postSlug) ?? { slug: c.postSlug, title: c.postTitle ?? c.postSlug, items: [], newest: 0 }
    g.items.push(c)
    g.newest = Math.max(g.newest, Date.parse(c.createdAt) || 0)
    by.set(c.postSlug, g)
  }
  const groups = [...by.values()]
  for (const g of groups) g.items.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
  groups.sort((a, b) => b.newest - a.newest)

  const since = Date.now() - WEEK_MS
  const band = numBand([
    { n: n(rows.length), label: t.commentsNavTitle },
    { n: n(by.size), label: t.commentsStatPosts },
    { n: n(rows.filter((c) => (Date.parse(c.createdAt) || 0) >= since).length), label: t.commentsStatWeek },
    { n: n(new Set(rows.map((c) => (c.email || c.name).toLowerCase())).size), label: t.commentsStatPeople },
  ])

  // TWO STRIPS, TWO QUESTIONS: how it is sorted, and how far back. Both are `choice` rather
  // than `place` — a filter is a value, not a destination — which is what keeps the sunken
  // paper key here and the highlighter on the rail.
  const tools = tabs({
    items: [{ key: 'recent', label: t.commentsSortRecent }, { key: 'busiest', label: t.commentsSortBusiest }],
    value: 'recent', role: 'choice', attrs: 'data-comment-sort',
  })
    + tabs({
      items: [{ key: 'all', label: t.filterAll }, { key: 'week', label: t.commentsFilterWeek }],
      value: 'all', role: 'choice', attrs: 'data-comment-age',
    })
    + `<span class="flex-1"></span>`
    // ⚠️ THE SHARED BAR, not a third copy of it. This screen re-typed `selectionBar`'s markup
    // byte for byte until 2026-09-16 — same wrapper, same two keys, same counter — which is how
    // it kept the old `text-sm` neutral delete after the kit's own moved to the red ballpoint.
    + selectionBar({
      clearLabel: t.clearSelection, deleteLabel: t.deleteSelected, attrs: 'data-comment-selection',
    })
    + `<span data-comment-tally class="${SHEET_TOOL}">`
    + `${escapeHtml(t.commentsInPosts.replace('{n}', n(rows.length)).replace('{p}', n(by.size)))}</span>`
    + `<input type="search" data-comment-search placeholder="${escapeAttr(t.commentsSearch)}"`
    + ` aria-label="${escapeAttr(t.commentsSearch)}"`
    + ` class="h-8 w-56 rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-[inset_0_1px_1.5px_rgba(0,0,0,.06)] placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-[inset_0_1px_1.5px_rgba(0,0,0,.35)] dark:placeholder:text-neutral-500">`

  // The two words the island can need to say, plus the sentence it recomputes. Everything else
  // on this screen is already written above.
  const words = escapeAttr(JSON.stringify({
    inPosts: t.commentsInPosts, trashed: t.trashedOne, undo: t.undo, failed: t.deleteFailed,
    restoreFailed: t.restoreFailed,
  }))
  return `<div data-screen="comments" data-comment-words="${words}">`
    + pageHeader({ title: t.commentsNavTitle })
    + sheet(sheetTop(tools) + band
      + `<p data-comment-nomatch class="px-5 py-8 text-sm text-neutral-500 dark:text-neutral-400" hidden>${escapeHtml(t.filterEmpty)}</p>`
      + `<div data-comment-cards class="paper-cols">${groups.map((g) => card(t, g)).join('')}</div>`
      + `<div class="${SHEET_FOOT}">${escapeHtml(t.commentsFootHint)} ${escapeHtml(t.commentsWalkHint)}</div>`)
    + `</div>`
}
