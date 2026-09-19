// THE ATTRIBUTES PANEL: everything about the piece that is not the piece.
//
// One renderer for three kinds, because they are one panel with different fields in it — and
// because the three React copies it replaces had already drifted twice in ways nothing caught
// (a note's date moved on a restore; a page's panel was modal on a screen with room to dock).
// What differs between the kinds is DATA here, not code.
//
// ⚠️ DRAWN AND HIDDEN, never built. The panel ships with the page: every field, both pictures,
// the series order that only appears with a series, the scheduled line. The island shows and
// hides. That is this admin's rule and it is why the panel can be read before any JavaScript
// has run — but it matters twice over here, because the panel STANDS BESIDE THE WRITING on a
// wide screen and a field that arrives late moves the paragraph somebody is reading.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { PostStatus, SiteLang } from '@/types'
import { escapeAttr, escapeHtml } from '@/utils'
import { buttonClass, OVERLAY_LIFT } from '@/admin-shared/kit'
import { textArea, textField } from '@/web/admin/fields'
import { chipField, fieldNote, pickField, pictureField, statusPair, typedDate } from './sheet-fields'
import { plainPick } from '@/web/admin/fields-pick'
import { SITE_LANGS } from '@/locales/langs'

export type SheetKind = 'post' | 'page' | 'note'

export type PanelPiece = {
  kind: SheetKind
  slug: string
  title: string
  status: PostStatus
  /** A wall clock on the SITE's zone, as the field holds it. Empty for a page. */
  date: string
  categories: string[]
  tags: string[]
  series: string
  seriesOrder: number
  featuredImage: string
  coverImage: string
  metaTitle: string
  metaDescription: string
  excerpt: string
  sourceUrl: string
  sourceTitle: string
  quote: string
  /** '' = the site's language (ADR 0056). */
  lang: string
  translationGroup: string
  /** The group's other members, already worded: `English · Tiếng Việt`. '' when it stands alone. */
  translations: string
  /** `Scheduled for 4 March 2027, 09:30`, already worded; empty when it is not scheduled. */
  scheduledNote: string
}

export type PanelLists = { categories: string[]; tags: string[]; series: string[]; groups: string[] }

/**
 * WHAT LANGUAGE THIS IS IN, and which of the owner's pieces say the same thing (ADR 0056).
 *
 * ⚠️ NOT ON A NOTE. A note is a page of a notebook and a clip quotes its source in the source's
 * own language; there is no second note that is "the English one". The columns exist on posts
 * and pages only, and so does this pair.
 *
 * The group is a TEXT field with the groups already in use offered under it (`pickField`, the
 * same control the series name uses), not a picker over every post. Two reasons: a select of
 * six hundred options is the heaviest thing on this panel for a field almost nobody fills, and
 * a group the owner can SEE and type is a group they can fix when it is wrong. What tells them
 * it is wrong is the line under it, which lists what is currently in the group.
 */
function translationFields(t: AdminStrings, piece: PanelPiece, lists: PanelLists): string {
  if (piece.kind === 'note') return ''
  return `<div class="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">`
    + plainPick({
      k: 'lang', label: t.pieceLanguage, value: piece.lang,
      note: t.pieceLanguageHint,
      options: [['', t.pieceLanguageSame], ...SITE_LANGS.map((l) => [l.value, l.label] as [string, string])],
    })
    + pickField({
      k: 'translationGroup', label: t.translationGroup, value: piece.translationGroup,
      options: lists.groups, placeholder: t.translationGroupPlaceholder,
    })
    // Server-drawn and read-only: what is in this group right now, in the order the site
    // would print it. An empty group after typing a name is the typo saying so.
    + (piece.translations ? fieldNote(`${t.translationsIn} ${piece.translations}`) : '')
    + `</div>`
}

/** The three fields every kind has: where it lives, when it goes out, and whether it is out. */
function common(t: AdminStrings, lang: SiteLang, piece: PanelPiece): string {
  const slug = textField({
    k: 'slug', label: t.slug, value: piece.slug,
    placeholder: piece.kind === 'post' ? t.slugFromTitle : t.slugExample,
  })
  // A page has no date and no schedule: it is not in the archive and nothing waits for it.
  const date = piece.kind === 'page' ? '' : typedDate({
    k: 'date', label: t.publishDate, value: piece.date, lang, t, note: piece.scheduledNote,
  })
  return slug + date + statusPair(t, piece.status)
}

