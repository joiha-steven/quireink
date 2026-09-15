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
  /** `Publish` or `Schedule`, both shipped so the island can swap without a round trip. */
  publish: string
  schedule: string
  scheduled: boolean
}

/**
 * The bar. `data-*` hooks rather than classes for everything the island touches, because a class
 * is a thing a designer may reasonably rename.
 */
export function sheetActions(t: AdminStrings, links: SheetLinks): string {
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
      ? menuItem('data-sheet-preview', t.previewDraft, links.previewNow ? '' : ' hidden')
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
        + `<button type="button" data-sheet-preview title="${escapeAttr(t.previewDraft)}"`
        + ` class="${escapeAttr(buttonClass('secondary'))}">${escapeHtml(t.previewDraft)}</button></span>`
      : '')
    // Beside Preview, because the pair answers one question — how does this read? — with the
    // draft on the left and the live piece on the right.
    + `<span data-sheet-live-wrap class="hidden lg:contents"${links.liveNow ? '' : ' hidden'}>`
    + `<a data-sheet-live href="${escapeAttr(links.live.href)}" target="_blank" rel="noopener"`
    + ` title="${escapeAttr(links.live.label)}" class="${escapeAttr(buttonClass('secondary'))}">`
    + `${escapeHtml(links.live.label)}</a></span>`

    + `<button type="button" data-sheet-save${chord('save')} title="${escapeAttr(t.saveDraft)}"`
    + ` disabled class="${escapeAttr(buttonClass('secondary'))}">${escapeHtml(t.saveDraft)}</button>`
    + `<button type="button" data-sheet-publish`
    + ` data-say-publish="${escapeAttr(links.publish)}" data-say-schedule="${escapeAttr(links.schedule)}"`
    + ` class="${escapeAttr(buttonClass())}">`
    + `${escapeHtml(links.scheduled ? links.schedule : links.publish)}</button>`
    + `</div></div>`

    // The recovered-work line, on a STRIP of its own under the controls. Folded into the control
    // row it was a `basis-full` child of the left group, so the moment it appeared the one-row
    // bar broke into three and the buttons dropped a line because a notice arrived. GREY, not
    // amber, and the verbs are not underlined: nothing here has gone wrong — a draft was found
    // and the owner may take it or leave it — and a warning colour made the editor open looking
    // like it had a problem. Restore stays the darker of the two, because it is the one that
    // rescues somebody's words.
    + `<div data-sheet-found hidden class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-t`
    + ` border-neutral-200 bg-neutral-50 px-4 py-1.5 text-xs text-neutral-700 dark:border-neutral-800`
    + ` dark:bg-neutral-900/60 dark:text-neutral-300">`
    + `<span aria-hidden="true" class="h-2 w-2 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-500"></span>`
    + `<span><span data-say-found></span> &middot; `
    + `<button type="button" data-sheet-restore class="font-medium text-neutral-900`
    + ` hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300">`
    + `${escapeHtml(t.localDraftRestore)}</button> &middot; `
    + `<button type="button" data-sheet-discard class="hover:text-neutral-900 dark:hover:text-white">`
    + `${escapeHtml(t.localDraftDiscard)}</button></span></div>`
    + `</div>`
}
