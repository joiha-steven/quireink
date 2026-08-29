// The site header and footer: the parts of the page that are the same everywhere.
//
// Both were duplicated across `article.ts` and the listing renderer, and the two copies had
// already started to differ (the listing had a tagline, the article did not). One function
// each, called from both.
//
// Every control here works WITHOUT JavaScript. The search trigger is a link to `/search`;
// the subscribe trigger is a link to the sign-up card at the foot of an article. The
// islands intercept them and open an overlay instead, which is faster but never
// load-bearing.

import type { SiteSettings } from '@/types'
import { t } from '@/i18n/i18n'
import { renderInlineMarkdown, expandFooterTokens } from '@/render/inline-md'

import { escapeAttr, escapeHtml } from '@/utils'
import { SW_PATH } from '@/web/assets'

/**
 * Inline SVG rather than an icon font: no extra request, and it inherits `currentColor`.
 * All 20px, because they are sibling controls on one row and a mixed set reads as a
 * mistake — the frozen tree kept them in step with a shared class string.
 */
const svg = (body: string, width = '1.6') =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"`
  + ` stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
  + `${body}</svg>`

const ICON = {
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', '1.7'),
  grid: svg('<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/>'
    + '<rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', '1.7'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4'
    + 'M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  menu: svg('<path d="M5 8h14M8 16h11"/>'),
  // A painter's palette: the thumb hole is what makes it read as one at 20px.
  palette: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="17" r="1.6"/>'
    + '<circle cx="8" cy="10" r="1.2"/><circle cx="16" cy="10" r="1.2"/>'),
}

export type ChromeOptions = {
  /** The sign-up form only appears when the owner has a working mail server. */
  mailConfigured: boolean
  /**
   * Put the owner's menu on the header row, for a page that renders NO rail.
   *
   * The menu's home is the top of the listing rail and it stays there. The header copy is
   * the exception, and it is the exception for exactly one reason: the composed front page
   * drops the rail entirely (ADR 0014), so without this the menu would have nowhere to go
   * on the one layout most likely to want it.
   *
   * Phrased as "this page has no rail" rather than "this page is the front page" because
   * that is the actual condition — the day another rail-less layout appears it will need the
   * menu for the same reason, and nobody will have to remember to add it here.
   */
  menuInHeader?: boolean
}

/**
 * The site name, as the owner's logo when there is one and as words when there is not.
 *
 * A plain `<img>` with width and height on it: the attributes reserve the space so the
 * header does not jump when it arrives, and `logoRenderUrl` is the display-sized WebP the
 * admin builds on save — the original is only served when there is no render (a vector or
 * an animated logo).
 */
function siteTitle(settings: SiteSettings): string {
  const src = settings.showLogo && settings.logoUrl
    ? (settings.logoRenderUrl || settings.logoUrl)
    : ''
  const darkSrc = settings.showLogo && settings.logoDarkUrl
    ? (settings.logoDarkRenderUrl || settings.logoDarkUrl)
    : ''
  const img = (url: string, cls: string, height: number, priority: boolean) =>
    `<img class="${cls}" src="${escapeAttr(url)}" alt="${escapeAttr(settings.title)}"
 width="${settings.logoWidth}"${height ? ` height="${height}"` : ''}
 style="width:${settings.logoWidth}px"${priority ? ' fetchpriority="high"' : ''} decoding="async">`
  // BOTH marks are emitted and CSS picks one. The page cache is keyed by URL alone
  // (Invariant 1), so a server-side branch on the reader's theme would cache whichever
  // mode the first visitor happened to have and serve it to everyone. The dark one is
  // never `fetchpriority=high`: only one of the two is the LCP candidate on any given
  // page, and on a light page that is the light one.
  const inner = src
    ? img(src, 'logo', settings.logoRenderHeight, true)
      + (darkSrc ? img(darkSrc, 'logo logo-dark', settings.logoDarkRenderHeight, false) : '')
    : escapeHtml(settings.title)
  return `<a class="title" href="/">${inner}</a>`
}

/**
 * The short token shown INSTEAD of an icon when the IDE chrome is on.
 *
 * Both are in the markup and the sheet decides which one has a box, because the switch has
 * to leave no trace when it is off: a reader who does not want the terminal look gets the
 * icons the site has always had. Same pattern as the article's info panel, and as the
 * listing sidebar's `drawer-only`.
 *
 * The brackets come from CSS, never from here — that is the rule for every literal on the
 * site, and it is what lets the switch put them back.
 */
const token = (text: string): string => `<span class="btn-token">${escapeHtml(text)}</span>`

/**
 * The owner's menu, as words in the header's right-hand cluster, ahead of the controls.
 *
 * ONE MENU, ONE PLACE, and that place is the rail. This renders only when the page has no
 * rail to put it in, which today means the composed front page and nothing else — see
 * `ChromeOptions.menuInHeader`.
 *
 * It briefly rendered on EVERY page, on the argument that an article's rail carries its
 * table of contents so the menu had nowhere to go there. The argument was true and the
 * conclusion was wrong: it put the same links in two places on every listing page, and a
 * reader meets the menu twice on the one layout that already had it. The owner called it,
 * and the trade is deliberate — a desktop reader on an ARTICLE now has no menu until they
 * scroll back to a listing or drop below the drawer breakpoint.
 *
 * Desktop only either way. Below the breakpoint the header row is the title and up to five
 * controls already, and words do not fit beside them; the drawer keeps serving that width.
 */
function siteMenu(settings: SiteSettings, label: string): string {
  if (settings.menu.length === 0) return ''
  const links = settings.menu.map((item) => {
    // Same rule the rail applies: an external link opens in a new tab, and `noopener`
    // because `target=_blank` otherwise hands the opened page a handle on this one.
    const external = /^https?:\/\//.test(item.href)
    const rel = external ? ' target="_blank" rel="noopener"' : ''
    return `<a href="${escapeAttr(item.href || '/')}"${rel}>${escapeHtml(item.label)}</a>`
  }).join('')
  return `<nav class="site-menu t-small" aria-label="${escapeAttr(label)}">${links}</nav>`
}

export function siteHeader(settings: SiteSettings, opts: ChromeOptions): string {
  const s = t(settings.language)
  const actions: string[] = []

  if (settings.features.search) {
    // A LINK, not a button. Without JavaScript it goes to the search page, which renders
    // the same results server-side. The island turns it into an overlay.
    actions.push(`<a class="icon-btn" href="/search" data-search-open
 aria-label="${escapeAttr(s.search)}" title="${escapeAttr(s.search)}">${ICON.search}${token(s.shortSearch)}</a>`)
  }
  // The sun is what the server can honestly draw: the reader's mode lives in their own
  // storage, and the page cache is keyed by URL alone (Invariant 1), so a server-rendered
  // moon would be wrong for everyone who did not choose dark. The island swaps it on load.
  // `aria-haspopup` and the initial `aria-expanded` are STATIC, so they are markup rather
  // than two `setAttribute` calls in `core.js`. The reader's JS budget is 8,800 bytes and the
  // accessibility pass that added them put it 59 over; a fact that never changes does not
  // belong in a bundle that is defended byte by byte.
  actions.push(`<button type="button" class="icon-btn" data-theme-toggle
 aria-label="${escapeAttr(s.theme)}" title="${escapeAttr(s.theme)}"
 aria-haspopup="true" aria-expanded="false">${ICON.sun}${token(s.shortTheme)}</button>`)
  // Only above two enabled, which is the same condition `themesToCss` uses to emit the
  // per-palette rules at all: below it there is one palette and nothing to switch between.
  //
  // The ids and their translated names ride on the button as `id:Name|id:Name` so the island
  // carries no locale table and no list of palettes. The owner's default is named separately
  // because `enabledPalettes` keeps the picker's display order, in which the default is not
  // necessarily first. Both are the SAME for every reader, so they are safe in a cached page —
  // unlike the reader's own choice, which is why that one lives in `localStorage`.
  if (settings.enabledPalettes.length > 1) {
    const options = settings.enabledPalettes
      .map((id) => `${id}:${s.paletteNames[id] ?? id}`).join('|')
    actions.push(`<button type="button" class="icon-btn" data-palettes="${escapeAttr(options)}"
 data-palette-default="${escapeAttr(settings.themePreset)}"
 aria-label="${escapeAttr(s.palette)}" title="${escapeAttr(s.palette)}"
 aria-haspopup="true" aria-expanded="false">${ICON.palette}${token(s.shortPalette)}</button>`)
  }
  if (settings.features.gridView) {
    // A BUTTON, not a link: there is no server-side URL for "the same list as a grid", and
    // inventing one would be a second URL for the same content. It hides itself on a page
    // that has no list.
    actions.push(`<button type="button" class="icon-btn" data-grid-toggle
 aria-pressed="false" aria-label="${escapeAttr(s.gridView)}">${ICON.grid}${token(s.shortGrid)}</button>`)
  }
  if (opts.mailConfigured) {
    // Points at the sign-up card at the foot of an article, so it does something on a
    // page with no script. The island opens it as an overlay instead.
    actions.push(`<a class="icon-btn" href="#subscribe" data-subscribe-open
 aria-label="${escapeAttr(s.nlHeading)}" title="${escapeAttr(s.nlHeading)}">${ICON.mail}${token(s.shortMail)}</a>`)
  }
  // Opens the sidebar drawer, and stays the rightmost control. Above the rail breakpoint
  // the injected geometry hides it, because the sidebar is then the gutter rail; on a page
  // that rendered no rail the island hides it, because it would open nothing.
  actions.push(`<button type="button" class="icon-btn rail-toggle" data-rail-toggle
 aria-expanded="false" aria-label="${escapeAttr(s.menu)}">${ICON.menu}${token(s.shortMenu)}</button>`)

  // `.site-actions` is a DIV and not a <nav>. Every control in it — search, theme, palette,
  // grid, subscribe, the rail toggle — already carries its own `aria-label`, and none of them
  // is a link to somewhere else in the site; two are anchors and one of those points at a
  // card further down THIS page. As a <nav> it announced a navigation landmark and then
  // offered six buttons, so a screen-reader user navigating by landmark was sent to a
  // toolbar. The class carries all the styling, so nothing visual moved.

  // FIRST in the tab order on every public page, which is the whole point of it: without it
  // a keyboard reader tabs through four header controls, the entire contents rail and the
  // info panel before reaching the article. It lives here rather than in the two page shells
  // because this is the first thing both of them render, and the sign-in page (which has one
  // field and nothing to skip) does not call this function at all.
  return `<header class="site">
