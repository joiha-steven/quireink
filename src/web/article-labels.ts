// Every string an article's islands show a reader, as `<body>` data — and the reader's pen's
// share of it. Split out of `article.ts` at that file's 400-line ceiling; the seam is real:
// this is the whole of the server's side of the islands' words, and nothing else.
//
// The labels ride the body because the bundles carry no locale table and no language of
// their own (`assets/js/dom.ts` › `label`). A switch that is off hands over no words, and
// an island that finds no words does nothing.

import type { InkSettings, SiteSettings } from '@/types'
import type { Dict } from '@/locales/types'
import { chromeLabels } from '@/web/chrome'
import { PEN_LINES_SHEET, PEN_MARKS_SHEET, penSheets } from '@/web/assets'
import { inkSignature, resolveInks } from '@/pen/palette'

/** The body data for a post or a page: `isPost` gates the gestures a page never gets. */
export function articleLabels(settings: SiteSettings, s: Dict, isPost: boolean, google = false): Record<string, string> {
  const post = isPost
  return {
    ...chromeLabels(settings),
    copyCode: s.copyCode,
    copiedCode: s.copiedCode,
    backToTop: s.backToTop,
    quoteCopy: s.quoteCopy,
    quoteCopied: s.quoteCopied,
    lightboxPrev: s.lightboxPrev,
    lightboxNext: s.lightboxNext,
    lightboxClose: s.lightboxClose,
    commentsHeading: s.commentsHeading,
    commentsEmpty: s.commentsEmpty,
    commentReply: s.commentReply,
    commentDeleted: s.commentDeleted,
    commentName: s.commentName,
    commentEmail: s.commentEmail,
    commentEmailNote: s.commentEmailNote,
    commentWebsite: s.commentWebsite,
    commentBody: s.commentBody,
    commentSubmit: s.commentSubmit,
    commentError: s.commentError,
    commentChecking: s.commentChecking,
    commentSignInGoogle: s.commentSignInGoogle,
    commentAs: s.commentAs,
    commentSignOut: s.commentSignOut,
    commentSignInError: s.commentSignInError,
    bookMode: s.bookMode,
    bookModePrev: s.bookModePrev,
    bookModeNext: s.bookModeNext,
    bookModeClose: s.bookModeClose,
    bookModeSmaller: s.bookModeSmaller,
    bookModeLarger: s.bookModeLarger,
    ...(post && settings.features.resume ? { resumePrompt: s.resumePrompt } : {}),
    ...(post && settings.features.readerPen ? readerPenData(settings.inks, s, google) : {}),
  }
}

/**
 * What the reader's pen needs from the server: the two pen sheets by their hashed names
 * (it links them itself, the moment a mark needs them — ADR 0027 keeps them off a page
 * with no ink), the five highlighter pigments as this site writes them, and its words.
 */
export function readerPenData(inks: InkSettings, s: Dict, google = false): Record<string, string> {
  const sheets = inkSignature(inks) ? penSheets(inks) : { marks: PEN_MARKS_SHEET, lines: PEN_LINES_SHEET }
  const light = resolveInks(inks).light
  return {
    readerPen: '1',
    penSheets: `${sheets.marks} ${sheets.lines}`,
    penInks: ['yellow', 'green', 'pink', 'blue', 'orange'].map((k) => light[k] ?? '').join(','),
    readerPenHighlight: s.readerPenHighlight,
    readerPenUnderline: s.readerPenUnderline,
    readerPenRing: s.readerPenRing,
    readerPenNote: s.readerPenNote,
    readerPenDelete: s.readerPenDelete,
    readerPenNoteHint: s.readerPenNoteHint,
    readerPenSend: s.readerPenSend,
    readerPenNotebookAsk: s.readerPenNotebookAsk,
    readerPenNotebookGo: s.readerPenNotebookGo,
    // Tier two (ADR 0047): the words of the keep panel, and whether Google is one of its doors.
    readerPenKeptHere: s.readerPenKeptHere,
    readerPenKeep: s.readerPenKeep,
    readerPenKeepGoogle: s.readerPenKeepGoogle,
    readerPenKeepCode: s.readerPenKeepCode,
    readerPenKeepHave: s.readerPenKeepHave,
    readerPenKeepUse: s.readerPenKeepUse,
    readerPenKept: s.readerPenKept,
    readerPenKeepHint: s.readerPenKeepHint,
    readerPenForgetHere: s.readerPenForgetHere,
    readerPenForgetAll: s.readerPenForgetAll,
    readerPenKeepBad: s.readerPenKeepBad,
    readerPenShowCode: s.readerPenShowCode,
    ...(google ? { readerPenGoogle: '1' } : {}),
  }
}