function postFields(t: AdminStrings, piece: PanelPiece, lists: PanelLists): string {
  return chipField({
    k: 'categories', label: t.categories, chosen: piece.categories, options: lists.categories,
    placeholder: t.multiPlaceholder, removeAria: t.removeAria,
  })
    + chipField({
      k: 'tags', label: t.tags, chosen: piece.tags, options: lists.tags,
      placeholder: t.multiPlaceholder, removeAria: t.removeAria, lowercase: true,
    })
    + `<div class="space-y-3">`
    + pickField({
      k: 'series', label: t.seriesField, value: piece.series, options: lists.series,
      placeholder: t.seriesPlaceholder,
    })
    // Drawn and hidden: an order with no series to order is a question about nothing, and a
    // field that appears the moment a name is typed would push the pictures down under the hand.
    + `<div data-series-order${piece.series.trim() ? '' : ' hidden'}>`
    + textField({ k: 'seriesOrder', label: t.seriesOrder, value: piece.seriesOrder, type: 'number' })
    + `</div></div>`
    + pictureField({
      k: 'featuredImage', label: t.featuredImage, hint: t.featuredImageHint,
      value: piece.featuredImage, t,
    })
    + textArea({
      k: 'excerpt', label: t.excerpt, value: piece.excerpt, rows: 3,
      attrs: `maxlength="200" placeholder="${escapeAttr(t.excerptPlaceholder)}"`,
    })
    + pictureField({
      k: 'coverImage', label: t.coverImageLabel, hint: t.coverImageHint, value: piece.coverImage, t,
    })
    + `<div class="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">`
    + fieldNote(t.seoSectionHint)
    + textField({
      k: 'metaTitle', label: t.metaTitleLabel, value: piece.metaTitle,
      placeholder: piece.title || t.titlePlaceholder, attrs: 'maxlength="70"',
    })
    + textArea({
      k: 'metaDescription', label: t.metaDescriptionLabel, value: piece.metaDescription, rows: 2,
      attrs: `maxlength="200" placeholder="${escapeAttr(t.excerptPlaceholder)}"`,
    })
    + `</div>`
}

function noteFields(t: AdminStrings, piece: PanelPiece): string {
  return `<div class="space-y-3">`
    + textField({ k: 'sourceUrl', label: t.noteSourceUrl, value: piece.sourceUrl, type: 'url', placeholder: 'https://' })
    + textField({ k: 'sourceTitle', label: t.noteSourceTitle, value: piece.sourceTitle })
    + textArea({ k: 'quote', label: t.noteQuote, value: piece.quote, rows: 4 })
    + fieldNote(t.noteSourceHint)
    + `</div>`
}

export type PanelFrame = {
  t: AdminStrings
  lang: SiteLang
  piece: PanelPiece
  lists: PanelLists
  /** History and Analytics, drawn by the caller; a post's alone, and both drawn hidden until
   *  the piece has a row to have a past or figures. */
  headerRight: string
  /** The Trash block at the foot, drawn hidden until there is a row to bin. */
  bottom: string
}

export function sheetPanel(frame: PanelFrame): string {
  const { t, lang, piece } = frame
  const fields = common(t, lang, piece)
    + (piece.kind === 'post' ? postFields(t, piece, frame.lists) : '')
    + (piece.kind === 'note' ? noteFields(t, piece) : '')
    + (piece.kind === 'page'
      ? pictureField({
        k: 'featuredImage', label: t.featuredImage, hint: t.featuredImageHint,
        value: piece.featuredImage, t,
      })
      : '')
    + translationFields(t, piece, frame.lists)

  // A click anywhere off the sheet is "not now". A DIV, because as a button it was a focusable
  // control whose accessible name was the panel's title and whose action was to dismiss it: Tab
  // landed on "Attributes" and pressing it closed the attributes. No scrim when the sheet is
  // DOCKED: the page behind it is not behind any more, it is the other half of what the writer
  // is looking at, and dimming the paragraph you opened the sheet to fix is the same mistake as
  // covering it. The island owns `hidden` on both.
  return `<div data-panel-scrim hidden aria-hidden="true" class="fixed inset-0 z-40 bg-black/20"></div>`
    + `<aside data-sheet-panel hidden tabindex="-1" role="dialog"`
    + ` aria-label="${escapeAttr(t.attributes)}"`
    + ` data-say-attributes="${escapeAttr(t.attributes)}" data-say-publishing="${escapeAttr(t.pubTitle)}"`
    + ` class="admin-sheet fixed inset-y-0 right-0 z-50 flex flex-col border-l border-neutral-200`
    + ` bg-white dark:border-neutral-800 dark:bg-neutral-900 ${escapeAttr(OVERLAY_LIFT)}">`
    + `<div class="border-b border-neutral-100 px-6 py-5 dark:border-neutral-800">`
    + `<div class="flex items-center justify-between">`
    + `<h2 data-panel-title class="text-sm font-semibold">${escapeHtml(t.attributes)}</h2>`
    + (frame.headerRight ? `<div class="flex gap-3 text-xs">${frame.headerRight}</div>` : '')
    + `</div>`
    // The publish step's sentence, drawn and hidden: it is there only while the panel is being
    // used to decide something rather than to read something.
    + `<p data-panel-intro hidden class="mt-2 text-xs text-neutral-500 dark:text-neutral-400">`
    + `${escapeHtml(t.publishReview)}</p>`
    + `</div>`
    + `<div class="scroll-fade min-h-0 flex-1 overflow-y-auto px-6 py-5 pb-8">`
    + `<div class="space-y-5">${fields}</div>`
    + (frame.bottom ? `<div data-panel-bottom>${frame.bottom}</div>` : '')
    + `</div>`
    + `<div class="flex items-center justify-end gap-2 border-t border-neutral-100 px-6 py-4 dark:border-neutral-800">`
    + `<button type="button" data-panel-shut data-say-later="${escapeAttr(t.pubLater)}"`
    + ` data-say-hide="${escapeAttr(t.hideAttributes)}" class="${escapeAttr(buttonClass('secondary'))}">`
    + `${escapeHtml(t.hideAttributes)}</button>`
    // Only while the panel is ASKING. A Publish key on a panel opened to fix a slug is a key
    // somebody presses by accident.
    + `<button type="button" data-panel-publish hidden class="${escapeAttr(buttonClass())}">`
    + `${escapeHtml(t.publish)}</button>`
    + `</div></aside>`
}
