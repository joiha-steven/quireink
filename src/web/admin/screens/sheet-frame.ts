// ONE PIECE, READ OFF THE DATABASE AND HANDED TO THE FOUR RENDERERS.
//
// The three writing addresses differ in what they load and in almost nothing else, so the
// loading is the only thing that branches here: after it there is one draft, one set of links
// and one call to `writingSheet()`. The three React forms this replaces were 384, 339 and 340
// lines of the same shape, and they had already drifted twice in ways nothing caught.
//
// ⚠️ NO SECOND ROUND TRIP. The server is holding the piece while it writes the page, so the
// body, the attributes and the taxonomy lists all travel INSIDE the HTML. The React editor
// fetched `/api/admin/view/editor` after its bundle booted, which is a blank sheet for as long
// as that took on a piece the server already had in hand.
import type { NoteWithContent, PageWithContent, PostWithContent, SiteSettings } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml, isScheduled, isoToZonedInput } from '@/utils'
import { formatDateTimeShort } from '@/admin-shared/when'
import { formatWallClock } from '@/i18n/format'
import { buttonClass } from '@/admin-shared/kit'
import { NOTE_TEXT } from '@/admin-shared/scale'
import {
  emptyDraft, LIVE_PATH, sheetWords,
  type SheetData, type SheetDraft, type SheetKind,
} from '@/admin-shared/sheet-wire'
import { getAutosave } from '@/content/autosave'
import { getCategories, getPost, getTags } from '@/content/posts'
import { getPage } from '@/content/pages'
import { getNote } from '@/content/notes'
import { getAllSeriesNames } from '@/content/series'
import { emptyState } from '@/web/admin/kit'
import { writingSheet } from './sheet'
import { sheetPanel, type PanelLists, type PanelPiece } from './sheet-panel'
import { historyDialog } from './sheet-history'

/** What a writing address loads: the row, and the lists a post's panel offers. */
type Loaded = {
  /** Null for a piece that has never been saved; the slug is then empty too. */
  row: PostWithContent | PageWithContent | NoteWithContent | null
  lists: PanelLists
}

const NO_LISTS: PanelLists = { categories: [], tags: [], series: [] }

async function load(kind: SheetKind, slug: string): Promise<Loaded | null> {
  if (kind === 'post') {
    const [row, categories, tags, series] = await Promise.all([
      slug ? getPost(slug) : Promise.resolve(null),
      getCategories(), getTags(), getAllSeriesNames(),
    ])
    if (slug && !row) return null
    return { row, lists: { categories, tags, series } }
  }
  const row = slug ? await (kind === 'page' ? getPage(slug) : getNote(slug)) : null
  if (slug && !row) return null
  return { row, lists: NO_LISTS }
}

/** Whatever the row holds, in the one shape the fields and the island both read. */
function draftOf(kind: SheetKind, row: Loaded['row'], timezone: string): SheetDraft {
  const base = emptyDraft()
  if (!row) {
    // A new piece is dated NOW rather than left blank: the field is a wall clock on the
    // site's zone, and an empty one would publish whatever the save happened to default to.
    return kind === 'page'
      ? base
      : { ...base, date: isoToZonedInput(new Date().toISOString(), timezone) }
  }
  const post = row as Partial<PostWithContent>
  const note = row as Partial<NoteWithContent>
  return {
    ...base,
    title: row.title,
    slug: row.slug,
    status: row.status,
    date: 'date' in row && row.date ? isoToZonedInput(row.date, timezone) : '',
    categories: post.categories ?? [],
    tags: post.tags ?? [],
    series: post.series ?? '',
    seriesOrder: post.seriesOrder ?? 0,
    featuredImage: post.featuredImage ?? '',
    coverImage: post.coverImage ?? '',
    metaTitle: post.metaTitle ?? '',
    metaDescription: post.metaDescription ?? '',
    excerpt: post.excerpt ?? '',
    sourceUrl: note.sourceUrl ?? '',
    sourceTitle: note.sourceTitle ?? '',
    quote: note.quote ?? '',
  }
}

/** `Page · Draft · 15/9/26 - 13:14`: what this is, what state it is in, when it was touched. */
function metaLine(kind: SheetKind, t: AdminStrings, draft: SheetDraft, touched: string): string {
  const state = isScheduled(draft.status, draft.date)
    ? t.scheduled
    : draft.status === 'published' ? t.statusPublished : t.statusDraft
  // A post says only its state: it is the default kind, and the write column beside it
  // already says which of the three is open.
  const head = kind === 'post' ? state : `${kind === 'page' ? t.kindPage : t.kindNote} · ${state}`
  return [head, touched ? formatDateTimeShort(touched) : ''].filter(Boolean).join(' · ')
}

/**
 * History and Analytics: the two ways out of the editor back to the same piece.
 *
 * ⚠️ BOTH ARE DRAWN AND HIDDEN, like everything else on this sheet. They are a post's alone —
 * pages and notes keep no revisions, and analytics needs a piece that is actually public,
 * because a link to a certainly-empty screen is worse than no link. But "has this been saved
 * yet" and "is it live yet" both change WITHOUT a reload, and a control that only the server
 * can draw is a control the first save cannot produce.
 */