<a class="skip-link" href="#content">${escapeHtml(s.skipToContent)}</a>
<div class="site-bar">${siteTitle(settings)}${opts.menuInHeader ? siteMenu(settings, s.menu) : ''}<div class="site-actions">${actions.join('')}</div></div>${
    settings.showDescription && settings.description
      ? `<p class="tagline">${escapeHtml(settings.description)}</p>` : ''
  }</header>`
}

/** The footer: the owner's own line, centred, and nothing else. */
export function siteFooter(settings: SiteSettings, opts: ChromeOptions): string {
  // Owner text, centred, and nothing else. The sign-up form used to live here so the
  // header's mail link always had an anchor to land on; the frozen tree puts that form at
  // the end of an ARTICLE, and a form in the footer of every listing is a different site.
  void opts
  // Limited inline markdown with {year} and {title} tokens, exactly as the frozen tree
  // rendered it. `renderInlineMarkdown` is the sanitiser, so this is not raw owner HTML.
  const footerText = settings.footer
    ? `<p class="footer-text">${renderInlineMarkdown(expandFooterTokens(settings.footer, settings.title))}</p>`
    : ''
  return `<footer class="site">${footerText}</footer>`
}

/**
 * The newsletter sign-up card, at the end of an article.
 *
 * A real form with a method and an action: `/api/subscribe` answers a form post with a
 * page, so it works with JavaScript off. The island upgrades it to an inline status.
 *
 * The last two inputs are the bot traps `handleSubscribe` reads. `website` is a honeypot:
 * parked off-screen, unlabelled, skipped by tab order and screen readers — the only thing
 * that fills it is a script filling every field. `ts` is when this form was rendered; a
 * cached copy makes it stale, which only ever lets a submission PASS the fill-time check.
 * Explained HERE and not in a markup comment, because a comment in the served HTML is a
 * few dozen bytes on every article and a signpost for whoever writes the next bot.
 */
export function subscribeCard(settings: SiteSettings): string {
  const s = t(settings.language)
  return `<section class="subscribe-card" id="subscribe">
