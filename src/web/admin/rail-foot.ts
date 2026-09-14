// The admin rail's foot, as HTML the server sends (ADR 0054).
//
// Split from `rail.ts` at the 400-line rule, and the seam is the one the React rail already
// had: `AdminSidebar` was the frame, `NavColumn` was what stood inside it and `NavFooter` was
// the strip at the bottom. Three files became three files; only the language changed.

import type { AdminStrings } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { SIDEBAR_ICON, type RailRow } from '@/admin-shared/rail'
import { buttonClass } from '@/admin-shared/kit'
import { floor, glyph, renderRow } from '@/web/admin/rail-rows'

/**
 * The foot: one strip of icon keys, and the owner's own menu at the end of it.
 *
 * It was six full-width rows carrying words — Collapse sidebar, Rearrange sidebar, Light, Hide
 * icons, Clear cache, Sign out — stacked under four destinations in a column where a full-width
 * row with a word in it is exactly what a PLACE looks like. "Light" was the clearest symptom:
 * read down the rail it is a page you can go to, and it is a theme. A control that fits in its
 * own glyph becomes one, they sit on ONE row instead of six, and the tooltip carries the word.
 *
 * TWO DID NOT BECOME GLYPHS, for the same reason: rearranging the rail and switching its icons
 * off are preferences somebody sets once and does not think about for a month, and an
 * unlabelled glyph for either would be a puzzle standing permanently on the screen. They are in
 * the owner's menu with Account and Sign out, which is where a tool's own settings are
 * looked for.
 */
export function footStrip(ids: readonly string[], rows: Map<string, RailRow>, t: AdminStrings, avatar: string): string {
  const key = (id: string): string => {
    const row = rows.get(id)
    switch (id) {
      case 'collapse':
        return `<button type="button" data-rail-key="collapse" aria-label="${escapeAttr(t.navCollapse)}"`
          + ` title="${escapeAttr(t.navCollapse)}" class="${SIDEBAR_ICON}">`
          + `<span class="rail-collapse-chevron grid place-items-center transition-transform">${glyph('prev')}</span></button>`
      case 'theme':
        return themeKey(t)
      case 'cache':
        return `<button type="button" data-rail-key="cache" title="${escapeAttr(t.clearCache)}"`
          + ` aria-label="${escapeAttr(t.clearCache)}" class="${SIDEBAR_ICON}">${glyph('cache')}</button>`
      // Both live in the menu below. A stored order that still lists them draws nothing here
      // rather than drawing them twice.
      case 'icons':
      case 'signout':
        return ''
      default:
        // A DESTINATION dragged down here becomes a key like the rest of the strip. It keeps
        // its glyph and its tooltip; what it loses is the label, which is the trade the whole
        // strip makes.
        if (!row?.href) return ''
        return `<a href="${escapeAttr(row.href)}" data-rail-id="${row.id}" title="${escapeAttr(row.label)}"`
          + ` aria-label="${escapeAttr(row.label)}" class="${SIDEBAR_ICON}">${row.icon ? glyph(row.icon) : ''}</a>`
    }
  }
  return `<div class="rail-strip flex flex-wrap items-center gap-1">`
    + ids.map(key).join('')
    + `<div class="rail-strip-end">${ownerMenu(t, avatar)}</div></div>`
    // ARRANGING, the foot is back to labelled rows — a 32px glyph is not something a hand can
    // pick up and place, and the whole mode is about picking rows up. Drawn here, hidden by
    // CSS, rather than built by the island: the island may not have an opinion about what a
    // row looks like, or there would be two and only one of them could win.
    + `<div class="rail-foot-rows flex-col gap-1">`
    + ids.map((id) => { const r = rows.get(id); return r ? renderRow(r, '') : '' }).join('')
    + floor('footer') + `</div>`
}


/**
 * The switches, and the way back out.
 *
 * The two things on the top row cannot be dragged — a wordmark dropped into a column of
 * destinations becomes one — so they are switches, and they appear only while arranging, next
 * to everything else about how the rail is laid out.
 *
 * The way OUT is at the FOOT, under everything the mode drew, and as two real keys rather than
 * two quiet rows. It used to ride under the collapse row, which is a row the owner can DRAG —
 * so on a rail whose collapse row sits mid-column, the one control that ends the mode sat in
 * the middle of the thing being rearranged, dressed like the rows around it. Done is primary
 * because it is what the screen is for; Reset is secondary and keeps its own width, since it is
 * the rarer of the two.
 */
export function arrangeFoot(t: AdminStrings, hidden: ReadonlySet<string>): string {
  const sw = (id: string, label: string, on: boolean): string =>
    `<button type="button" role="switch" data-nav-switch="${id}" aria-checked="${on}"`
    + ` class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">`
    // A tick rather than a coloured switch, because it reads the way the rail's other
    // preferences do and needs no colour to say which state it is in.
    + `<span aria-hidden="true" class="rail-tickbox grid h-4 w-4 shrink-0 place-items-center rounded border text-xs leading-none">✓</span>`
    + `<span class="truncate">${escapeHtml(label)}</span></button>`
  return `<div class="rail-arrange-foot">`
    + `<div class="mt-1 flex flex-col gap-1 border-t border-neutral-200 pt-1 dark:border-neutral-800">`
    + sw('logo', t.navShowLogo, !hidden.has('logo')) + sw('search', t.navShowSearch, !hidden.has('search'))
    + `</div>`
    + `<div class="mt-2 flex items-center gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">`
    + `<button type="button" data-nav-arrange="on" class="${buttonClass('primary', 'md', 'min-w-0 flex-1')}">${escapeHtml(t.navArrangeDone)}</button>`
    + `<button type="button" data-nav-reset class="${buttonClass('secondary')}">${escapeHtml(t.navArrangeReset)}</button>`
    + `</div></div>`
}