function headerLinks(t: AdminStrings, kind: SheetKind, draft: SheetDraft, saved: boolean): string {
  if (kind !== 'post') return ''
  const quiet = 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
  const live = saved && draft.status === 'published' && !isScheduled(draft.status, draft.date)
  return `<button type="button" data-sheet-history class="${quiet}"${saved ? '' : ' hidden'}>`
    + `${escapeHtml(t.history)}</button>`
    + `<a data-piece-stats href="/admin/analytics?path=${escapeAttr(encodeURIComponent(`/${draft.slug}`))}"`
    + ` class="${quiet}"${live ? '' : ' hidden'}>${escapeHtml(t.analyticsTitle)}</a>`
}

/**
 * The Trash link at the foot of the panel, under a rule of its own.
 *
 * It ASKS NOTHING: the delete is soft, the row keeps its body and its revisions, and the way
 * back sits in the toast where the eye already is. A question before a reversible act is a toll
 * on the ninety-nine times somebody meant it, paid to save the one time they did not.
 */
function trashKey(t: AdminStrings, kind: SheetKind, slug: string): string {
  // Drawn even with no row to bin, and hidden: a piece saved for the first time HAS one from
  // that moment, and nothing else on this page can draw a control after the fact.
  return `<div data-trash-block class="space-y-2 border-t border-neutral-200 pt-4`
    + ` dark:border-neutral-800"${slug ? '' : ' hidden'}>`
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.trashNote)}</p>`
    + `<button type="button" data-sheet-trash data-kind="${escapeAttr(kind)}"`
    + ` class="${escapeAttr(buttonClass('danger', 'sm'))}">`
    + `${escapeHtml(t.moveToTrash)}</button></div>`
}

/** The address that names nothing: the one dead end this screen can reach. */
function missing(t: AdminStrings): string {
  return `<div class="admin-enter min-w-0 flex-1" data-admin-404>`
    + emptyState({
      glyph: 'compass', title: t.notFoundTitle, description: t.notFoundBody,
      actionHtml: `<a href="/admin/content" class="${escapeAttr(buttonClass('secondary'))}">`
        + `${escapeHtml(t.navWrite)}</a>`,
    })
    + `</div>`
}

/**
 * The sheet for one writing address, or the dead end when the slug names nothing.
 *
 * `settings` rather than a fetch of its own: the shell already has it, and the three numbers
 * the island needs from it — the column's width, the autosave interval, the typewriter — are
 * the same three on every one of these addresses.
 */
export async function writingFrame(
  settings: SiteSettings, kind: SheetKind, slug: string,
): Promise<string> {
  const t = adminT(settings.language)
  const loaded = await load(kind, slug)
  if (!loaded) return missing(t)

  const { row, lists } = loaded
  const draft = draftOf(kind, row, settings.timezone)
  const content = row ? (row as { content?: string }).content ?? '' : ''
  const saved = Boolean(row)
  const scheduled = isScheduled(draft.status, draft.date)
  const live = draft.status === 'published' && saved && !(kind === 'post' && scheduled)

  const data: SheetData = {
    kind,
    lang: settings.language,
    timezone: settings.timezone,
    slug: row?.slug ?? '',
    content,
    draft,
    autosaveSeconds: settings.autosaveSeconds,
    autosaveAt: slug ? (getAutosave(kind, slug)?.at ?? null) : null,
    rowSavedAt: row?.updatedAt ? Date.parse(row.updatedAt) : null,
    keySound: {
      mode: settings.motion.keys,
      volume: settings.motion.keyVolume,
      squeak: settings.motion.penSqueak,
    },
  }

  const piece: PanelPiece = {
    kind,
    slug: draft.slug,
    title: draft.title,
    status: draft.status,
    date: draft.date,
    categories: draft.categories,
    tags: draft.tags,
    series: draft.series,
    seriesOrder: draft.seriesOrder,
    featuredImage: draft.featuredImage,
    coverImage: draft.coverImage,
    metaTitle: draft.metaTitle,
    metaDescription: draft.metaDescription,
    excerpt: draft.excerpt,
    sourceUrl: draft.sourceUrl,
    sourceTitle: draft.sourceTitle,
    quote: draft.quote,
    scheduledNote: scheduled
      ? `${t.scheduledForPrefix} ${formatWallClock(draft.date, settings.language)}`
      : '',
  }

  const panel = sheetPanel({
    t, lang: settings.language, piece, lists,
    headerRight: headerLinks(t, kind, draft, saved),
    bottom: trashKey(t, kind, draft.slug),
  })

  const sheet = writingSheet({
    t,
    piece: {
      slug: row?.slug ?? '',
      title: draft.title,
      content,
      metaLine: metaLine(kind, t, draft, row?.updatedAt ?? ''),
    },
    links: {
      live: {
        href: LIVE_PATH[kind](draft.slug),
        label: kind === 'note' ? t.viewNote : t.viewPost,
      },
      liveNow: live,
      // Preview is a post's alone: the other two kinds have no preview route.
      canPreview: kind === 'post',
      previewNow: kind === 'post' && saved,
      publish: t.publish,
      schedule: t.schedule,
      scheduled,
    },
    contentWidth: settings.contentWidth,
    panel,
    // A post's alone, and only once it has a row: revisions are what a SAVE leaves behind.
    overlays: kind === 'post' && saved ? historyDialog(t) : '',
    // ⚠️ THE WORDS THE SHEET PRINTS, AND NO MORE. A whole admin dictionary is 1,258 keys and
    // 25 KB gzipped on every editor open, most of it for screens this one cannot reach.
    data: { ...data, words: sheetWords(t) },
  })
  return `<div class="admin-enter min-w-0 flex-1">${sheet}</div>`
}
