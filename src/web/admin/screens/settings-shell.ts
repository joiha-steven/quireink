// The settings sheet itself: the sticky first row, the tab strip, the line under it, and the
// seven panels. What is ON each panel is `settings-<tab>.ts`; this file decides the frame.
//
// ⚠️ ALL SEVEN PANELS SHIP DRAWN and an attribute picks, which is the rule every converted
// screen follows — and here it is load-bearing rather than tidy. The Save key stores the WHOLE
// form: an owner can change the site's name on Blog, the front page's shape on Home and a
// palette on Appearance, and press Save once. Drawing one tab and navigating between them would
// make each switch a page load, and a page load with unsaved work either loses it or raises the
// browser's own generic warning. The whole form has to be in the page for the whole form to be
// saveable.
import type { AdminStrings } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { CONTROL_SM, SHEET, SHEET_TOOL, SHEET_TOP, buttonClass } from '@/admin-shared/kit'
import { NOTE_TEXT } from '@/admin-shared/scale'
import { TAB_IDS, type Tab } from '@/admin-shared/settings-tabs'
import { SETTINGS_INDEX, fold } from '@/admin-shared/settings-index'
import { OVERLAY } from '@/admin-shared/kit'
import { tabs } from '@/web/admin/kit'

export const PANEL_ID = 'settings-panel'

/** Two columns from `xl` up, and the cards inside one column stack with the same gap. */
export const GRID = 'grid items-start gap-5 xl:grid-cols-2'
export const COL = 'space-y-5 min-w-0'

export const tabLabel = (t: AdminStrings, k: Tab): string => ({
  blog: t.tabBlog, home: t.tabHome, post: t.tabPost, appearance: t.tabAppearance,
  people: t.tabPeople, server: t.tabServer, account: t.tabAccount,
}[k])

const tabHint = (t: AdminStrings, k: Tab): string => ({
  blog: t.tabBlogHint, home: t.tabHomeHint, post: t.tabPostHint,
  appearance: t.tabAppearanceHint, people: t.tabPeopleHint,
  server: t.tabServerHint, account: t.tabAccountHint,
}[k])

/**
 * The line under the tabs: what this tab is for, and the switch that quiets every OTHER
 * explanation on the screen. THIS one stays — a tab with no line under it is an unlabelled box,
 * and quieting the screen must not do that.
 *
 * One row per tab, all seven drawn, because the sentence is the tab's own. `items-baseline`, so
 * the switch sits on the hint's line rather than centred against a hint that has wrapped to two,
 * which it does on a phone in every language.
 */
function notesRow(t: AdminStrings, k: Tab, open: boolean): string {
  return `<div class="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"`
    + ` data-notes-row="${escapeAttr(k)}"${open ? '' : ' hidden'}>`
    + `<p class="${NOTE_TEXT} tab-hint min-w-0 flex-1 basis-64 max-w-2xl">${escapeHtml(tabHint(t, k))}</p>`
    + `<button type="button" data-notes-toggle class="${SHEET_TOOL} shrink-0"`
    + ` data-on="${escapeAttr(t.settingsNotesHide)}" data-off="${escapeAttr(t.settingsNotesShow)}">`
    + `${escapeHtml(t.settingsNotesShow)}</button></div>`
}

/**
 * The sheet's own first row, and it is STICKY.
 *
 * It replaced a bar fixed to the bottom of the window: that bar was reported as missing
 * entirely, and it is the kind of chrome that goes missing — it lived outside the sheet, it was
 * the one control not on the tools row, and anything that eats the bottom of the viewport takes
 * it with no trace.
 *
 * ⚠️ THE SAVE KEY IS DISABLED WITH NOTHING TO SAVE, and that is not tidiness: a Save that is
 * always pressable answers "did I change anything?" with a shrug, and pressing it wrote the same
 * record back and printed a success toast for work nobody did. The count is what makes it worth
 * pressing — "Save settings" says only that saving exists.
 */
function topRow(t: AdminStrings, open: Tab): string {
  // A REAL TABLIST, which this strip was in React and which the arrows and the single keyboard
  // stop depend on: seven tabs, one stop, and Tab reaching the paper rather than walking the
  // strip to get there.
  const strip = tabs({
    items: TAB_IDS.map((k) => ({ key: k, label: tabLabel(t, k) })),
    value: open,
    tablist: true,
    panelId: PANEL_ID,
    attrs: 'data-settings-tabs',
  })
  return `<div class="sticky top-0 z-20 rounded-t-[10px] bg-white/95 backdrop-blur-xl dark:bg-neutral-900/95">`
    + `<div class="${SHEET_TOP}">${strip}`
    // The save, its receipt and the way past the tabs travel as ONE group, and the group is what
    // takes the free space rather than a spacer between the parts: as three loose items on a
    // wrapping row, 375px broke them into three lines with the key alone at the right edge.
    + `<div class="flex min-w-0 flex-1 items-center justify-end gap-3">`
    // The receipt says WHEN, not "saved!": a screen open all afternoon and one saved thirty
    // seconds ago read identically otherwise. It clears the moment the form is dirty again.
    + `<span class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400" data-settings-said></span>`
    + `<button type="button" data-settings-save class="${buttonClass('primary', 'sm')}" disabled>`
    + `${escapeHtml(t.saveSettings)}</button>`
    + search(t)
    + `</div></div></div>`
}