/**
 * The wrapper a row is dropped into while the rail is being rearranged, as a `<template>`.
 *
 * The island clones it per row. That is the whole reason it can be 300 lines and still hold no
 * opinion about how the rail looks: the grip, the two steppers, their glyphs and their
 * translated labels are all decided here, where every other row is decided.
 */
export function arrangeTemplate(t: AdminStrings): string {
  const step = (dir: 'up' | 'down', label: string, rotate: string): string =>
    `<button type="button" data-nav-step="${dir}" aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}"`
    + ` class="grid h-6 w-4 shrink-0 place-items-center rounded text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-700 dark:hover:text-neutral-200">`
    + `<span class="grid place-items-center ${rotate}">${glyph('prev')}</span></button>`
  return `<template id="rail-arrangeable"><div class="rail-arrangeable">`
    + `<span class="rail-grip" aria-hidden="true">${glyph('grip')}</span>`
    + `<div class="rail-carried"></div>`
    + step('up', t.navMoveUp, 'rotate-90') + step('down', t.navMoveDown, '-rotate-90')
    + `</div></template>`
}

/**
 * The theme key, and its menu.
 *
 * The sun and the moon are BOTH in the markup and CSS picks, because which one is right is
 * decided by the `dark` class the no-flash script has already written — the same class the
 * reading site's theme island sets. Drawing the wrong one for a frame is the exact flash that
 * script exists to prevent.
 *
 * The menu opens UPWARD and to the RIGHT. ⚠️ It was `right-0`, which anchors a 208px menu to the
 * right edge of a button sitting at the right edge of a 208px rail — so it ran from x=-12 to
 * x=196 and hung twelve pixels off the left of the WINDOW, measured. The rail is against the
 * left edge of the screen; there is nothing to the left of it to open into.
 */
export function themeKey(t: AdminStrings): string {
  const modes: [string, string][] = [
    ['light', t.themeLight], ['dark', t.themeDark], ['system', t.themeSystem], ['time', t.themeTime],
  ]
  const item = 'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
  return `<div class="relative">`
    + `<button type="button" data-rail-key="theme" aria-label="${escapeAttr(t.themeLabel)}"`
    + ` aria-expanded="false" class="${SIDEBAR_ICON}">`
    + `<span class="rail-sun">${glyph('theme')}</span><span class="rail-moon">${glyph('moon')}</span></button>`
    + `<div data-rail-menu="theme" hidden class="absolute bottom-full left-0 z-50 mb-1 w-44 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">`
    + modes.map(([mode, label]) =>
      `<button type="button" data-rail-theme="${mode}" class="${item}">${escapeHtml(label)}`
      + `<span data-rail-tick aria-hidden hidden>✓</span></button>`).join('')
    + `</div></div>`
}

/**
 * The owner's menu: Account, the way into arrange mode, the icon switch, and Sign out.
 *
 * `data-nav-owner` and `data-nav-arrange="off"` are the handles the tour drives; they are the
 * names of those controls and they survive the control moving, which is the whole reason a
 * test may not look for the word on it — every label here is translated eleven ways.
 */
export function ownerMenu(t: AdminStrings, avatar: string): string {
  const item = 'flex w-full items-center px-3 py-2 text-left text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'
  const face = avatar
    ? `<img src="${escapeAttr(avatar)}" alt="" class="h-full w-full object-cover">`
    : glyph('person')
  return `<div class="relative">`
    + `<button type="button" data-nav-owner aria-expanded="false" aria-label="${escapeAttr(t.tabAccount)}"`
    + ` title="${escapeAttr(t.tabAccount)}" class="${SIDEBAR_ICON} overflow-hidden rounded-full ring-1 ring-neutral-300 dark:ring-neutral-700">${face}</button>`
    + `<div data-rail-menu="owner" hidden class="absolute bottom-full left-0 z-50 mb-2 w-52 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">`
    // The Account tab, by the URL ADR 0041 kept working.
    + `<a href="/admin/settings?tab=account" class="${item}">${escapeHtml(t.tabAccount)}</a>`
    + `<button type="button" data-nav-arrange="off" class="${item}">${escapeHtml(t.navArrange)}</button>`
    // Never offered on the collapsed rail, where switching the glyphs off would leave a column
    // of nothing at all — hidden by CSS rather than left out, so the markup stays one shape.
    + `<button type="button" data-rail-key="icons" class="${item} rail-icons-switch">`
    + `<span class="rail-icons-on">${escapeHtml(t.navIconsHide)}</span>`
    + `<span class="rail-icons-off" hidden>${escapeHtml(t.navIconsShow)}</span></button>`
    + `<button type="button" data-rail-key="signout" class="${item} border-t border-neutral-100 dark:border-neutral-800">${escapeHtml(t.signOut)}</button>`
    + `</div></div>`
}

