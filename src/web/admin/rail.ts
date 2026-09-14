// The admin's rail, as HTML the server sends (ADR 0054).
//
// It was 803 lines of React across three files, plus six more they pulled in, and it rendered
// on the browser's second pass after a bundle had been fetched, parsed and run. It is markup
// now, in the same response as the page, and the behaviour is one plain-TypeScript island
// (`src/admin/island/rail.ts`).
//
// ONE DOM, WHATEVER STATE THE RAIL IS IN, and that is the decision the rest of this file
// follows from. React drew a different tree for each of collapsed, icons-off and group-closed;
// here every row, every label and every glyph is in the markup always, and three attributes on
// `<html>` — written before the first paint by `railBootScript` — decide what is shown. The
// reasons are stacked:
//
//   · NO FLASH. The server cannot read `localStorage`, so a rail rendered in one state and
//     corrected afterwards is a rail that visibly moves on every single load. The reading
//     site's theme has worked this way since it was written; this is the same trick.
//   · A TOGGLE IS AN ATTRIBUTE. Collapsing the rail sets one character, and the browser does
//     the rest from CSS it already has. Nothing is rebuilt, so nothing can be rebuilt wrongly.
//   · THE ISLAND STAYS SMALL. It has no opinion about what a row looks like, which means it
//     cannot disagree with this file about it.
//
// WHAT IS *NOT* IN THE MARKUP: arrange mode. The grip and the two steppers on eighteen rows
// are ~14 KB of SVG for a mode somebody enters twice a year, so the island builds them when
// the mode is entered. That is the one place it draws anything.
import type { NavOrder, SiteSettings } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr } from '@/utils'
import { reconcileNavOrder } from '@/content/nav-order'
import { NARROW, RAIL_KEYS, RAIL_WIDTH, ZONES, defaultOrder, railRows, type RailRow } from '@/admin-shared/rail'
import { WORDMARK, floor, renderRow, searchKey, searchRow } from '@/web/admin/rail-rows'
import { OVERLAY } from '@/admin-shared/kit'
import { arrangeFoot, arrangeTemplate, footStrip } from '@/web/admin/rail-foot'

/**
 * The top row: the wordmark, and the search button beside it.
 *
 * Drawn by nobody when the wordmark is switched off — search then rides in the column as a row,
 * and a top row holding one small button over an empty half is worse than no top row at all.
 *
 * `data-nav-top` is the row's NAME, so a test can ask whether the row exists rather than
 * inferring it from what is inside it.
 */
function topRow(t: AdminStrings): string {
  return `<div data-nav-top class="rail-top flex min-w-0 items-center justify-between gap-1">`
    + `<span class="min-w-0 truncate">`
    + `<a href="/admin" class="rail-wordmark flex h-10 items-center leading-none">${WORDMARK}</a>`
    + `</span>${searchKey(t)}</div>`
}

/** The destinations, the group row, and the group's own list under it. */
function column(order: NavOrder, rows: Map<string, RailRow>, t: AdminStrings, path: string): string {
  const draw = (ids: readonly string[]): string =>
    ids.map((id) => { const r = rows.get(id); return r ? renderRow(r, path) : '' }).join('')
  // Indented by a RULE rather than by padding: `SIDEBAR_NAV` is the one row string every item
  // in this column shares, and a per-item `pl-6` here is how that rule stops being true.
  // Collapsed, there is nothing to indent, which is a CSS question.
  const group = `<div class="rail-group ml-3 flex flex-col gap-1 border-l border-neutral-200 pl-1 dark:border-neutral-800">${draw(order.more)}${floor('more')}</div>`
  // ALWAYS BOTH SHAPES of the search control, and CSS picks. Switching the wordmark off moves
  // search from the top row into the column, and that switch is thrown inside arrange mode
  // without a reload — so a rail that rendered only the shape it needed would have to be
  // rebuilt by the island, which is the one thing the island may not do.
  return searchRow(t) + draw(order.primary) + floor('primary') + group
}

export type RailOptions = {
  settings: SiteSettings
  /** A model is plugged in, so the assistant is somewhere the owner goes. */
  aiConfigured: boolean
  /** The path being served, for the where-you-are mark. */
  path: string
}

