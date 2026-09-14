// THE WRITE SCREEN — the list, and the paper beside it (ADR 0054).
//
// FOUR ADDRESSES, ONE COLUMN. `/admin/content` is the list with an empty sheet beside it, and
// `/admin/editor/*`, `/admin/page-editor/*` and `/admin/note-editor/*` are the same list with a
// piece open in that sheet. The ADR says the library, the pane and the editors convert together
// and this is why: the column is one 399-line component, and drawing it as HTML for the list
// while leaving it as React beside the editors would be two copies of one list, drifting in the
// direction nobody looks. So the server draws the column on all four, and what is still React
// on three of them is only what goes IN the sheet.
//
// ⚠️ A ROW CLICK IS A REAL NAVIGATION NOW, and that is the trade this step makes. The React
// shell mounted the column outside the router so a click swapped only the sheet; a page reaches
// its heading in 17ms where rebooting the bundle took 341, but a click that cost 4ms costs a
// load. What is lost with it is the column's in-page memory — scroll position, the search text,
// the open drawer — so the island puts the first two back through `sessionStorage`, which is
// the only part of that state a person would notice going.
import type { Post, SiteSettings } from '@/types'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { formatDateTimeShort } from '@/admin-shared/when'
import { UTIL } from '@/admin-shared/scale'
import { CARD, buttonClass } from '@/admin-shared/kit'
import { emptyState } from '@/web/admin/kit'
import { getIndex } from '@/content/posts'
import { getPageIndex } from '@/content/pages'
import { getNoteIndex } from '@/content/notes'
import { getViewTotals } from '@/analytics/summary'
import { needsFrom, writeItems, type WriteItem } from '@/web/admin/screens/content-items'
import { writePane } from '@/web/admin/screens/content-pane'
import { writeDrawers } from '@/web/admin/screens/content-drawers'

/**
 * Everything the column needs, and nothing else.
 *
 * `contentView()` also carries `commentCounts` and `commentsEnabled`, which the pane and the
 * dashboard's recent band both fetched and neither ever read. A server render is the moment to
 * stop paying for them.
 */
async function paneData(): Promise<{
  items: WriteItem[]; views: Record<string, number>; posts: Post[]
}> {
  const [posts, pages, notes, views] = await Promise.all([
    getIndex(), getPageIndex(), getNoteIndex(), getViewTotals(),
  ])
  return { items: writeItems(posts, pages, notes), views, posts }
}

/**
 * The last three pieces touched, under the invitation.
 *
 * This sheet is reached most often by somebody RETURNING to work, and until 2026-09-07 the only
 * two things on it — New page, New post — both started something else.
 */
function recent(items: WriteItem[], t: ReturnType<typeof adminT>): string {
  const three = items.filter((it) => it.touched > 0).slice(0, 3)
  if (three.length === 0) return ''
  return `<div class="mt-8 w-full max-w-sm text-left">`
    + `<p class="${UTIL}">${escapeHtml(t.recentlyEdited)}</p>`
    + `<ul class="mt-1.5">`
    + three.map((it) =>
      `<li class="border-b border-neutral-100 last:border-0 dark:border-neutral-800">`
      // `py-3` and not `py-2`: 20px of line plus 24px of padding is 44, which is the floor a
      // finger needs. A 36px row here would put new sub-44 targets on the one screen a phone
      // reaches by mistyping an address.
      + `<a href="${escapeAttr(it.editHref)}" class="-mx-2 flex items-baseline justify-between`
      + ` gap-3 rounded px-2 py-3 transition hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50">`
      + `<span class="min-w-0 truncate text-sm text-neutral-800 dark:text-neutral-200">`
      + `${escapeHtml(it.title || `${t.untitled} #${it.untitledNo ?? 1}`)}</span>`
      // Guarded: `touched` is 0 for a piece carrying no date at all, and an unguarded format
      // prints 1/1/70 beside its title.
      + `<span class="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">`
      + `${escapeHtml(formatDateTimeShort(it.touched))}</span>`
      + `</a></li>`).join('')
    + `</ul></div>`
}