<h2>${escapeHtml(s.nlHeading)}</h2>
<form class="subscribe" method="post" action="/api/subscribe">
<input type="email" name="email" required aria-label="${escapeAttr(s.nlPlaceholder)}"
 placeholder="${escapeAttr(s.nlPlaceholder)}"><button type="submit">${escapeHtml(s.nlButton)}</button>
<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<input type="hidden" name="ts" value="${Date.now()}">
</form>
<p class="subscribe-status" role="status"></p>
</section>`
}

/**
 * The strings the chrome islands show a reader, as `data-` attributes on `<body>`.
 *
 * Shared by every public page, because the header is. The article page adds its own on top
 * of these rather than repeating them.
 */
export function chromeLabels(settings: SiteSettings): Record<string, string> {
  const s = t(settings.language)
  return {
    search: s.search,
    searchHint: s.searchHint,
    searchEmpty: s.searchEmpty,
    lightboxClose: s.lightboxClose,
    gridView: s.gridView,
    listView: s.listView,
    theme: s.theme,
    // NOT a label: the owner's default light/dark, which `assets/js/theme.ts` falls back to
    // when the reader has never chosen. It travels with the labels because it is the same
    // journey — server-rendered onto <body>, read off `dataset` — and a second mechanism
    // for one attribute would be a second thing to keep in step.
    defaultScheme: settings.defaultScheme,
    themeLight: s.themeLight,
    themeDark: s.themeDark,
    themeSystem: s.themeSystem,
    themeTime: s.themeTime,
    // The palette menu's own accessible name. Its ROWS are named on the button itself
    // (`data-palettes`), because which palettes exist is the owner's choice and not a fixed
    // list the way the four theme modes are.
    palette: s.palette,
    // Also not a label: where the service worker is, when the owner has switched it on.
    // ABSENT rather than empty when it is off, because absence is what tells the island to
    // unregister a worker an earlier visit installed — see `assets/js/offline.ts`.
    ...(settings.features.offline ? { sw: SW_PATH } : {}),
    nlSuccess: s.nlSuccess,
    nlNoMail: s.nlNoMail,
    nlInvalid: s.nlInvalid,
    nlError: s.nlError,
    // The header's sign-up overlay builds its own form, because the in-page card only
    // exists at the foot of an ARTICLE and the button is in the header of every page.
    nlHeading: s.nlHeading,
    nlPlaceholder: s.nlPlaceholder,
    nlButton: s.nlButton,
  }
}
