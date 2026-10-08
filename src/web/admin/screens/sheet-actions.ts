// THE ACTION LINE over the writing sheet: where you came from, what state the piece is in, the
// three switches that change what you LOOK at, and the pair that ends the session.
//
// ⚠️ EVERY STATE IS DRAWN AND THE ISLAND HIDES, which is this admin's rule (`docs/admin-one-dom.md`)
// and matters twice over here: the bar is the first thing on the sheet, so a control that
// arrives late pushes the paper down under the reader's hands. Preview, the live link, the word
// count and the recovered-work strip are all in the markup from the first byte.
//
// The three chords are not printed by the server. It has no platform to ask, and this bar's
// chords go in `title` rather than in visible text — so each control carries the shortcut's ID
// and the island writes the spelling for the machine it is running on.
import type { AdminStrings } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { buttonClass, OVERLAY } from '@/admin-shared/kit'
import type { MainWord } from '@/admin-shared/sheet-state'

/** Quiet text control, shared by everything on the bar that is not Preview/Publish. */
const QUIET = 'px-2 py-1.5 text-sm text-neutral-500 hover:text-neutral-900'
  + ' dark:text-neutral-400 dark:hover:text-white'

const BAR =
  // Below `lg`: fixed to the bottom edge, over the paper, with the safe area under it so an
  // iPhone's home indicator does not sit on the Publish key. Above `lg`: the sheet's own first
  // row.
  'z-20 border-neutral-200/70 bg-white/95 backdrop-blur-xl dark:border-neutral-800'
  + ' dark:bg-neutral-900/95 fixed inset-x-0 bottom-0 border-t pb-[env(safe-area-inset-bottom)]'
  + ' lg:static lg:rounded-t-[10px] lg:border-t-0 lg:border-b lg:pb-0 lg:sticky lg:top-0'

/** A control whose tooltip gains a chord once the island knows the platform. */
const chord = (id: string): string => ` data-chord-for="${escapeAttr(id)}"`

export type SheetLinks = {
  /**
   * The published address, which the three editors do not share: a post sits at `/{slug}` and
   * a note under `/notes/`. Drawn always and hidden until the piece is live — it used to live
   * ONLY in the attributes sheet, which meant reading your own published post took opening a
   * panel first.
   */
  live: { href: string; label: string }
  /** Whether that link starts visible. The island takes it from there. */
  liveNow: boolean
  /** Preview is a post's alone: the other two kinds have no preview route. */
  canPreview: boolean
  previewNow: boolean
  /** `Publish`, `Schedule` and `Update`, all shipped so the island can swap without a round trip. */
  publish: string
  schedule: string
  update: string
  /** Which of the three the main key says first (`sheet-state.ts`). */
  main: MainWord
  /** Whether it can be pressed before anything changes: a live piece has nothing to update yet. */
  mainReady: boolean
  /** Whether the server holds the piece as published: Save says "Save" rather than "Save draft". */
  published: boolean
}

/**
 * The bar. `data-*` hooks rather than classes for everything the island touches, because a class
 * is a thing a designer may reasonably rename.
 */
