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
import { META, NOTE_TEXT } from '@/admin-shared/scale'
import {
  CONTROL_SM, ICON_KEY, ICON_KEY_DANGER, SHEET_FOOT, SHEET_TOOL, SHEET_TOOL_DANGER,
} from '@/admin-shared/kit'
import { emptyState, icon, pageHeader, pager, sheet, sheetTop, tabs, tick } from '@/web/admin/kit'
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
// `py-2.5` and not `py-3`: the row's height is set by the 36px key at its end, and the padding
// only has to keep the key off the rule above and below it. At `py-3` every row carried 4px it
// was not using — 40px down a column of ten.
const ROW = 'border-b border-neutral-100 px-5 py-2.5 hover:bg-neutral-50/60'
  + ' dark:border-neutral-800 dark:hover:bg-neutral-800/30'
// ⚠️ `truncate`, so a long title cannot make one row taller than the rows around it. Measured
// 2026-09-16: without it a two-line title made a 65px row in a list of 44px ones, and which rows
// were tall depended on what had been deleted — a list whose rhythm changes with its contents.
const NAME = 'truncate text-sm font-medium text-neutral-800 dark:text-neutral-200'

/**
 * One trashed item: the thing, when it went, and the two keys that decide its fate.
 *
 * ⚠️ ONE LINE, AND THE VERBS ARE KEYS. This row was two lines and the second one existed to
 * carry "Restore" and "Delete permanently" as words — 143px of every 614px row, the same two
 * words twenty times down the page, and 65px of row height where 28 of it said nothing the row
 * above had not already said. Measured 2026-09-16 on twenty rows.
 *
 * So the verbs become the square key every other list row in this admin uses for its actions,
 * the date moves up beside the name, and the row is one line: 20 rows lost 420px of height and
 * the screen stopped reading as a wall of repeated words.
 *
 * ⚠️ NOT HIDDEN UNTIL HOVER. The comments queue reveals its delete key that way and says why —
 * a moderator reads far more rows than they act on — but it does it with `opacity-0` and no
 * `pointer: coarse` answer, so on a phone that key is invisible and unreachable. A trash whose
 * Restore could not be found on a phone would be worse than a noisy one.
 *
 * ⚠️ BOTH KEYS CARRY A NAME. An icon-only button has no accessible name of its own, and these
 * two are the difference between putting something back and destroying it. `aria-label` for the
 * screen reader, `title` for the pointer, and the red ballpoint for the eye.
 *
 * `data-find` is the name AS TYPED, not folded. The log folds its haystack on the server so a
 * keystroke costs one `includes` per row, and that is right for a ledger of two hundred lines
 * matched by a plain substring. This screen's search is `accent.ts`'s rule instead — a word
 * typed without accents matches any, a word typed WITH them means them — which needs the three
 * lanes of the original text rather than one folded copy, and the island builds those once on
 * the first keystroke. Folding here would quietly turn "lề" back into a search that also finds
 * "lệ". `data-name` is what the question will say out loud, so the island never has to read it
 * back out of the markup it drew — a name with a comma or a quote in it survives the trip as an
 * attribute and would not survive being re-parsed out of a paragraph.
 */
