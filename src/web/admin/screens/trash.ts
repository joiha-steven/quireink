// The trash, as HTML the server sends (ADR 0054, step 2 of the lists).
//
// SEVEN KINDS, ALL SEVEN DRAWN. The old screen fetched one JSON payload holding every kind and
// then rendered whichever tab was chosen; every row for all seven was already in memory. So the
// markup carries the same seven lists and the island shows one — "one DOM per state", the rail's
// rule, and the same trade the log screen made. It is not more bytes on the wire than the JSON
// it replaces, and it is the difference between a tab that swaps in a frame and a tab that
// swaps after a route, a bundle and a fetch.
//
// THE TICKS ARE REAL CHECKBOXES and the row buttons are real buttons, so the screen is usable
// with a keyboard before any JavaScript arrives. What it cannot do without the island is act:
// restore and delete are POSTs, and the island is what sends them.
//
// EVERY DESTRUCTIVE ACTION ASKS, through `quire:confirm` rather than the browser's own dialog.
// The reason is the log island's and it matters more here: an unheard question is a REFUSAL,
// because this is the one screen where the answer cannot be walked back.
import type { AdminComment, FileItem, MediaItem, Note, Page, Post, SiteSettings } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml, formatDateTimeShort } from '@/utils'
import { NOTE_TEXT } from '@/admin-shared/scale'
import { CONTROL_SM, SHEET_FOOT, SHEET_TOOL, SHEET_TOOL_DANGER } from '@/admin-shared/kit'
import { emptyState, pageHeader, sheet, sheetTop, tabs, tick } from '@/web/admin/kit'
import { trashView } from '@/web/admin/views'

export type Kind = 'posts' | 'pages' | 'notes' | 'media' | 'files' | 'comments' | 'subscribers'

const KINDS: Kind[] = ['posts', 'pages', 'notes', 'media', 'files', 'comments', 'subscribers']

/**
 * WHICH KIND IS OPEN LIVES IN THE ADDRESS, `?tab=media`, the way it does on the settings
 * screen — and here it is load-bearing rather than a convenience. Every write on this screen
 * ends in a reload, because the server owns what is in the trash and the counts on the tabs are
 * part of that. With the kind held only in the page, emptying the picture trash answered by
 * putting the owner back on Posts. In the address, the server draws the kind they were looking
 * at, in the first frame, with no switch to watch.
 */
const openKind = (query: URLSearchParams): Kind => {
  const asked = query.get('tab')
  return KINDS.find((k) => k === asked) ?? 'posts'
}

const LIST = 'paper-cols'
const ROW = 'border-b border-neutral-100 px-5 py-3 hover:bg-neutral-50/60'
  + ' dark:border-neutral-800 dark:hover:bg-neutral-800/30'
const NAME = 'text-sm font-medium text-neutral-800 dark:text-neutral-200'

/**
 * One trashed item: the thing first, then a line of small print — when it was deleted and the
 * two verbs that decide its fate, both quiet words.
 *
 * `data-find` is the name AS TYPED, not folded. The log folds its haystack on the server so a
 * keystroke costs one `includes` per row, and that is right for a ledger of two hundred lines
 * matched by a plain substring. This screen's search is `accent.ts`'s rule instead — a word
 * typed without accents matches any, a word typed WITH them means them — which needs the three
 * lanes of the original text rather than one folded copy, and the island builds those once on
 * the first keystroke. Folding here would quietly turn "lề" back into a search that also finds
 * "lệ". `data-name` is what
 * the question will say out loud, so the island never has to read it back out of the markup it
 * drew — a name with a comma or a quote in it survives the trip as an attribute and would not
 * survive being re-parsed out of a paragraph.
 */
