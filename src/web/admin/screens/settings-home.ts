// Settings → Home & menu: WHAT A READER SEES WHEN THEY OPEN THE FRONT DOOR.
//
// ADR 0041. It is the old Layout tab plus the listing switches that were filed under Reading —
// the sidebar's five blocks, infinite scroll, the grid view, the archive, the lead post. Those
// change what a LIST looks like and none of them appears on a post, so a tab called Reading was
// answering a question about the home page.
//
// ADR 0054: the server draws it. EVERY STATE SHIPS DRAWN and an attribute hides the ones that do
// not apply — `data-gate` while a switch is on, `data-gate-when` while a key holds a value.
//
// ⚠️ NO `space-y-*` ON A STACK WHOSE LAST CHILD CAN BE HIDDEN. Tailwind v4 writes it as
// `& > :not(:last-child)`, and `:last-child` counts a node that is `hidden` — so a switch
// followed by the block it opens would keep the gap it only earns while that block is showing
// (`docs/admin-one-dom.md`, trap 5). Every group below that is a row PLUS what the row opens
// carries no stack gap: the 12px rides on the gated block as `mt-3`, because a `display:none`
// box contributes no margin at all. A stack whose last child is always drawn keeps its `space-y`.
//
// Save-all: every key here goes through the sheet's one Save key.
import type { AdminStrings } from '@/i18n/admin-i18n'
import { frontCard } from '@/web/admin/screens/settings-home-front'
import { addPick, listField, BAND } from '@/web/admin/screens/settings-home-kit'
import type { FeatureSettings, SiteSettings } from '@/types'
import { escapeAttr, escapeHtml } from '@/utils'
import { renderInlineMarkdown } from '@/render/inline-md'
import { CONTROL, ICON_KEY, buttonClass } from '@/admin-shared/kit'
import { FIELD_W, NOTE_ALERT, NOTE_TEXT, SETTING_GAP, SETTING_LABEL } from '@/admin-shared/scale'
import { panelCard, switchRow, textField } from '@/web/admin/fields'
import { choice, plainPick } from '@/web/admin/fields-pick'
import { panelList } from '@/web/admin/fields-box'
import { gate } from '@/web/admin/fields-pic'
import { COL, GRID } from '@/web/admin/screens/settings-shell'

/** What this tab needs that is not a setting: the lists its pickers choose from. */
export type HomeTabView = {
  /** Public posts, for the lead's pinned pick and the sidebar's featured list. */
  posts: { slug: string; title: string }[]
  /** Public pages, for the one served at `/` in page mode. */
  pages: { slug: string; title: string }[]
  /** Category names, for the front page's one row per category. */
  categories: string[]
  /** The server's refusal for the list path — it can only be known after a round trip. */
  listPathError?: string
}

/** A group inside a card: one hairline above it and no box (`docs/admin-design.md`). */

/** The BARE field, for a row of them: `textField` boxes its input, and two boxes in a `flex` row
 *  do not share the line the way two inputs do. */
const FIELD = `${CONTROL} ${FIELD_W.full}`

/** A 36px square key with no face of its own: the × on a menu row, the ↑ ↓ × on a featured one.
 *  One list for both; the menu's × was this without the two `disabled:` rules, which it never
 *  uses. */

/** One chosen post in the sidebar's featured list. */
const PICKED_ROW = 'flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm'
  + ' dark:border-neutral-800'

/** A switch at the head of a band. React's `ToggleRow` always carried `switch-row p-4`, and both
 *  halves are load-bearing: `admin.css` recognises a BOOLEAN by `.switch-row` and keeps its
 *  control at the row's far end when the explanations are hidden, and a `.panel-list` row takes
 *  its own padding from the `p-4`. */
const toggle = (k: string, label: string, on: boolean, note = ''): string =>
  switchRow({ k, label, note, on })

/** The footer's four toolbar keys: a square of chrome, not a `Button`. */
const TB_KEY = 'flex h-8 min-w-8 items-center justify-center rounded-lg border border-neutral-300'
  + ' px-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700'
  + ' dark:text-neutral-200 dark:hover:bg-neutral-800'

