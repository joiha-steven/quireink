// The HTML shell every public page is rendered into.
//
// The resource-loading law (docs/performance.md, carried into 04-frontend.md) is enforced
// structurally here rather than by convention:
//
//   * Critical CSS is INLINE. One stylesheet request removed from the critical path, and
//     the public sheet is small precisely because it is hand-written.
//   * Reading-font subsets are PRELOADED, chosen by language, because the font is the LCP
//     resource and the browser cannot discover it until the CSS has parsed.
//   * Scripts are opt-in per route and their sizes are a BUDGET the build enforces
//     (`scripts/build-assets.ts`), so a listing pays for the beacon and the header alone
//     and an article adds one more file. Nothing is inlined, and there is no framework.

import type { SiteSettings, SiteLang } from '@/types'
import { fontPreloadHrefs } from '@/content/themes'
import { resolveAppIcon, getDefaultTheme } from '@/content/settings'
import { penSheetsFor, lookSheet } from '@/web/assets'

// The settings half of the sheet lives in `layout-styles.ts` now, and is re-exported here for
// the same reason `utils.ts` re-exports the two clock helpers: nine call sites had this import
// and the split is about where the code lives rather than about what anybody may ask for.
export { pageStyles } from '@/web/layout-styles'
/**
 * THE ONE PLACE THE SOFTWARE NAMES ITSELF THAT AN OWNER CANNOT EDIT AWAY.
 *
 * `LICENSE-EXCEPTION.md` §2(c) requires that "wherever the software displays its own name and
 * version, that stays visible", and until 2026-08-29 there was nowhere it did. The only
 * public mention was the FOOTER, which is a setting — and §2(a) says in as many words that
 * anything set through the admin is not a change to the source. So a commercial licensee
 * could delete every trace of Quire Ink from their pages without touching a line of code and
 * still be inside the permission, which is the exact thing the permission exists to prevent.
 *
 * A `generator` meta is the standard answer (WordPress, Ghost and Hugo all emit one), costs
 * a reader nothing, shows nothing on the page, and makes the condition CHECKABLE from
 * outside instead of only stated. It is not a lock — anyone modifying the source can remove
 * it, and doing so is then a source change, which is precisely the line the licence draws.
 */
import pkg from '../../package.json' with { type: 'json' }

const VERSION = (pkg as { version: string }).version

export type Head = {
  title: string
  description?: string
  canonical?: string
  /** Absolute URL of the Open Graph image. Undefined means no card. */
  image?: string
  /** `article` for a post, `website` for everything else. */
  ogType?: 'article' | 'website'
  /**
   * `<meta name="robots">`, when a page has to say it is not for the index. A search
   * results page and the sign-in page both do: the results page mints a URL per query, so
   * without this a crawler is invited to index an unbounded set of near-duplicates of the
   * same list.
   */
  robots?: string
  /**
   * JSON-LD, as the JSON payload alone — `render/schema.ts` builds it and this wraps it in
   * the script element. Gated on `seo.autoSchema` by the caller, because the setting is
   * per-site and this file has no opinion about it.
   */
  jsonLd?: string
  /** Rendered verbatim into <head>. Callers pass already-escaped markup. */
  extra?: string
  /**
   * The language of THIS DOCUMENT, when it is not the site's (ADR 0056).
   *
   * `<html lang>` picks the hyphenation dictionary, the quote marks, the voice a screen
   * reader reads in and the CJK fallback face. The reader it is most wrong for is the one
   * listening to it.
   */
  lang?: SiteLang
  /**
   * The hashed, immutable stylesheet to link BEFORE the inline settings block. Every
   * public page passes `PUBLIC_SHEET`; the sign-in page passes nothing, because it renders
   * off its own small sheet and has no cacheable half worth a request.
   */
  stylesheet?: string
}

/** The parts of the document outside `<head>` that a route can vary. */
export type Shell = {
  /**
   * `data-*` attributes on `<body>`. Every string an island shows a reader is translated
   * on the server and handed over here, so a bundle carries no locale table and cannot
   * disagree with the page it is running on. A key of `backToTop` becomes
   * `data-back-to-top`, which the browser reads back as `dataset.backToTop`.
   */
  bodyData?: Record<string, string>
  /** Script tags, rendered last so nothing blocks the parse. */
  scripts?: string
  /**
   * The owner's own markup, verbatim, at each end of the document.
   *
   * Passed IN rather than read from `settings` here, and that is the safety property: this
   * function also renders the sign-in page and a draft preview, and neither should carry a
   * tracker. Making it an argument means a page gets the owner's code only by asking for
   * it, so the two public shells ask and the other two do not — see `types.ts`.
   */
  customHead?: string
  customBodyEnd?: string
}

