// THE THINGS THAT BELONG TO NO SCREEN, drawn once into the shell.
//
// The toast, the confirm dialog, the shortcut sheet and the command palette are the last of the
// admin that was React (ADR 0054, step 6). None of them is a page: they are answers a page asks
// for — `quire:toast`, `quire:confirm` — or chords the whole admin listens for. So they live in
// the shell, once, beside the canvas rather than inside it.
//
// ⚠️ EVERY FIXED PART IS DRAWN AND HIDDEN, as everywhere else in this admin. What is BUILT is
// only what is genuinely a list that changes: the toasts in the stack, and the palette's rows.
// The live regions in particular have to be in the document BEFORE they have anything to say —
// a screen reader watches regions it already knows about, and one that arrives carrying its
// message is a new element rather than a change to an old one.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteLook, SiteSettings } from '@/types'
import { APP_VERSION } from '@/version'
import { REPO } from '@/admin-shared/help'
import { escapeAttr, escapeHtml } from '@/utils'
import { buttonClass, CONTROL, OVERLAY } from '@/admin-shared/kit'
import { chordSpellings } from '@/web/admin/rail-rows'
import { BUILTIN, SHORTCUTS, type Shortcut } from '@/admin-shared/keys'
import { SETTINGS_INDEX } from '@/admin-shared/settings-index'
import { lanes } from '@/accent'
import { SECTION, UTIL } from '@/admin-shared/scale'

/**
 * THE ANNOUNCEMENT IS NOT THE TOAST. Two standing regions, empty until there is something to
 * say; the visible toast is then only a picture of what was already announced.
 */
function toastStack(): string {
  return `<div data-say-polite role="status" aria-live="polite" class="sr-only"></div>`
    + `<div data-say-urgent role="alert" aria-live="assertive" class="sr-only"></div>`
    + `<div data-toast-stack class="fixed bottom-4 right-4 z-50 flex flex-col gap-2"></div>`
}

/**
 * THE QUESTION, in the product's own grammar rather than the browser's — the replacement for
 * twenty native `confirm()` and `prompt()` calls, which wore none of this product's grammar,
 * named nothing, and blocked the main thread while somebody thought.
 *
 * Every shape of it is drawn: the sentence under the title, the field that replaces
 * `window.prompt`, the third answer between yes and no, and BOTH yes buttons. The last is why
 * this is markup rather than a class the island writes — a question that destroys something
 * wears the red ballpoint, and picking between two shapes by swapping a class list is how an
 * island ends up holding a copy of the button kit.
 */
function confirmBox(): string {
  // A DIV, not a button. As a button the scrim is a focusable control whose accessible name is
  // the dialog's own cancel label, so Tab lands on "Cancel" twice — the same correction the
  // attributes panel's scrim carries.
  return `<div data-confirm-scrim hidden aria-hidden="true" class="fixed inset-0 z-50 bg-black/25"></div>`
    // `role=dialog` is what admin.css's `@starting-style` keys the entrance off, so this
    // arrives on the same curve as the palette and the attributes panel. Centred and capped,
    // not stretched: a question is short.
    + `<div data-confirm hidden role="dialog" aria-modal="true" tabindex="-1"`
    + ` aria-labelledby="confirm-title"`
    + ` class="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2`
    + ` -translate-y-1/2 p-5 ${escapeAttr(OVERLAY)}">`
    + `<h2 id="confirm-title" data-confirm-title class="${escapeAttr(SECTION)}"></h2>`
    + `<p data-confirm-body hidden class="mt-2 text-sm leading-[1.55] text-neutral-600`
    + ` dark:text-neutral-400"></p>`
    // Return submits, which is the one thing a native prompt did right and the thing a
    // hand-rolled dialog forgets: the hands that used the prompt type a name and press Return
    // without looking at the buttons.
    + `<form data-confirm-form hidden class="mt-4"><label class="block space-y-1.5">`
    + `<span data-confirm-label class="block text-sm font-medium text-neutral-800`
    + ` dark:text-neutral-200"></span>`
    + `<input data-confirm-input class="${escapeAttr(CONTROL)} w-full"></label></form>`
    // The safe answer on the LEFT and the committing one on the right, the order every other
    // footer in this admin uses. `flex-wrap` so three buttons in a long language stack rather
    // than overflow the sheet.
    + `<div class="mt-5 flex flex-wrap items-center justify-end gap-2">`
    + `<button type="button" data-confirm-no class="${escapeAttr(buttonClass('ghost', 'sm'))}"></button>`
    + `<button type="button" data-confirm-alt hidden`
    + ` class="${escapeAttr(buttonClass('secondary', 'sm'))}"></button>`
    + `<button type="button" data-confirm-yes`
    + ` class="${escapeAttr(buttonClass('primary', 'sm'))}"></button>`
    + `<button type="button" data-confirm-yes data-confirm-danger hidden`
    + ` class="${escapeAttr(buttonClass('danger', 'sm'))}"></button>`
    + `</div></div>`
}