/** The empty paper: the invitation, and what was touched last. */
function blankSheet(items: WriteItem[], t: ReturnType<typeof adminT>): string {
  const keys = `<div class="flex flex-col items-center">`
    + `<div class="flex items-center gap-2">`
    + `<a href="/admin/note-editor" class="${buttonClass('secondary')}">${escapeHtml(t.newNote)}</a>`
    + `<a href="/admin/page-editor" class="${buttonClass('secondary')}">${escapeHtml(t.newPage)}</a>`
    + `<a href="/admin/editor" class="${buttonClass('primary')}">${escapeHtml(t.newPost)}</a>`
    + `</div>${recent(items, t)}</div>`
  // Hidden where the pane takes the whole width — the list IS the screen there.
  return `<div data-write-empty class="hidden min-w-0 flex-1 xl:block ${CARD} lg:min-h-[calc(100vh-1.5rem)]">`
    + `<div class="flex min-h-[calc(100vh-1.5rem)] flex-col items-center justify-center">`
    + emptyState({
      glyph: 'blankPage', title: t.writeNothingOpen, description: t.writeEmpty, actionHtml: keys,
    })
    + `</div></div>`
}

/**
 * The screen, for whichever of the four addresses asked.
 *
 * `openKey` is what the sheet beside the column is showing, so the column can carve the row in
 * before anything runs. It is free here and it was not in React: the address IS the answer, so
 * there is no `pieceAtPath` reading `location.pathname` to beat a fetch to the selection.
 */
export async function contentScreen(_settings: SiteSettings, query: URLSearchParams): Promise<string> {
  const t = adminT(_settings.language)
  const { items, views, posts } = await paneData()
  const pane = writePane({
    t, lang: _settings.language, items, views,
    needs: needsFrom(query), openKey: '', alone: true, now: Date.now(),
  })
  return `<div class="flex items-start gap-6">${pane}${blankSheet(items, t)}</div>`
    + writeDrawers(t, posts)
}

/** The kind of piece a writing address opens, and the prefix that names it. */
const OPENS: [prefix: string, kind: 'post' | 'page' | 'note'][] = [
  ['/admin/editor', 'post'],
  ['/admin/page-editor', 'page'],
  ['/admin/note-editor', 'note'],
]

/** `kind:slug` for a writing address, or '' for a new piece and for the list itself. */
export function openKeyOf(path: string): string {
  for (const [prefix, kind] of OPENS) {
    if (path !== prefix && !path.startsWith(`${prefix}/`)) continue
    const slug = decodeURIComponent(path.slice(prefix.length).replace(/^\//, '').replace(/\/+$/, ''))
    return slug ? `${kind}:${slug}` : ''
  }
  return ''
}

/**
 * An editor address: the same column, and a sheet the EDITOR fills.
 *
 * ⚠️ `<div id="admin">` GOES IN THE SHEET, not beside it, and that is the whole of this step's
 * bargain with the editor. ProseMirror is an application and stays one (ADR 0054 point 3), so
 * React still draws what is inside the paper — but it no longer draws the frame, the rail or
 * the list, and it no longer owns the address. `spa.ts` puts its mount point where this says.
 */
export async function editorFrame(settings: SiteSettings, path: string): Promise<string> {
  const t = adminT(settings.language)
  const { items, views, posts } = await paneData()
  const pane = writePane({
    t, lang: settings.language, items, views,
    needs: null, openKey: openKeyOf(path), alone: false, now: Date.now(),
  })
  // `min-w-0` is not tidy-up: a flex item's `min-width:auto` refuses to shrink below its
  // content, which on a phone gave the editor 591px of sideways scroll. `flex-1` is the other
  // half — without it the sheet sat at content width, 370px in a 1440px window.
  return `<div class="flex items-start gap-6">${pane}`
    + `<div class="admin-enter min-w-0 flex-1"><div id="admin"></div></div></div>`
    + writeDrawers(t, posts)
}