/** `backToTop` -> `data-back-to-top`. The inverse of the browser's `dataset` mapping. */
const dataAttr = (key: string) => `data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`





import { escapeAttr, escapeHtml } from '@/utils'


export function renderDocument(
  settings: SiteSettings,
  head: Head,
  styles: string,
  body: string,
  shell: Shell = {},
): string {
  const bodyAttrs = Object.entries(shell.bodyData ?? {})
    .map(([k, v]) => ` ${dataAttr(k)}="${escapeAttr(v)}"`)
    .join('')
  const preloads = fontPreloadHrefs(settings.fontPreset, settings.language,
    !!settings.customFont.family, settings.chromeFont, settings.look)
    .map((href) => `<link rel="preload" href="${escapeAttr(href)}" as="font" type="font/woff2" crossorigin>`)
    .join('')
  const description = head.description
    ? `<meta name="description" content="${escapeAttr(head.description)}">`
    : ''
  const canonical = head.canonical ? `<link rel="canonical" href="${escapeAttr(head.canonical)}">` : ''
  const robots = head.robots ? `<meta name="robots" content="${escapeAttr(head.robots)}">` : ''
  // Not escaped, and it does not need to be: `schema.ts` emits JSON with every `<` replaced
  // by its unicode escape, so nothing in it can close this element. Escaping it as HTML
  // here would corrupt the JSON instead, which is the mistake this comment exists to stop.
  const jsonLd = head.jsonLd
    ? `<script type="application/ld+json">${head.jsonLd}</script>`
    : ''

  // Open Graph and Twitter. Written out rather than generated from a map: there are seven
  // of them, they are not going to become a hundred, and a loop here would be harder to
  // read than the tags themselves.
  //
  // `summary_large_image` ONLY when there is an image. With `summary_large_image` and no
  // image, X renders a bare card with the site's favicon stretched across it.
  const meta = (property: string, content: string) =>
    `<meta property="${property}" content="${escapeAttr(content)}">`
  const og = [
    meta('og:title', head.title),
    meta('og:type', head.ogType ?? 'website'),
    head.description ? meta('og:description', head.description) : '',
    head.canonical ? meta('og:url', head.canonical) : '',
    meta('og:site_name', settings.title),
    head.image ? meta('og:image', head.image) : '',
    `<meta name="twitter:card" content="${head.image ? 'summary_large_image' : 'summary'}">`,
  ].filter(Boolean).join('')
  // Before the inline block, because that block is allowed to win: it carries the palette,
  // the type scale and the owner's own CSS, all of which override the sheet.
  //
  // The pen's two sheets follow the same rule, and only board the pages that used the pen:
  // `penSheetsFor` reads the assembled body for the elements the gestures render as
  // (ADR 0027). Render-blocking like the main sheet on purpose — a deferred stylesheet
  // shows bare words before the ink lands. After site.css so the cascade reads exactly as
  // it did when the ink lived inside it, and gated on `head.stylesheet` because a page
  // that declines the public sheet (sign-in) has no prose to ink.
  const sheet = head.stylesheet
    ? [head.stylesheet, lookSheet(settings.look), ...penSheetsFor(body, settings.inks)]
        .filter(Boolean)
        .map((href) => `<link rel="stylesheet" href="${escapeAttr(href)}">`)
        .join('')
    : ''
  // `rel="icon"` stays conditional ON PURPOSE, and an audit that wants it unconditional is
  // asking for bytes that buy nothing: `/favicon.ico` is the path a browser asks for when
  // nothing tells it otherwise, and `app.ts` answers there whether or not the owner has set
  // one. Naming the conventional path in the head only repeats what the browser was going
  // to do anyway.
  //
  // `apple-touch-icon` is different and is why this line moved at all. Nothing else on the
  // page points iOS at `/app-icon.png`: the manifest does, and iOS has only read manifest
  // icons since 16.4, so on anything older "Add to Home Screen" takes a screenshot of the
  // page instead of the site's own mark. One tag, and it is the only route to that icon.
  const icon = (settings.faviconUrl ? `<link rel="icon" href="${escapeAttr(settings.faviconUrl)}">` : '')
    + `<link rel="apple-touch-icon" href="${escapeAttr(resolveAppIcon(settings))}">`
  // Without this link the manifest route exists and nothing ever asks for it, so the site
  // is not installable no matter what the route returns.
  const manifest = '<link rel="manifest" href="/manifest.webmanifest">'
  // Same failure as the manifest, and it went unnoticed for longer: /feed.xml answers
  // correctly and NOTHING on the site points at it, so a reader's aggregator cannot find the
  // feed and neither can anything crawling for one. Gated on the setting the route is gated
  // on, so a site with the feed switched off does not advertise a 404.
  // The open standards a reader's tools look for (ADR 0046): the notebook's Webmention
  // endpoint always; the IndieAuth and Micropub doors only while the switch that gates them
  // (Settings → Server & connections, the MCP switch) is on, so a site never advertises a 503.
  const standards = '<link rel="webmention" href="/webmention">' + (settings.mcp.enabled
    ? '<link rel="indieauth-metadata" href="/.well-known/oauth-authorization-server">'
      + '<link rel="authorization_endpoint" href="/api/mcp/authorize">'
      + '<link rel="token_endpoint" href="/api/mcp/token"><link rel="micropub" href="/micropub">'
    : '')
  // BOTH formats, because both are documents a reader's app may subscribe to and neither is
  // discoverable without a link element. The type attribute is the whole of how an aggregator
  // tells them apart, so the two lines differ in nothing else.
  const feed = settings.seo.rss
    ? `<link rel="alternate" type="application/rss+xml"`
      + ` title="${escapeAttr(settings.title)}" href="/feed.xml">`
      + `<link rel="alternate" type="application/feed+json"`
      + ` title="${escapeAttr(settings.title)}" href="/feed.json">`
    : ''

  // `data-motion` and `data-chrome-font` are both read by CSS, not by script: the motion
  // switch zeroes every duration in one rule, and the chrome font selects the tracking
  // correction for the two mono faces. Both were missed in the port, so the owner's Motion
  // toggle did nothing and a mono chrome rendered untracked.
  const motion = settings.motion.enabled ? 'on' : 'off'
  // The third of the same kind, and stamped here for the same reason: CSS reads it, the
  // server writes it, so the first paint is already right and no island has to run for the
  // page to look like itself. ABSENT on 'plain', so a blog wearing no dialect carries no
  // attribute, links no dialect sheet, and cannot be told from one built before looks
  // existed. Each dialect's whole ruleset hangs off this one attribute selector.
  const look = settings.look === 'plain' ? '' : ` data-look="${escapeAttr(settings.look)}"`
  // And the fourth, for the scroll fade: the cards easing in at the foot of a listing and
  // the text dimming at the edges of an article are one effect on two screens, so they are
  // one attribute. Written only when it is ON, so the whole ruleset is a selector that
  // simply never matches when it is off — nothing to override and nothing to un-hide.
  const fade = settings.features.scrollFade ? ' data-scroll-fade="on"' : ''
  /**
   * What the phone paints around the page: Android Chrome's toolbar and the strip iOS
   * Safari retracts its bars from.
   *
   * TWO of them, one per scheme, because the reader's choice lives in their own storage and
   * the page cache is keyed by URL alone (Invariant 1) — a single tag would have to pick a
   * side and would then be wrong for everyone on the other one. Without either, a blog whose
   * default is dark met the reader with a white bar over a black page. The phone book reader
   * already did this for the length of a read; this is the same answer for every other page.
   */
  const paper = getDefaultTheme(settings.themes, settings.themePreset)
  const themeColor = `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${
    escapeAttr(paper.light.bg)}">\n<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${
    escapeAttr(paper.dark.bg)}">\n`
  return `<!DOCTYPE html>
<html lang="${escapeAttr(head.lang ?? settings.language)}" data-motion="${motion}" data-chrome-font="${escapeAttr(settings.chromeFont)}"${look}${fade}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${themeColor}<meta name="generator" content="Quire Ink ${escapeAttr(VERSION)}">
<title>${escapeHtml(head.title)}</title>
${description}${canonical}${robots}${icon}${manifest}${feed}${standards}${og}${sheet}${preloads}${jsonLd}
<style>${styles}</style>
${head.extra ?? ''}${shell.customHead ?? ''}
</head>
<body${bodyAttrs}>
${body}
${shell.scripts ?? ''}${shell.customBodyEnd ?? ''}</body>
</html>
`
}