/**
 * EVERY CHORD THIS ADMIN ANSWERS, on one sheet, opened by `?`.
 *
 * The table already existed — `admin-shared/keys.ts` is the single list the handlers and the
 * Help screen both read — and there was no way to SEE it without leaving what you were doing.
 * A shortcut sheet that costs a navigation is a sheet nobody opens, which is the same as not
 * having the shortcuts: a chord cannot be discovered, only told.
 *
 * ⚠️ THE SERVER PRINTS BOTH SPELLINGS and the shell's boot script picks. It has no platform to
 * ask, and `Ctrl` shown to somebody on a Mac makes the whole table useless to them — so every
 * `[data-chord]` carries its Mac form in `data-mac` and wears the other as its text, which is
 * the arrangement the rail's own search key already uses.
 *
 * The DESCRIPTIONS stay English, like the Help screen's reference material and for the same
 * reason: the chords are symbols, the sheet's furniture is translated, and what is left is a
 * line of reference prose that is canonical in one language rather than approximate in eleven.
 */
function shortcutSheet(t: AdminStrings): string {
  const row = (s: Shortcut): string =>
    `<li class="flex items-baseline gap-4 border-b border-neutral-100 py-2 last:border-0`
    + ` dark:border-neutral-800">`
    // The CHORD leads, in a fixed column: a sheet is read by running a finger down the keys,
    // not by reading the sentences.
    + `<kbd data-chord`
    + ` class="w-24 shrink-0 whitespace-nowrap font-sans text-sm font-semibold tabular-nums`
    + ` text-neutral-900 dark:text-white">${chordSpellings(s.chord)}</kbd>`
    + `<span class="min-w-0 text-sm leading-[1.5] text-neutral-600 dark:text-neutral-400">`
    + `${escapeHtml(s.does)}</span></li>`
  // Two groups, and the split is honest: the first are chords this product invented, the
  // second are the ones the editor arrives with. A reader who wants to know "what did they
  // add" can see it, and neither list has to pretend the other does not exist.
  const group = (label: string, rows: Shortcut[]): string =>
    `<section class="mt-5 first:mt-0"><h3 class="${escapeAttr(UTIL)} mb-1.5">${escapeHtml(label)}</h3>`
    + `<ul>${rows.map(row).join('')}</ul></section>`

  return `<div data-keys-scrim hidden class="fixed inset-0 z-50 flex items-start justify-center`
    + ` bg-neutral-950/30 p-4 pt-[10vh] backdrop-blur-[2px]">`
    + `<div data-shortcut-sheet role="dialog" aria-modal="true" tabindex="-1"`
    + ` aria-label="${escapeAttr(t.shortcutsTitle)}"`
    + ` class="max-h-[76vh] w-full max-w-2xl overflow-y-auto p-5 ${escapeAttr(OVERLAY)}">`
    + `<div class="mb-4 flex items-baseline justify-between gap-4">`
    + `<h2 class="${escapeAttr(SECTION)}">${escapeHtml(t.shortcutsTitle)}</h2>`
    + `<p class="text-xs text-neutral-500 dark:text-neutral-400">${escapeHtml(t.shortcutsHint)}</p>`
    + `</div>`
    + group(t.navWrite, SHORTCUTS) + group(t.tbBlock, BUILTIN)
    + `</div></div>`
}