// --- The layout & menu card -----------------------------------------------------------------

/** The header's links. A LABEL, not a placeholder: a placeholder goes the moment the row has
 *  content, so a filled menu was a column of unnamed boxes and a screen reader never had the
 *  names at all. */
function menu(t: AdminStrings, s: SiteSettings): string {
  const row = (m: { label: string; href: string }): string =>
    `<div class="flex gap-2" data-menu-row>`
    + `<input class="${FIELD}" data-menu-label value="${escapeAttr(m.label)}"`
    + ` placeholder="${escapeAttr(t.menuLabelField)}"`
    + ` aria-label="${escapeAttr(t.menuLabelField)}">`
    + `<input class="${FIELD}" data-menu-href value="${escapeAttr(m.href)}"`
    + ` placeholder="${escapeAttr(t.menuHrefField)}"`
    + ` aria-label="${escapeAttr(t.menuHrefField)}">`
    + `<button type="button" data-menu-remove aria-label="${escapeAttr(t.delete)}"`
    + ` class="${ICON_KEY}">×</button></div>`
  return `<div class="space-y-3" data-menu>`
    + `<span class="${SETTING_LABEL}">${escapeHtml(t.menuTitle)}</span>`
    + `<div class="space-y-3" data-menu-rows>${s.menu.map(row).join('')}</div>`
    + `<button type="button" data-menu-add class="${buttonClass('secondary')}">`
    + `${escapeHtml(t.menuAdd)}</button>`
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.menuHint)}</p>`
    + listField('menu', s.menu)
    + `<template data-menu-tpl>${row({ label: '', href: '' })}</template></div>`
}

/**
 * The sidebar's featured block: an ORDERED list the owner curates, rendered between categories
 * and tags. A chosen slug whose post is no longer public is dropped here rather than stored: the
 * list is the owner's order, and a post that has gone is not part of it.
 */
function featured(t: AdminStrings, s: SiteSettings, v: HomeTabView): string {
  const titleOf = (slug: string): string => v.posts.find((p) => p.slug === slug)?.title ?? slug
  const chosen = s.featured.filter((slug) => v.posts.some((p) => p.slug === slug))
  const free = v.posts.filter((p) => !chosen.includes(p.slug))
  const key = (label: string, mark: string, attr: string, off: boolean): string =>
    `<button type="button" ${attr} aria-label="${escapeAttr(label)}"`
    + ` class="${ICON_KEY}"${off ? ' disabled' : ''}>${mark}</button>`
  const row = (slug: string, i: number, last: number): string =>
    `<div class="${PICKED_ROW}" data-featured-row="${escapeAttr(slug)}">`
    + `<span class="flex-1 truncate" data-featured-title>${escapeHtml(titleOf(slug))}</span>`
    + key(t.moveUp, '↑', 'data-featured-up', i === 0)
    + key(t.moveDown, '↓', 'data-featured-down', i === last)
    + key(t.delete, '×', 'data-featured-remove', false) + `</div>`
  return `<div class="space-y-3" data-featured>`
    + `<p class="text-sm text-neutral-500 dark:text-neutral-400" data-featured-none`
    + `${chosen.length > 0 ? ' hidden' : ''}>${escapeHtml(t.featuredEmpty)}</p>`
    + `<div class="space-y-3" data-featured-rows>`
    + chosen.map((slug, i) => row(slug, i, chosen.length - 1)).join('') + `</div>`
    + gate(free.length > 0, addPick({
      label: t.featuredAdd, attrs: 'data-featured-add', taken: new Set(chosen),
      options: v.posts.map((p) => [p.slug, p.title || p.slug] as [string, string]),
    }), 'data-featured-add-box')
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.featuredHint)}</p>`
    + listField('featured', chosen)
    + `<template data-featured-tpl>${row('', 0, -1)}</template></div>`
}

