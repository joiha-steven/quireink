// THE WRITING SHEET: the paper, and the chrome stuck to it.
//
// ADR 0054's last screen. What the server draws here is the PAGE — the card, the action line,
// the title, the attributes panel — and what it leaves empty are the places the editor's own
// application fills: the find strip, the button strip, and the writing surface itself. That
// division is decision 3 of the ADR: ProseMirror is an application, not a page, so its furniture
// is built in TypeScript by `admin/components/editor-*.ts` while everything around it arrives as
// finished HTML.
//
// ⚠️ THE PIECE IS IN THE MARKUP, NOT FETCHED AFTER IT. The server is holding the post while it
// writes this page; asking for it again over the wire would be a second round trip for something
// already in hand, and a blank sheet for as long as it took. The body goes in a JSON script tag
// because it is Markdown and may hold anything; `<` is escaped so no value can close the tag
// from inside a string, the same guard `spa.ts` uses for the shell's own data.
import type { AdminStrings } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { CARD } from '@/admin-shared/kit'
import { READING } from '@/admin-shared/scale'
import { sheetActions, type SheetLinks } from './sheet-actions'

export type SheetPiece = {
  /** Empty for a piece that has never been saved. */
  slug: string
  title: string
  content: string
  /** `Draft · 15/9/26 - 13:14`, already worded and formatted by the server. */
  metaLine: string
  /** When it was last saved, formatted, or empty for a piece never saved: the island's own copy
   *  of the line's last part, so it never has to guess which part that is. */
  touched: string
  /** Which of the three is open, for the title's placeholder. */
  kind: 'post' | 'page' | 'note'
}

export type SheetFrame = {
  t: AdminStrings
  piece: SheetPiece
  links: SheetLinks
  /** The public single-post column, so typing wraps exactly like the published article. */
  contentWidth: number
  /** The attributes panel, drawn by `sheet-panel.ts` and hidden until it is asked for. */
  panel: string
  /** Anything else that covers the whole sheet when it is open — the time machine — drawn and
   *  hidden inside it, so `[data-sheet] [hidden]` has the last word on all of it. */
  overlays: string
  /** Everything the island needs that is not markup: autosave interval, key sound, timezone. */
  data: Record<string, unknown>
}

/** The title on the paper, with the meta line under it (the mock's `etitle` + `emeta`). */
function title(t: AdminStrings, piece: SheetPiece): string {
  // The title is part of the WRITING SURFACE, not part of the form: it is the headline, set in
  // the reading face, inside the sheet. No `tracking-tight` — that was the sans's -0.025em on a
  // serif that publishes at -0.01em.
  return `<div class="px-4 pt-6">`
    + `<textarea data-sheet-title rows="1" placeholder="${escapeAttr(piece.kind === 'page' ? t.titlePlaceholderPage : piece.kind === 'note' ? t.titlePlaceholderNote : t.titlePlaceholder)}"`
    + ` class="${escapeAttr(READING)} write-surface min-h-12 w-full resize-none overflow-hidden`
    + ` bg-transparent text-3xl font-semibold leading-tight [field-sizing:content]`
    + ` placeholder:italic placeholder:font-normal placeholder:text-neutral-300`
    + ` dark:placeholder:text-neutral-600">${escapeHtml(piece.title)}</textarea>`
    + `<p data-sheet-meta data-touched="${escapeAttr(piece.touched)}" class="mb-2 mt-1 text-xs text-neutral-500 dark:text-neutral-400">`
    + `${escapeHtml(piece.metaLine)}</p></div>`
}

export function writingSheet(frame: SheetFrame): string {
  const { t, piece, contentWidth } = frame
  // ⚠️ `<` ESCAPED. The body is the owner's Markdown and can hold anything, including the
  // characters that end a script element.
  const json = JSON.stringify({ ...frame.data, slug: piece.slug, content: piece.content })
    .replace(/</g, '\\u003c')

  // The sheet runs at least the height of the window beside the write pane: a short draft used
  // to end the paper mid-screen while the list column kept going. The paper continues; the
  // writing just has not reached it.
  return `<div data-sheet class="${escapeAttr(CARD)} lg:min-h-[calc(100dvh-1.5rem)]">`
    + sheetActions(t, frame.links)
    // Under the action line and over the button strip, sticky with them: the find strip is part
    // of the sheet's own top stack, not a band floating over the paper. Empty until the chord
    // asks for it, and `top` is written by the island once the action line has been measured.
    + `<div data-find-slot class="sticky z-20"></div>`
    // At the very TOP of the sheet, the full width of it: on top, full-width, wrapping not
    // scrolling, grouped in the middle, and GONE in the Markdown view and in focus mode.
    //
    // ⚠️ `contents`, AND IT IS THE WHOLE OF WHETHER THE STRIP STAYS PUT. A sticky element
    // travels inside its own CONTAINING BLOCK, and a wrapper that is exactly as tall as the
    // strip gives it nowhere to travel — so it left with the first pixel of scroll and the
    // formatting keys were gone for the rest of a long post. `display: contents` removes this
    // box, which makes the sheet itself the containing block: the strip then sticks for the
    // whole height of the paper, which is what a writer means by a toolbar. Measured at 1440
    // on a 24-paragraph draft: scrolled 1,500px, the strip was at y=-1406 before and holds at
    // its offset after.
    + `<div data-toolbar-slot class="contents"></div>`
    // `pb-20` below `lg`: the action bar is FIXED to the bottom edge on a phone, so without room
    // under the paper the last line of a post sits behind Publish and cannot be scrolled clear.
    + `<div class="mx-auto w-full pb-20 lg:pb-0" style="max-width:${Number(contentWidth)}px">`
    + title(t, piece)
    + `<div data-source-slot hidden></div>`
    + `<div data-paper-slot class="typewriter-stage relative"></div>`
    // The mock's closing line: the two gestures this screen answers to, said once, quietly,
    // where a first-time writer's eye ends up.
    + `<p data-sheet-hint class="px-4 pb-4 pt-6 text-xs text-neutral-500 dark:text-neutral-400">`
    + `${escapeHtml(t.slashHint)}</p>`
    + `</div>`
    + frame.panel
    + frame.overlays
    + `<script type="application/json" data-sheet-data>${json}</script>`
    + `</div>`
}