/**
 * ⌘⇧K — THE DOOR THAT MAKES THE ARRANGEMENT STOP MATTERING.
 *
 * The rail lists ten destinations and Settings holds 107 named controls behind eight tabs, and
 * ADR 0011 already recorded what happens when the answer to "I cannot find it" is a better
 * arrangement: five tangled tabs became seven defined ones, and TWO WEEKS LATER the tabs were
 * still reported as confusing. No grouping makes a person remember which of eight boxes holds
 * a thing; what makes the grouping stop mattering is being able to type a word.
 *
 * NOTHING IS REPLACED. The rail stays, the tabs stay, the settings search stays. And it
 * NAVIGATES, IT DOES NOT SET: landing on the tab with the setting on it is honest about what
 * the index knows — a label and where it lives.
 *
 * ⚠️ EVERY ROW IS DRAWN. A hundred and twenty-odd of them, hidden, with their two search lanes
 * on the element: the island filters what is already here rather than building a list, which is
 * the rule the write column follows over forty-eight pieces. The two lanes come from
 * `src/accent.ts` and they are the Vietnamese rule in one place — an unaccented query finds
 * every accent, an accented one finds only itself. Folding both sides instead would make `lề`
 * match `lệ`, which is a different word.
 */
function palette(t: AdminStrings): string {
  // ⚠️ THE ROW IS THE OPTION, not a button inside one. This is a combobox over a listbox — the
  // keyboard never lands ON a row, it moves a cursor the input announces through
  // `aria-activedescendant` — and a focusable control inside an option is a second way in that
  // the pattern has no answer for. The React palette drew buttons and said which row was
  // current in a background colour alone, which is to say it said it to the eye only.
  const row = (r: { id: string; label: string; hint: string; search: string; group: string; href: string; run?: string }): string => {
    const lane = lanes(`${r.search} ${r.hint}`)
    return `<li data-pal-row role="option" aria-selected="false"`
      + ` id="pal-${escapeAttr(r.id.replace(/[^a-z0-9]+/gi, '-'))}"`
      + ` data-pal-id="${escapeAttr(r.id)}" data-pal-group="${escapeAttr(r.group)}"`
      + ` data-pal-lower="${escapeAttr(lane.lower)}" data-pal-fold="${escapeAttr(lane.folded)}"`
      + (r.run ? ` data-pal-run="${escapeAttr(r.run)}"` : ` data-pal-href="${escapeAttr(r.href)}"`)
      + ` hidden class="flex cursor-pointer items-baseline justify-between gap-4 px-4 py-2 text-sm">`
      + `<span class="min-w-0 truncate text-neutral-900 dark:text-white">${escapeHtml(r.label)}</span>`
      + (r.hint
        ? `<span class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">${escapeHtml(r.hint)}</span>`
        : '')
      + `</li>`
  }

  const tabName: Record<string, string> = {
    blog: t.tabBlog, home: t.tabHome, post: t.tabPost, appearance: t.tabAppearance,
    people: t.tabPeople, server: t.tabServer, account: t.tabAccount,
  }
  const actions = [
    { label: t.newPost, href: '/admin/editor' },
    { label: t.newPage, href: '/admin/page-editor' },
    { label: t.newNote, href: '/admin/note-editor' },
  ].map((a) => row({ id: `a:${a.href}`, label: a.label, hint: '', search: a.label, href: a.href, group: 'action' }))
  // The two verbs the palette carries that are not a destination.
  const verbs = [
    { id: 'v:cache', label: t.clearCache, run: 'cache' },
    { id: 'v:backup', label: t.paletteBackupNow, run: 'backup' },
  ].map((v) => row({ id: v.id, label: v.label, hint: '', search: v.label, href: '', group: 'action', run: v.run }))
  // The screens, in the rail's own order, with the labels the rail uses.
  const screens = [
    { label: t.navHome, href: '/admin' },
    { label: t.navWrite, href: '/admin/content' },
    { label: t.navMedia, href: '/admin/media' },
    { label: t.navNewsletter, href: '/admin/newsletter' },
    { label: t.navAssistant, href: '/admin/assistant' },
    { label: t.navAnalytics, href: '/admin/analytics' },
    { label: t.commentsNavTitle, href: '/admin/comments' },
    { label: t.navTrash, href: '/admin/trash' },
    { label: t.navSettings, href: '/admin/settings' },
    { label: t.navLog, href: '/admin/log' },
    { label: t.navHelp, href: '/admin/help' },
  ].map((c) => row({ id: `s:${c.href}`, label: c.label, hint: '', search: c.label, href: c.href, group: 'screen' }))
  // SHOWN: the tab, and only the tab — the note is a whole sentence and putting it in a
  // `shrink-0` right-hand column took the entire row. SEARCHED: the note as well, because
  // people describe a setting rather than name it.
  const settings = SETTINGS_INDEX.map((entry, i) => row({
    id: `g:${i}`,
    label: t[entry.label],
    hint: tabName[entry.tab] ?? entry.tab,
    search: `${t[entry.label]} ${entry.note ? t[entry.note] : ''}`,
    href: `/admin/settings?tab=${entry.tab}`,
    group: 'setting',
  }))

  // RECENT FIRST, and it is the whole reason a palette beats a menu: the thing you did an hour
  // ago is the thing you are most likely doing again. Then the verbs, then the writing, then
  // the places, then the 107 settings rows which only ever appear once something is typed.
  // `presentation`, because a heading is not an option: a screen reader counting "1 of 40"
  // must not count the five labels between the groups.
  //
  // ⚠️ THE FIRST ONE IS NOT `:first-child`. Four of the five are hidden most of the time, and a
  // CSS rule that counts POSITION counts hidden nodes too (`docs/admin-one-dom.md`, trap 4) —
  // so the tighter top padding would land on a heading nobody can see. The island marks the
  // first SHOWN one and `admin.css` keys off that.
  const heading = (group: string, label: string): string =>
    `<li data-pal-head="${escapeAttr(group)}" role="presentation" hidden`
    + ` class="${escapeAttr(UTIL)} px-4 pb-1 pt-3">${escapeHtml(label)}</li>`

  return `<div data-palette-scrim hidden class="fixed inset-0 z-50 flex items-start justify-center`
    // `items-start` with a top offset rather than centred: a centred box jumps as the list
    // grows and shrinks under the typing, and the thing that must not move is the input.
    + ` bg-neutral-950/30 p-4 pt-[12vh] backdrop-blur-[2px]">`
    + `<div data-palette role="dialog" aria-modal="true" aria-label="${escapeAttr(t.paletteTitle)}"`
    + ` class="w-full max-w-xl overflow-hidden ${escapeAttr(OVERLAY)}">`
    + `<input data-palette-box placeholder="${escapeAttr(t.palettePlaceholder)}"`
    + ` aria-label="${escapeAttr(t.palettePlaceholder)}" role="combobox" aria-expanded="true"`
    + ` aria-controls="palette-list" aria-autocomplete="list"`
    + ` class="w-full border-b border-neutral-200 bg-transparent px-4 py-3.5 text-[15px] outline-none`
    + ` placeholder:text-neutral-400 dark:border-neutral-700 dark:placeholder:text-neutral-500">`
    + `<p data-palette-none hidden class="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">`
    + `${escapeHtml(t.filterEmpty)}</p>`
    // `scroll-fade`, like every other capped scroller in this admin. Without it the list ended
    // in a hard edge halfway down its own contents.
    + `<ul data-palette-list id="palette-list" role="listbox"`
    + ` aria-label="${escapeAttr(t.paletteTitle)}"`
    + ` class="scroll-fade max-h-[50vh] overflow-y-auto py-1">`
    + heading('recent', t.paletteGroupRecent)
    + `<span data-pal-recent role="presentation"></span>`
    + heading('action', t.paletteGroupAction) + actions.join('') + verbs.join('')
    + heading('post', t.paletteGroupPost) + `<span data-pal-posts role="presentation"></span>`
    + heading('screen', t.paletteGroupScreen) + screens.join('')
    + heading('setting', t.paletteGroupSetting) + settings.join('')
    + `</ul></div></div>`
}