function layout(t: AdminStrings, s: SiteSettings, v: HomeTabView): string {
  const home = s.home
  // The refusal ships drawn and empty. It cannot be known before a round trip, and a line that is
  // not in the page cannot be filled in by the island that hears the answer.
  const refusal = `<p class="${NOTE_ALERT} mt-1" role="alert" data-field-error="home.listPath"`
    + `${v.listPathError ? '' : ' hidden'}>${escapeHtml(v.listPathError ?? '')}</p>`
  return `<div class="${SETTING_GAP}">`
    // What `/` serves, and where the post list goes when it is no longer there. ADR 0014.
    + choice({
      k: 'home.mode', label: t.homeModeLabel, note: t.homeModeHint, value: home.mode,
      options: [['list', t.homeModeList], ['page', t.homeModePage], ['front', t.homeModeFront]],
    })
    // Both of the other modes move the post list, so both need somewhere to move it to. Only one
    // of them needs a page. Asking either question while the homepage is still the list would be
    // asking about nothing.
    //
    // ⚠️ `data-gate-not`: this row is every value BUT one, and the island knows `key=value`.
    + `<div class="space-y-4 border-l-2 border-neutral-200 pl-4 dark:border-neutral-800"`
    + ` data-gate-not="home.mode=list"${home.mode === 'list' ? ' hidden' : ''}>`
    + gate(home.mode === 'page', plainPick({
      k: 'home.page', label: t.homePageLabel, note: t.homePageHint, value: home.page,
      options: [['', t.homePageNone], ...v.pages.map((p) => [p.slug, p.title] as [string, string])],
    }), 'data-gate-when="home.mode=page"')
    // The field and its refusal in ONE box: as two children of the stack the refusal is the last
    // one, so hiding it would leave the field wearing a 16px gap under nothing.
    + `<div>`
    + textField({ k: 'home.listPath', label: t.listPathLabel, note: t.listPathHint, value: home.listPath })
    + refusal + `</div></div>`
    + textField({ k: 'contentWidth', label: t.siteWidth, note: t.siteWidthHint, type: 'number',
      value: s.contentWidth, attrs: 'min="360" max="1600"' })
    + textField({ k: 'postsPerPage', label: t.postsPerPage, note: t.postsPerPageHint,
      type: 'number', value: s.postsPerPage, attrs: 'min="1" max="100"' })
    + menu(t, s)
    // One stacked rail (classic) against two rails and a narrower column.
    + `<div class="${BAND}">` + choice({
      k: 'sidebarLayout', label: t.sidebarLayoutLabel, note: t.sidebarLayoutHint,
      value: s.sidebarLayout,
      options: [['single', t.sidebarLayoutSingle], ['two', t.sidebarLayoutTwo]],
    }) + `</div>`
    // The rail's own blocks: the featured picker, and how many "most viewed" to show.
    + `<div class="space-y-3 ${BAND}">`
    + `<span class="${SETTING_LABEL}">${escapeHtml(t.cardFeatured)}</span>`
    + featured(t, s, v) + `</div>`
    + textField({ k: 'mostViewedCount', label: t.mostViewedCount, note: t.mostViewedCountHint,
      type: 'number', value: s.mostViewedCount, attrs: 'min="0" max="10"' })
    + `</div>`
}

// --- The footer card ------------------------------------------------------------------------

/**
 * A tiny limited-markdown editor: bold / italic / underline / link, and nothing else. The preview
 * is rendered with the SAME function the site uses, which is what makes it a preview rather than
 * a second opinion — and `renderInlineMarkdown` escapes its input before it injects a tag of its
 * own, so the owner's footer cannot carry markup into this screen.
 */