export function sheetActions(t: AdminStrings, links: SheetLinks): string {
  // On a live piece the preview shows the unsaved edit, and "Preview draft" called it a draft.
  const previewWord = links.published ? t.previewChanges : t.previewDraft
  const saveWord = links.published ? t.save : t.saveDraft
  const quiet = escapeAttr(QUIET)
  const menuItem = (attr: string, label: string, extra = ''): string =>
    `<button type="button" ${attr} class="${quiet} text-left"${extra}>${escapeHtml(label)}</button>`

  return `<div data-sheet-actions class="${escapeAttr(BAR)}">`
    + `<div class="flex flex-nowrap items-center justify-between gap-3 px-4 py-2.5 lg:flex-wrap">`
    + `<div class="flex min-w-0 flex-nowrap items-center gap-x-2 gap-y-1 lg:flex-wrap">`
    + `<a href="/admin/content" class="${quiet} shrink-0">&larr; ${escapeHtml(t.navWrite)}</a>`
    + `<span class="hidden h-4 w-px bg-neutral-200 sm:block dark:bg-neutral-800"></span>`
    // The mock's saved line: state, size, time to read. One string of small print. The dot
    // before it is the pen's edge, the small light that means "work in progress"; it is hidden
    // with the status, because a line that begins with a separator reads as a missing word.
    + `<span class="text-xs text-neutral-500 dark:text-neutral-400">`
    + `<span data-say-dot hidden aria-hidden="true"`
    + ` class="mr-1.5 inline-block h-[5px] w-[5px] rounded-full bg-[var(--pen-edge)] align-middle"></span>`
    + `<span data-say-status></span>`
    // ⚠️ NO `hidden` ATTRIBUTE ON THIS ONE. The size is a SENTENCE the island writes or leaves
    // empty — an empty span has no height and says nothing — while the `hidden`/`sm:inline`
    // pair is the BREAKPOINT's answer to a different question. Shipped with the attribute as
    // well, nothing ever removed it and the word count never appeared at any width.
    + `<span data-say-size class="hidden sm:inline"></span>`
    + `</span></div>`

    // flex-wrap, and it is load-bearing rather than tidy. The BAR wraps, so this group drops
    // onto a line of its own on a narrow screen — and then sat there as one 551px row inside a
    // 390px phone, with Save draft and Publish off the right edge and the whole admin scrolling
    // sideways to reach them. Measured 2026-08-27: 584px of scroll width on a 390px viewport.
    + `<div class="flex shrink-0 flex-nowrap items-center justify-end gap-1.5 lg:flex-wrap">`
    // THE PHONE'S "⋯". Below `lg` the three controls that change what you LOOK at live behind
    // it, so the bottom row carries four objects instead of seven.
    + `<details class="relative lg:hidden"><summary class="${quiet} list-none cursor-pointer select-none"`
    + ` aria-label="${escapeAttr(t.moreActions)}">&#8943;</summary>`
    + `<div class="absolute bottom-full right-0 mb-2 flex w-44 flex-col p-1 ${escapeAttr(OVERLAY)}">`
    + menuItem('data-sheet-md', t.tbMarkdown, ' aria-pressed="false"')
    + menuItem('data-sheet-attrs', t.attributes,
      ` data-say-open="${escapeAttr(t.attributes)}" data-say-shut="${escapeAttr(t.hideAttributes)}"`)
    + menuItem('data-sheet-focus', t.edFocus, ' aria-pressed="false"')
    // Preview is a post's alone, on the phone as on the desktop: the other two kinds have no
    // preview route, and an item that answers nothing is worse than an item that is not there.
    + (links.canPreview
      ? menuItem('data-sheet-preview', previewWord, links.previewNow ? '' : ' hidden')
      : '')
    + `<a data-sheet-live href="${escapeAttr(links.live.href)}" target="_blank" rel="noopener"`
    + ` class="${quiet} text-left"${links.liveNow ? '' : ' hidden'}>${escapeHtml(links.live.label)}</a>`
    + `</div></details>`

    // Quiet, and BEFORE the session-ending pair: these three change what you look AT, not what
    // happens to the piece. SPELLED OUT in the same voice — a bold mono "MD" next to a plain
    // word read as a control from a different product.
    + `<button type="button" data-sheet-md`
    + `${chord('markdown')} title="${escapeAttr(t.tbMarkdown)}" aria-pressed="false"`
    + ` class="hidden lg:block ${quiet}">${escapeHtml(t.tbMarkdown)}</button>`
    // `data-attrs` so the tour can find this without matching a word in eleven languages.
    + `<button type="button" data-attrs data-sheet-attrs`
    + ` data-say-open="${escapeAttr(t.attributes)}" data-say-shut="${escapeAttr(t.hideAttributes)}"`
    + `${chord('attributes')} title="${escapeAttr(t.attributes)}"`
    + ` class="hidden lg:block ${quiet}">${escapeHtml(t.attributes)}</button>`
    // The third of the look-at-it group. It takes the button row and the write pane off the
    // screen and leaves the paper; the bubble bar and "/" keep every command the row held.
    + `<button type="button" data-sheet-focus${chord('focus')} title="${escapeAttr(t.edFocus)}"`
    + ` aria-pressed="false" class="hidden lg:block ${quiet}">${escapeHtml(t.edFocus)}</button>`

    // ⚠️ THE WRAPPER CARRIES `hidden`, not the button. `hidden` and `inline-flex` are both
    // display utilities, so which wins is decided by their order in the STYLESHEET and not by
    // the order in the class attribute — `hidden` on a button whose shape sets `inline-flex`
    // left it on screen at 390 and squeezed "← Write" to "← Writ".
    + (links.canPreview
      ? `<span data-sheet-preview-wrap class="hidden lg:contents"${links.previewNow ? '' : ' hidden'}>`
        + `<button type="button" data-sheet-preview title="${escapeAttr(previewWord)}"`
        + ` class="${escapeAttr(buttonClass('secondary'))}">${escapeHtml(previewWord)}</button></span>`
      : '')
    // Beside Preview, because the pair answers one question — how does this read? — with the
    // draft on the left and the live piece on the right.
    + `<span data-sheet-live-wrap class="hidden lg:contents"${links.liveNow ? '' : ' hidden'}>`
    + `<a data-sheet-live href="${escapeAttr(links.live.href)}" target="_blank" rel="noopener"`
    + ` title="${escapeAttr(links.live.label)}" class="${escapeAttr(buttonClass('secondary'))}">`
    + `${escapeHtml(links.live.label)}</a></span>`

    // "Save draft" on a draft and "Save" on a published piece, both shipped so the island can
    // swap after a first Publish. Save never changes the status (`island/sheet.ts`), so the
    // word must not promise a draft on a piece it will leave live.
    + `<button type="button" data-sheet-save${chord('save')} title="${escapeAttr(saveWord)}"`
    + ` data-say-draft="${escapeAttr(t.saveDraft)}" data-say-save="${escapeAttr(t.save)}"`
    + ` disabled class="${escapeAttr(buttonClass('secondary'))}">${escapeHtml(saveWord)}</button>`
    // "Update" on a piece already out or queued, enabled once something changed: greyed
    // "Publish" on a live post read as a key that was not available at all.
    + `<button type="button" data-sheet-publish`
    + ` data-say-publish="${escapeAttr(links.publish)}" data-say-schedule="${escapeAttr(links.schedule)}"`
    + ` data-say-update="${escapeAttr(links.update)}"`
    + `${links.mainReady ? '' : ' disabled'} class="${escapeAttr(buttonClass())}">`
    + `${escapeHtml(links[links.main])}</button>`
    + `</div></div>`

    // The recovered-work NOTICE, on a strip of its own under the controls. Folded into the
    // control row it was a `basis-full` child of the left group, so the moment it appeared the
    // one-row bar broke into three and the buttons dropped a line because a notice arrived.
    //
    // GREY, not amber: nothing here has gone wrong — a copy was found and the owner may take it
    // or leave it — and a warning colour made the editor open looking like it had a problem.
    // But it is a NOTICE, not small print: it was a 12px sentence with two 12px words in it,
    // and reopening a draft walked straight past it. Now the sentence is the bar's own size and
    // the two answers are the kit's small keys (`ButtonSize` `sm` names this strip as their
    // use): Restore the primary one, because it is the one that rescues somebody's words, and
    // Discard a ghost beside it, undoable from its toast (`island/sheet.ts`).
    + `<div data-sheet-found hidden role="status" class="flex flex-wrap items-center justify-between`
    + ` gap-x-3 gap-y-2 border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-800`
    + ` dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-200">`
    + `<span class="flex min-w-0 items-center gap-2">`
    + `<span aria-hidden="true" class="h-2 w-2 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-500"></span>`
    + `<span data-say-found></span></span>`
    + `<span class="flex shrink-0 items-center gap-1.5">`
    + `<button type="button" data-sheet-discard class="${escapeAttr(buttonClass('ghost', 'sm'))}">`
    + `${escapeHtml(t.localDraftDiscard)}</button>`
    + `<button type="button" data-sheet-restore class="${escapeAttr(buttonClass('primary', 'sm'))}">`
    + `${escapeHtml(t.localDraftRestore)}</button></span></div>`
    + `</div>`
}