/** The four dialects, in the order the Settings field and the setup step both use. */
const LOOKS: SiteLook[] = ['plain', 'code', 'paper', 'notes']

/**
 * WHAT CHANGED, ONCE, AFTER AN UPGRADE — and, for a blog that predates the question, the one
 * question this release wants an answer to.
 *
 * Somebody self-hosting this updates it by pulling an image; nothing in that act tells them
 * what they got, and the CHANGELOG is a file on a machine they may never open. The update
 * check already tells a blog when a newer release exists; this is the other half.
 *
 * ONE FIELD DECIDES ALL OF IT: `settings.seenRelease`, the release this blog has already been
 * shown. It is empty on a blog whose settings row predates the field, which is exactly the
 * blog that has never been asked which dialect to wear.
 *
 *   seen === version   nothing at all, which is the common case
 *   seen is a version  the news alone — they have been asked, and asking again is nagging
 *   seen is EMPTY      the news AND the question, because this blog was never asked
 *
 * ⚠️ DRAWN OR NOT DRAWN, rather than drawn and hidden, and it is the one overlay where that is
 * right: whether it belongs on the page at all is a fact the SERVER holds and the browser
 * cannot change. Every other state here is a state the reader moves between.
 *
 * THE NOTES THEMSELVES ARE A LINK, not a copy. Release notes are written once, in English, per
 * release; carrying them in the build would mean eleven translations of prose that changes
 * every release, or eleven languages framing an English paragraph badly.
 */