/**
 * THE WAY PAST THE TABS (ADR 0011). Type three letters and go to the setting, wherever it lives.
 *
 * The list of what it can find is built by the island out of the page itself — every `data-k` on
 * the screen is a setting, and its label is the text beside it. A hand-kept index was the
 * alternative and it is the one that goes stale.
 */
function search(t: AdminStrings): string {
  // EVERY ROW, drawn once and hidden. The React face matched in the browser against a
  // dictionary it had loaded anyway; the server has the dictionary and the island does not, so
  // the list ships whole and narrowing is `hidden` — 113 rows at about 80 bytes, against
  // shipping eleven locales to a control most people never open.
  //
  // `data-find` carries the label AND the note, accent-folded, because people describe a
  // setting rather than name it. `fold` is the same folding the log and the trash search use.
  const rows = SETTINGS_INDEX.map((r) => {
    const label = String(t[r.label] ?? '')
    const note = r.note ? String(t[r.note] ?? '') : ''
    return `<li role="option" aria-selected="false" data-found="${escapeAttr(r.tab)}"`
      + ` data-label="${escapeAttr(label)}" data-find="${escapeAttr(fold(`${label} ${note}`))}" hidden>`
      + `<button type="button" class="flex w-full items-baseline justify-between gap-4 px-4 py-2.5`
      + ` text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60">`
      + `<span class="text-sm text-neutral-800 dark:text-neutral-200">${escapeHtml(label)}</span>`
      + `<span class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">`
      + `${escapeHtml(tabLabel(t, r.tab))}</span></button></li>`
  }).join('')

  // NO BOTTOM MARGIN: this sits in a row that is `items-center`, which centres a flex item's
  // MARGIN box and not its border box — a margin here pushes the field up by half of it.
  //
  // The list hangs off the field's RIGHT edge, which is the sheet's: anchored left it would run
  // off the paper on the narrow screens where the field itself is full width. Its own width
  // rather than the field's, because on a phone the field gives up its width to the save key
  // and a 165px list broke "Font smoothing (anti-aliasing)" over three lines.
  return `<div class="relative min-w-0 flex-1 sm:w-52 sm:flex-none">`
    + `<input type="search" role="combobox" aria-expanded="false" aria-autocomplete="list"`
    + ` aria-controls="settings-found" data-settings-find`
    + ` placeholder="${escapeAttr(t.settingsSearch)}" aria-label="${escapeAttr(t.settingsSearch)}"`
    + ` class="${CONTROL_SM} w-full">`
    + `<div class="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)]`
    // `data-settings-results`, and NOT `data-settings-panel`: that name belongs to a TAB, and a
    // second element wearing it is how the assistant's delete confirm became unopenable
    // (`docs/admin-one-dom.md`, trap 5). A name belongs to the thing it is on.
    + ` overflow-hidden ${OVERLAY}" data-settings-results hidden>`
    + `<p class="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400" data-settings-none hidden>`
    + `${escapeHtml(t.settingsSearchEmpty)}</p>`
    + `<ul id="settings-found" role="listbox" data-settings-found`
    + ` class="max-h-80 divide-y divide-neutral-200 overflow-y-auto dark:divide-neutral-800">`
    + `${rows}</ul></div></div>`
}

/** One tab's paper. `admin-enter` is the frame `@starting-style` catches when a tab opens. */
export function panel(k: Tab, t: AdminStrings, body: string, open: Tab): string {
  // Its OWN id, so its tab can point at it: seven panels are seven panels, and one
  // `aria-controls` aimed at the box holding all of them would call the stack one panel.
  return `<div id="${PANEL_ID}-${escapeAttr(k)}" data-settings-panel="${escapeAttr(k)}"`
    // p-4, the same 16px the tab row above it pads by. At p-5 the panel's content began at
    // x=277 while the tab strip began at 273 and the search field ended at 1375 against the
    // grid's 1371: four pixels of disagreement down both edges of the one sheet.
    + ` class="admin-enter p-4" role="tabpanel"`
    + ` aria-label="${escapeAttr(tabLabel(t, k))}" tabindex="-1"${k === open ? '' : ' hidden'}>`
    + notesRow(t, k, true) + body + `</div>`
}

export function sheetAround(t: AdminStrings, open: Tab, panels: string): string {
  return `<div class="${SHEET}">${topRow(t, open)}`
    + `<div data-settings-panels data-explanations="off">${panels}</div></div>`
}