/**
 * The whole of the rail: the sticky column, the phone's top bar, and the drawer under it.
 *
 * Three siblings rather than one element, because they are three different things: below 1024
 * the rail is a slim bar with a hamburger, and a drawer that is a restyled `<aside>` has to
 * undo every rule the column needs.
 *
 * THE RAIL WAITS FOR 1024, NOT 768, and that is a measurement. At `md` it cost 208px, which
 * made unfolding a phone a step BACKWARDS — measured 2026-08-28 on Settings: a Galaxy Z Fold
 * upright and open is 673px and gave the form all of it; turned landscape it is 841px, the rail
 * arrives, and the form is left 633. A 768px tablet fared worst at 560. The admin is forms and
 * tables, so content width IS the product. At `lg` the sums turn: 1024 less the rail is 816,
 * and below that the rail is one tap away in the drawer.
 */
export function railHtml({ settings, aiConfigured, path }: RailOptions): string {
  const t = adminT(settings.language)
  const defaults = defaultOrder(aiConfigured)
  const order = reconcileNavOrder(settings.navOrder, defaults)
  const hidden = new Set(order.hidden)
  const rows = railRows(t)
  const avatar = settings.author.avatarUrl ?? ''

  const top = topRow(t)
  const nav = column(order, rows, t, path)
  const foot = footStrip(order.footer, rows, t, avatar)

  // `z-30`, because `sticky` makes the rail its own stacking context: without a z-index the
  // CONTENT — a later sibling — painted over the theme menu that opens from the rail's footer,
  // and the menu read as cut off behind a media card.
  const aside = `<aside id="admin-rail" class="rail-glyphs admin-case sticky top-0 z-30 h-[100dvh] shrink-0 flex-col px-3 py-5 transition-[width] duration-200 hidden lg:flex">`
    + top
    // `min-h-0` + `overflow-y-auto`: the column is the only part of a height-locked rail that
    // can grow, and in arrange mode it grows by a floor per zone and a taller row each. Without
    // this the footer controls — including the way OUT of arrange mode — are pushed past the
    // bottom of the glass on a 900px screen.
    //
    // `-mx-3 px-3` and not just the flow it had: `overflow-y-auto` makes this a scroll
    // container, which clips on BOTH axes, and the active row's marker stroke is drawn in the
    // rail's 12px gutter OUTSIDE the row. Without the padding inside the scroll box the stroke
    // was computed, painted and clipped — present in the DOM, absent from the screen.
    + `<nav class="rail-column -mx-3 flex min-h-0 flex-col gap-1 overflow-y-auto px-3">${nav}</nav>`
    + `<div class="mt-auto flex flex-col gap-1 border-t border-neutral-200 pt-4 dark:border-neutral-800">${foot}${arrangeFoot(t, hidden)}</div>`
    + `</aside>`

  const bar = `<header class="admin-bar sticky top-0 z-20 items-center justify-between border-b border-neutral-200/80 px-4 py-3 backdrop-blur dark:border-neutral-800 flex lg:hidden">`
    + (top || '<span></span>')
    + `<div class="flex items-center gap-1"><button type="button" data-rail-key="drawer"`
    + ` aria-label="${escapeAttr(t.navMenu)}" aria-expanded="false"`
    + ` class="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">`
    + `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
    + `<path class="rail-burger" d="M4 7h16M4 12h16M4 17h16"/><path class="rail-cross" d="M6 6l12 12M18 6L6 18"/>`
    + `</svg></button></div></header>`

  // A DIV for the scrim, never a button. As a button it was a focusable control called Home
  // that closed the menu: Tab left the drawer, landed on nothing visible, and Enter looked like
  // a mis-click.
  const drawer = `<div data-rail-scrim hidden aria-hidden="true" class="admin-scrim fixed inset-0 top-[65px] z-20 bg-black/20 lg:hidden"></div>`
    + `<nav data-rail-drawer hidden class="rail-glyphs admin-drawer fixed inset-x-3 top-[72px] z-30 scroll-fade max-h-[calc(100dvh-84px)] overflow-y-auto p-3 lg:hidden ${OVERLAY}">`
    + `<div class="rail-column">${nav}</div>`
    + `<span class="my-1 block h-px w-full bg-neutral-200 dark:bg-neutral-700" aria-hidden="true"></span>`
    + `<div>${footStrip(order.footer, rows, t, avatar)}</div></nav>`

  return aside + bar + drawer + arrangeTemplate(t)
}

/**
 * The script that runs before the first paint.
 *
 * Everything in it is a decision the SERVER cannot make: three `localStorage` preferences, a
 * media query, and whether the keyboard has a Command key. Each one is a visible property of
 * the rail, so reading them after the first paint means a rail that is briefly the wrong width,
 * the wrong density, or printing `Ctrl` to somebody on a Mac.
 *
 * INLINE AND SYNCHRONOUS, in the head, for that reason alone — the one shape of script this
 * codebase allows there (`docs/performance.md`), and the same shape the reading site's theme
 * has used since it was written.
 *
 * It writes the attributes and STOPS. Every click after this is the island's, which arrives
 * with the rest of the page; a rail that could only be collapsed once the bundle had loaded
 * would still be correct, and this is about the frame before that.
 */
export function railBootScript(): string {
  return `(function(){try{
var h=document.documentElement,S=localStorage;
var shut=matchMedia(${JSON.stringify(NARROW)}).matches||S.getItem(${JSON.stringify(RAIL_KEYS.collapsed)})==='1';
var icons=S.getItem(${JSON.stringify(RAIL_KEYS.icons)})!=='0';
var more=S.getItem(${JSON.stringify(RAIL_KEYS.more)})==='1';
h.setAttribute('data-rail-collapsed',shut?'1':'0');
h.setAttribute('data-rail-icons',icons?'1':'0');
h.setAttribute('data-rail-more',more?'1':'0');
h.style.setProperty('--admin-nav-w',shut?${JSON.stringify(RAIL_WIDTH.shut)}:${JSON.stringify(RAIL_WIDTH.open)});
if(/mac|iphone|ipad/i.test(navigator.platform||'')){h.setAttribute('data-mac','1');
var c=document.currentScript;addEventListener('DOMContentLoaded',function(){
var n=document.querySelectorAll('[data-chord]');for(var i=0;i<n.length;i++)n[i].textContent=n[i].getAttribute('data-mac');},{once:true});void c}
}catch(e){}})()`
}

/**
 * The zones, for the island. Exported from here rather than re-derived there so the two cannot
 * disagree about how many lists a rail has.
 */
export { ZONES }

/**
 * The two attributes the SERVER can answer, because they are a setting rather than a device
 * preference: whether the wordmark and the search key are switched on.
 *
 * They ride on `<html>` beside the three the boot script writes, so every rail state is asked
 * in one grammar — `[data-rail-*]` — and a rule in the stylesheet never has to care which of
 * the two decided it. Written here rather than in the boot script because writing them there
 * would mean sending the same fact twice and letting a script re-derive what the markup
 * already knows.
 */
export function railHtmlAttrs(settings: SiteSettings): string {
  const hidden = new Set(settings.navOrder.hidden)
  return ` data-rail-logo="${hidden.has('logo') ? '0' : '1'}" data-rail-search="${hidden.has('search') ? '0' : '1'}"`
}

/**
 * What the island needs and the markup cannot carry: the fourteen words a control swaps to, and
 * the order, for the one mode that rearranges it.
 *
 * FOURTEEN STRINGS, not eleven dictionaries. The server already knows the language — it just
 * wrote every label on the rail — so what is left is the other half of each pair ("Expand" for
 * a rail that is shut) and the four sentences arrange mode says. ADR 0054's second decision, on
 * the smallest surface it has.
 *
 * `<` is escaped because a value could otherwise close the script tag from inside a string.
 */
export function railData(settings: SiteSettings, aiConfigured: boolean): string {
  const t = adminT(settings.language)
  const defaults = defaultOrder(aiConfigured)
  const payload = {
    words: {
      navCollapse: t.navCollapse, navExpand: t.navExpand,
      navIconsHide: t.navIconsHide, navIconsShow: t.navIconsShow,
      cacheCleared: t.cacheCleared, clearCacheFailed: t.clearCacheFailed,
      navArrange: t.navArrange, navArrangeDone: t.navArrangeDone,
      navArrangeReset: t.navArrangeReset, navArrangeFailed: t.navArrangeFailed,
      navMoveUp: t.navMoveUp, navMoveDown: t.navMoveDown,
      navShowLogo: t.navShowLogo, navShowSearch: t.navShowSearch,
    },
    order: reconcileNavOrder(settings.navOrder, defaults),
    defaults,
  }
  return `<script type="application/json" id="admin-rail-data">`
    + `${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>`
}