function row(t: AdminStrings, kind: Kind, id: string, name: string, deletedAt: string | null | undefined, body: string): string {
  const key = (attrs: string, label: string, glyph: 'restore' | 'trash', cls: string): string =>
    `<button type="button" ${attrs} aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}"`
    + ` class="${escapeAttr(cls)}">${icon(glyph, 'h-4 w-4')}</button>`
  return `<li class="${ROW}" data-trash-row data-find="${escapeAttr(name)}">`
    + `<div class="flex items-center gap-3">`
    + tick({ label: name, className: 'shrink-0', attrs: `data-trash-pick data-id="${escapeAttr(id)}"` })
    + `<div class="min-w-0 flex-1">${body}</div>`
    // The date is small print beside the name rather than a line of its own, and it goes before
    // the keys so the two keys are the last thing on every row, in the same place on each.
    // ⚠️ THE DATE WITHOUT ITS LABEL. Everything on this screen was deleted, so printing the word
    // "Deleted" on every row says only what the screen's own title already says — the same noise
    // the two verbs were, 48px of it per row, taken from the name. The label rides in `title`
    // for a pointer that asks.
    + (deletedAt
      ? `<span class="${META} hidden shrink-0 whitespace-nowrap sm:inline"`
        + ` title="${escapeAttr(`${t.colDeletedAt} ${formatDateTimeShort(deletedAt)}`)}">`
        + `${escapeHtml(formatDateTimeShort(deletedAt))}</span>`
      : '')
    + `<span class="flex shrink-0 items-center">`
    + key(`data-trash-restore data-kind="${kind}" data-id="${escapeAttr(id)}"`, t.restore, 'restore', ICON_KEY)
    + key(
      `data-trash-purge data-kind="${kind}" data-id="${escapeAttr(id)}" data-name="${escapeAttr(name)}"`,
      t.deletePermanently, 'trash', ICON_KEY_DANGER,
    )
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
/**
 * How many rows of one kind the Trash draws at once. Smaller than the library's 200 because a
 * trash row is a line of text rather than a picture, and because nobody browses their bin: they
 * come here to find one thing or to empty it.
 */
const TRASH_PAGE = 100

const panel = (t: AdminStrings, kind: Kind, open: Kind, rows: string, pagerHtml = ''): string =>
  `<div data-trash-panel="${kind}"${kind === open ? '' : ' hidden'}>`
  + (rows
    // ⚠️ THE THIRD FACE, which this screen did not have until 2026-09-16. The search above hides
    // rows that do not match, so a word matching none left a blank panel with no sentence in it
    // — the one state a list must never be silent about, because "nothing here" and "nothing
    // matched what you typed" are different facts. The lens rather than the empty box, the way
    // the activity log, the comments queue and the library all draw it.
    ? `${emptyState({ title: t.filterEmpty, glyph: 'lens', hidden: true, attrs: `data-trash-nomatch="${kind}"` })}`
      + `<ul class="${LIST}">${rows}</ul>`
    : `<div class="p-8">${emptyState({ title: t.trashEmpty, description: t.trashEmptyHint, glyph: 'emptyBox' })}</div>`)
  + pagerHtml
  + `</div>`

export async function trashScreen(settings: SiteSettings, query: URLSearchParams): Promise<string> {
  const t = adminT(settings.language)
  const open = openKind(query)
  const all = await trashView()

  const counts: Record<Kind, number> = {
    posts: all.posts.length, pages: all.pages.length, notes: all.notes.length,
    media: all.media.length, files: all.files.length, comments: all.comments.length,
    subscribers: all.subscribers.length,
  }

  /**
   * ONE PAGE OF THE OPEN KIND. A bulk delete puts thousands here at once, and this screen drew
   * every one of them; the counts in the tab labels are still the whole kind, because they come
   * from the arrays above rather than from the page.
   *
   * SLICED HERE rather than limited in SQL, unlike the library: the trash is seven lists and the
   * counts beside the tabs have to be exact, so the read is whole either way and the only thing
   * worth not doing is drawing it.
   */
  const at = Math.max(1, Math.floor(Number(query.get('page') ?? '1')) || 1)
  const pageOf = <T>(list: T[], kind: Kind): T[] =>
    kind === open ? list.slice((at - 1) * TRASH_PAGE, at * TRASH_PAGE) : list.slice(0, TRASH_PAGE)
  const keys = (kind: Kind): string =>
    pager(t, '/admin/trash', kind, kind === open ? at : 1,
      Math.max(1, Math.ceil(counts[kind] / TRASH_PAGE)))
  const { posts, pages, notes, media, files, comments, subscribers } = {
    posts: pageOf(all.posts, 'posts'), pages: pageOf(all.pages, 'pages'),
    notes: pageOf(all.notes, 'notes'), media: pageOf(all.media, 'media'),
    files: pageOf(all.files, 'files'), comments: pageOf(all.comments, 'comments'),
    subscribers: pageOf(all.subscribers, 'subscribers'),
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

  const body = panel(t, 'posts', open, slugRows(t, 'posts', posts), keys('posts'))
    + panel(t, 'pages', open, slugRows(t, 'pages', pages), keys('pages'))
    + panel(t, 'notes', open, slugRows(t, 'notes', notes), keys('notes'))
    + panel(t, 'media', open, mediaRows(t, media), keys('media'))
    + panel(t, 'files', open, fileRows(t, files), keys('files'))
    + panel(t, 'comments', open, commentRows(t, comments), keys('comments'))
    + panel(t, 'subscribers', open, subscriberRows(t, subscribers), keys('subscribers'))

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