function row(t: AdminStrings, kind: Kind, id: string, name: string, deletedAt: string | null | undefined, body: string): string {
  return `<li class="${ROW}" data-trash-row data-find="${escapeAttr(name)}">`
    + `<div class="flex items-start gap-3">`
    + tick({ label: name, className: 'mt-0.5', attrs: `data-trash-pick data-id="${escapeAttr(id)}"` })
    + `<div class="min-w-0 flex-1">${body}</div></div>`
    + `<div class="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs text-neutral-500 dark:text-neutral-400">`
    + (deletedAt ? `<span class="whitespace-nowrap">${escapeHtml(t.colDeletedAt)} ${escapeHtml(formatDateTimeShort(deletedAt))}</span>` : '')
    + `<span class="ml-auto flex gap-3">`
    + `<button type="button" data-trash-restore data-kind="${kind}" data-id="${escapeAttr(id)}" class="${SHEET_TOOL}">${escapeHtml(t.restore)}</button>`
    + `<button type="button" data-trash-purge data-kind="${kind}" data-id="${escapeAttr(id)}" data-name="${escapeAttr(name)}" class="${SHEET_TOOL_DANGER}">${escapeHtml(t.deletePermanently)}</button>`
    + `</span></div></li>`
}

/** The three kinds that are a piece of writing: a title, and nothing else to say about it. */
const slugRows = (t: AdminStrings, kind: Kind, rows: (Post | Page | Note)[]): string =>
  rows.map((r) => row(t, kind, r.slug, r.title || t.untitled, r.deletedAt,
    `<p class="${NAME}">${escapeHtml(r.title || t.untitled)}</p>`)).join('')

const mediaRows = (t: AdminStrings, rows: MediaItem[]): string =>
  rows.map((m) => row(t, 'media', m.url, m.filename, m.deletedAt,
    `<div class="flex items-center gap-3">`
    + `<img src="${escapeAttr(m.thumb || m.url)}" alt="" width="40" height="40" class="h-10 w-10 shrink-0 rounded-md object-cover">`
    + `<span class="truncate ${NAME}">${escapeHtml(m.filename)}</span></div>`)).join('')

const fileRows = (t: AdminStrings, rows: FileItem[]): string =>
  rows.map((f) => row(t, 'files', f.url, f.filename, f.deletedAt,
    `<p class="${NAME}">${escapeHtml(f.filename)}</p>`)).join('')

const commentRows = (t: AdminStrings, rows: AdminComment[]): string =>
  rows.map((c) => row(t, 'comments', String(c.id), c.name, c.deletedAt,
    `<p class="line-clamp-1 text-sm text-neutral-800 dark:text-neutral-200">${escapeHtml(c.content)}</p>`
    + `<p class="${NOTE_TEXT}">${escapeHtml(c.name)} · ${escapeHtml(c.postTitle ?? '')}</p>`)).join('')

/**
 * A trashed subscriber, with its STATUS printed beside the address.
 *
 * The status rides along so a restored row's meaning is visible before restoring it: putting
 * back a confirmed reader is not the same act as putting back a bot's pending sign-up.
 */
function subscriberRows(t: AdminStrings, rows: { id: number; email: string; status: string; deletedAt?: string }[]): string {
  const label: Record<string, string> = {
    confirmed: t.nlConfirmed, pending: t.nlPending, unsubscribed: t.nlUnsub,
  }
  return rows.map((s) => row(t, 'subscribers', String(s.id), s.email, s.deletedAt,
    `<p class="truncate ${NAME}" title="${escapeAttr(s.email)}">${escapeHtml(s.email)}</p>`
    + `<p class="${NOTE_TEXT}">${escapeHtml(label[s.status] ?? s.status)}</p>`)).join('')
}

/** One kind's panel: its rows, or the drawing that says this kind has nothing in it. */
const panel = (t: AdminStrings, kind: Kind, open: Kind, rows: string): string =>
  `<div data-trash-panel="${kind}"${kind === open ? '' : ' hidden'}>`
  + (rows
    ? `<ul class="${LIST}">${rows}</ul>`
    : `<div class="p-8">${emptyState({ title: t.trashEmpty, description: t.trashEmptyHint, glyph: 'emptyBox' })}</div>`)
  + `</div>`