function footer(t: AdminStrings, s: SiteSettings): string {
  const key = (label: string, mark: string, attrs: string, face = ''): string =>
    `<button type="button" ${attrs} aria-label="${escapeAttr(label)}"`
    + ` class="${TB_KEY}${face ? ` ${face}` : ''}">${escapeHtml(mark)}</button>`
  return `<div class="space-y-2" data-footer>`
    + `<div class="flex flex-wrap gap-1.5">`
    + key(t.tbBold, 'B', 'data-footer-wrap="**"', 'font-bold')
    + key(t.tbItalic, 'I', 'data-footer-wrap="*"', 'italic')
    + key(t.tbUnderline, 'U', 'data-footer-wrap="++"', 'underline')
    + key(t.tbLink, t.tbLink, 'data-footer-link')
    + `</div>`
    // Named by `aria-label`: the card's title is the only name it has on screen, and a card title
    // names nothing.
    + `<textarea class="${CONTROL} ${FIELD_W.full} resize-y" rows="3" spellcheck="false"`
    + ` data-k="footer" data-footer-field aria-label="${escapeAttr(t.footerContent)}">`
    + `${escapeHtml(s.footer)}</textarea>`
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.footerHint)}</p>`
    + `<div class="rounded-lg border border-dashed border-neutral-300 px-3 py-2 dark:border-neutral-700">`
    + `<p class="${NOTE_TEXT} mb-1">${escapeHtml(t.tbReview)}</p>`
    + `<div class="text-sm text-neutral-600 dark:text-neutral-300 [&_a]:underline" data-footer-preview>`
    + `${renderInlineMarkdown(s.footer, { newTab: true })}</div></div></div>`
}

// --- The listing card -----------------------------------------------------------------------

/**
 * What a reader gets on the LISTING they arrive from, and the picture beside one of its rows.
 *
 * One switch per BLOCK on the rail, together and in the order they render. The rail had seven
 * blocks and four ways to influence it, scattered: the whole rail, the series, the archive route,
 * and a count that hid Most viewed at 0 — so categories and tags could not be turned off at all,
 * and the years only by taking /archive down with them.
 *
 * The thumbnail arrives from the old Post pictures card, where it sat beside the hero because
 * they share a stored shape — a fact about storage, not about the question. NO SHAPE CONTROL:
 * a thumbnail beside the words is a square and one above the title is 3:2, and choosing that is
 * the design's job rather than a question put to the owner.
 */
function listing(t: AdminStrings, s: SiteSettings): string {
  const rows: [keyof FeatureSettings, string, string][] = [
    ['sidebar', t.featSidebar, t.featSidebarDesc],
    ['sidebarCategories', t.featSidebarCategories, t.featSidebarCategoriesDesc],
    ['sidebarSeries', t.featSidebarSeries, t.featSidebarSeriesDesc],
    ['sidebarArchive', t.featSidebarArchive, t.featSidebarArchiveDesc],
    ['sidebarTags', t.featSidebarTags, t.featSidebarTagsDesc],
    ['infiniteScroll', t.featInfiniteScroll, t.featInfiniteScrollDesc],
    ['gridView', t.featGridView, t.featGridViewDesc],
    // Listed here because the listing is where it is most visible, but it is ONE switch for both
    // screens and its description says so.
    ['scrollFade', t.featScrollFade, t.featScrollFadeDesc],
    ['archive', t.featArchive, t.featArchiveDesc],
    ['leadPost', t.featLeadPost, t.featLeadPostDesc],
  ]
  return `<div class="${SETTING_GAP}">`
    + panelList(rows.map(([key, label, note]) => toggle(`features.${key}`, label, s.features[key], note)).join(''))
    + `<div class="${SETTING_GAP}">` + choice({
      k: 'postImage.thumb', label: t.postImageThumb, note: t.postImageThumbHint,
      value: s.postImage.thumb,
      options: [['none', t.piOff], ['side', t.piThumbSide], ['top', t.piThumbTop]],
    }) + `</div></div>`
}

export function homeTab(t: AdminStrings, s: SiteSettings, view: HomeTabView): string {
  return `<div class="${GRID}"><div class="${COL}">`
    + panelCard({ title: t.cardLayout, body: layout(t, s, view) })
    + panelCard({ title: t.footerContent, body: footer(t, s) })
    + `</div><div class="${COL}">`
    // Only when the site actually serves one: twenty questions about a front page nobody is
    // showing is how a settings screen becomes something people scroll past. It ships DRAWN, so
    // the answer is one attribute away instead of a page load, and it is FIRST of the two cards
    // here — a hidden node that is not the last one costs `space-y-5` nothing.
    + gate(s.home.mode === 'front',
      panelCard({ title: t.cardFront, body: frontCard(t, s.home.front, view) }),
      'data-gate-when="home.mode=front"')
    + panelCard({ title: t.cardListing, body: listing(t, s) })
    + `</div></div>`
}