function whatsNew(t: AdminStrings, settings: SiteSettings): string {
  if (settings.seenRelease === APP_VERSION) return ''
  const askLook = settings.seenRelease === ''
  const names: Record<SiteLook, string> = {
    plain: t.lookPlain, code: t.lookCode, paper: t.lookPaper, notes: t.lookNotes,
  }
  // Words and not drawings, unlike the setup step. There the four are met cold and a diagram
  // is the only way to carry them; here the blog already exists, the owner can press one and
  // go look at it, and four pictures in a panel that interrupts them is a screen rather than
  // a question.
  const looks = askLook
    ? `<section class="mt-5"><h3 class="${escapeAttr(UTIL)} mb-1.5">${escapeHtml(t.lookLabel)}</h3>`
      + `<p class="mb-3 text-sm leading-[1.55] text-neutral-600 dark:text-neutral-400">`
      + `${escapeHtml(t.lookStepLede)}</p><div class="flex flex-wrap gap-2">`
      + LOOKS.map((id) =>
        `<button type="button" data-news-look="${id}" aria-pressed="${id === settings.look}"`
        + ` class="news-look rounded-full border px-3 py-1.5 text-sm transition-colors">`
        + `${escapeHtml(names[id])}</button>`).join('')
      + `</div></section>`
    : ''

  return `<div data-news-scrim class="fixed inset-0 z-50 flex items-center justify-center`
    + ` bg-neutral-950/30 p-4 backdrop-blur-[2px]">`
    + `<div data-whats-new role="dialog" aria-modal="true" tabindex="-1"`
    + ` aria-label="${escapeAttr(t.newsTitle)}"`
    + ` class="max-h-[80vh] w-full max-w-lg overflow-y-auto p-5 ${escapeAttr(OVERLAY)}">`
    + `<h2 class="${escapeAttr(SECTION)}">${escapeHtml(t.newsTitle)}</h2>`
    + `<p class="mt-1.5 text-sm leading-[1.55] text-neutral-600 dark:text-neutral-400">`
    + `${escapeHtml(t.newsBody.replace('{v}', APP_VERSION))} `
    + `<a href="${escapeAttr(`${REPO}/releases/tag/v${APP_VERSION}`)}" target="_blank"`
    + ` rel="noopener noreferrer" class="underline decoration-neutral-300 underline-offset-2`
    + ` hover:decoration-neutral-500 dark:decoration-neutral-600">${escapeHtml(t.newsNotes)}</a></p>`
    + looks
    + `<div class="mt-6 flex justify-end">`
    + `<button type="button" data-news-done data-news-version="${escapeAttr(APP_VERSION)}"`
    + ` class="${escapeAttr(buttonClass())}">${escapeHtml(t.newsDone)}</button>`
    + `</div></div></div>`
}

export function overlaysHtml(t: AdminStrings, settings: SiteSettings): string {
  return toastStack() + confirmBox() + shortcutSheet(t) + palette(t) + whatsNew(t, settings)
}