export async function trashScreen(settings: SiteSettings, query: URLSearchParams): Promise<string> {
  const t = adminT(settings.language)
  const open = openKind(query)
  const { posts, pages, notes, media, files, comments, subscribers } = await trashView()

  const counts: Record<Kind, number> = {
    posts: posts.length, pages: pages.length, notes: notes.length, media: media.length,
    files: files.length, comments: comments.length, subscribers: subscribers.length,
  }
  const items: { key: Kind; label: string }[] = [
    { key: 'posts', label: `${t.tabPosts} (${counts.posts})` },
    { key: 'pages', label: `${t.tabPages} (${counts.pages})` },
    { key: 'notes', label: `${t.tabNotes} (${counts.notes})` },
    { key: 'media', label: `${t.tabImages} (${counts.media})` },
    { key: 'files', label: `${t.tabFiles} (${counts.files})` },
    { key: 'comments', label: `${t.commentsNavTitle} (${counts.comments})` },
    // The Newsletter screen's own word for the same people, so the two never disagree.
    { key: 'subscribers', label: `${t.nlTabPeople} (${counts.subscribers})` },
  ]

  // THE THREE TOOLS BESIDE THE STRIP, all three always in the markup and shown by state. The
  // search and the empty key belong to a kind that HAS something in it; the restore key belongs
  // to a selection, which on the first frame is empty. The island flips `hidden` on all three,
  // so "is there anything to empty" is answered the same way after a tab change as before one.
  const tools = tabs({ items, value: open, attrs: 'data-trash-tabs' })
    + `<span class="flex-1"></span>`
    + `<input type="search" data-trash-search placeholder="${escapeAttr(t.trashSearch)}"`
    + ` aria-label="${escapeAttr(t.trashSearch)}" class="${CONTROL_SM} w-full min-w-0 sm:w-48"`
    + `${counts[open] > 0 ? '' : ' hidden'}>`
    + `<button type="button" data-trash-restore-picked class="${SHEET_TOOL}" hidden>${escapeHtml(t.restore)} (<span data-trash-picked>0</span>)</button>`
    + `<button type="button" data-trash-empty class="${SHEET_TOOL_DANGER}"${counts[open] > 0 ? '' : ' hidden'}>${escapeHtml(t.emptyTrash)}</button>`

  const body = panel(t, 'posts', open, slugRows(t, 'posts', posts))
    + panel(t, 'pages', open, slugRows(t, 'pages', pages))
    + panel(t, 'notes', open, slugRows(t, 'notes', notes))
    + panel(t, 'media', open, mediaRows(t, media))
    + panel(t, 'files', open, fileRows(t, files))
    + panel(t, 'comments', open, commentRows(t, comments))
    + panel(t, 'subscribers', open, subscriberRows(t, subscribers))

  // The words the island can need to SAY, and only those: every other string on this screen is
  // already written into the markup above. `{name}` and `{n}` stay unreplaced — the island fills
  // them, because which name and which count depend on what was pressed.
  const ask = escapeAttr(JSON.stringify({
    purgeTitle: t.askPurgeTitle, noUndo: t.askNoUndo,
    emptyTitle: t.askEmptyTrashTitle, emptyBody: t.askEmptyTrashBody,
    inUseTitle: t.askPurgeInUseTitle, inUseBody: t.askPurgeInUseBody,
    yes: t.askDeleteForever, no: t.askCancel,
    restored: t.restored, restoreFailed: t.restoreFailed,
    purged: t.purged, purgeFailed: t.purgeFailed, emptied: t.trashEmptied,
  }))

  return `<div data-screen="trash" data-trash-tab="${open}" data-trash-ask="${ask}">`
    + pageHeader({ title: t.trashTitle })
    + sheet(sheetTop(tools) + body + `<div class="${SHEET_FOOT}">${escapeHtml(t.trashHint)}</div>`)
    + `</div>`
}
