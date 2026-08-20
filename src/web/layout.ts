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

import type { GallerySettings, SiteSettings, FeatureSettings } from '@/types'
import { fontPreloadHrefs, fontPresetCss, chromeFontCss, themesToCss } from '@/content/themes'
import { cjkLangCss } from '@/content/fonts'
import { typographyToCss, fontToCss } from '@/content/settings'
import { singleRailCss } from '@/render/rail-css'
import { fontFaceCss, MONO_TRACKING } from '@/render/font-faces'
import { penSheetsFor } from '@/web/assets'

export type Head = {
  title: string
  description?: string
  canonical?: string
  /** Absolute URL of the Open Graph image. Undefined means no card. */
  image?: string
  /** `article` for a post, `website` for everything else. */
  ogType?: 'article' | 'website'
  /** Rendered verbatim into <head>. Callers pass already-escaped markup. */
  extra?: string
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
}

/** `backToTop` -> `data-back-to-top`. The inverse of the browser's `dataset` mapping. */
const dataAttr = (key: string) => `data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`

/**
 * The site-wide gallery default, as the two variables `public.css.ts` reads.
 *
 * Emitted only when it differs from the built-in behaviour, so a site that has never opened
 * the setting adds no bytes and the `var()` fallbacks stay in charge. `--gallery-w` travels
 * with the ratio because a cropped tile has to fill its cell and an uncropped one must not
 * be stretched into it.
 */
/**
 * The pen's line gestures, when an owner turns them OFF. On is the built-in behaviour and
 * emits nothing — the same no-bytes bargain as the gallery below. The selector lists name
 * the [data-pen] forms too: the per-variant grip rules in the hashed sheet outrank a bare
 * `.prose u`, and this inline block only wins the tie because it comes later.
 */
function penGesturesCss(f: FeatureSettings): string {
  const parts = []
  if (!f.penUnderline) {
    parts.push('.prose u,.prose u[data-pen]{background-image:none;padding:0;margin:0;'
      + 'text-decoration:underline;text-decoration-thickness:.05em;text-underline-offset:.16em}')
  }
  if (!f.penRing) {
    parts.push('.prose mark[data-form=o],.prose mark[data-form=o][data-pen]'
      + '{background-image:none;padding:0;margin:0}')
  }
  return parts.join('')
}

function galleryCss(g: GallerySettings): string {
  const parts = [
    g.ratio ? `--gallery-ratio:${g.ratio.replace('x', '/')};--gallery-w:100%` : '',
    g.captions ? '' : '--gallery-cap:none',
  ].filter(Boolean)
  return parts.length ? `:root{${parts.join(';')}}` : ''
}

import { escapeAttr, escapeHtml } from '@/utils'

/**
 * The part of the sheet that depends on the OWNER'S SETTINGS, inlined into the page.
 *
 * Order is load-bearing: the fonts first, then the reading column, then the palette and
 * typography, then the owner's custom font and CSS. Each later layer is allowed to win, and
 * a fresh install with nothing configured still gets a complete sheet.
 *
 * The static half is no longer here. It is `PUBLIC_SHEET`, linked immediately before this
 * block so the cascade reads exactly as it did when the two were one string — see
 * `web/assets.ts` for why it was split.
 */
export function pageStyles(settings: SiteSettings, extra = ''): string {
  return [
    // FIRST: a family has to be declared before anything can ask for it by name.
    fontFaceCss(settings.fontPreset, settings.chromeFont),
    // The chrome face, and the reading face's fallback until a preset repoints it. Inter
    // is the universal base, exactly as in the frozen tree. --font-mono is the third and
    // last handle: code, and only code. It is a constant rather than a setting because
    // there is no code-font picker — the two mono families in CHROME_FONTS are a chrome
    // choice, which is a different question from what a fenced block is set in.
    `:root{--font-sans:'Inter', 'Inter Fallback', system-ui, -apple-system, 'Segoe UI', sans-serif;`
    + `--font-reading:var(--font-sans);`
    + `--font-mono:'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace}`,
    // The reading column, from the owner's setting. A two-rail listing narrows it by
    // overriding this later in the sheet, which is why it is a variable and not baked in.
    `:root{--shell-w:${settings.contentWidth}px}`,
    // Injected at runtime, not written by hand, because a media query cannot read a CSS
    // variable and the breakpoint is COMPUTED from the reading column: the rail only moves
    // into the gutter when there is room for it on BOTH sides, so the column stays centred.
    singleRailCss(settings.contentWidth),
    // The site default for galleries. In CSS on purpose: rendered Markdown is cached under
    // a hash of its input, so a default that changed the MARKUP would leave every body that
    // was already rendered serving the old shape until something unrelated evicted it.
    galleryCss(settings.gallery),
    // The pen toggles, on the same terms as the gallery above.
    penGesturesCss(settings.features),
    // Page-specific geometry: the listing's second rail, the feed's gutter timeline. It
    // comes BEFORE the owner's own settings, so custom CSS still has the last word.
    extra,
    fontPresetCss(settings.fontPreset),
    // Straight after the preset it overrides, and before the owner's own CSS can have the
    // last word. `:lang(zh|ja|ko)` swaps ONLY the CJK tail of the reading stack, so a Han
    // character is drawn in that language's letterforms instead of whichever CJK family the
    // machine happens to have installed first (`content/fonts.ts`). Inert on a site whose
    // language is none of the three — no selector matches, and it is ~700 bytes.
    cjkLangCss(settings.fontPreset),
    chromeFontCss(settings.chromeFont),
    // `enabledPalettes` third: a reader can only ever reach what the owner turned on, so a
    // blog with one palette ships one rather than all six (`content/themes.ts`).
    themesToCss(settings.themes, settings.themePreset, settings.enabledPalettes),
    typographyToCss(settings.typography),
    fontToCss(settings.customFont),
    // Keyed on `data-chrome-font`, which `renderDocument` puts on <html>. It has to come
    // after the chrome font is resolved and before the owner's own CSS can override it.
    MONO_TRACKING,
    settings.customCss,
  ].filter(Boolean).join('\n')
}

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
    !!settings.customFont.family, settings.chromeFont)
    .map((href) => `<link rel="preload" href="${escapeAttr(href)}" as="font" type="font/woff2" crossorigin>`)
    .join('')
  const description = head.description
    ? `<meta name="description" content="${escapeAttr(head.description)}">`
    : ''
  const canonical = head.canonical ? `<link rel="canonical" href="${escapeAttr(head.canonical)}">` : ''

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
    ? [head.stylesheet, ...penSheetsFor(body)]
        .map((href) => `<link rel="stylesheet" href="${escapeAttr(href)}">`)
        .join('')
    : ''
  const icon = settings.faviconUrl ? `<link rel="icon" href="${escapeAttr(settings.faviconUrl)}">` : ''
  // Without this link the manifest route exists and nothing ever asks for it, so the site
  // is not installable no matter what the route returns.
  const manifest = '<link rel="manifest" href="/manifest.webmanifest">'
  // Same failure as the manifest, and it went unnoticed for longer: /feed.xml answers
  // correctly and NOTHING on the site points at it, so a reader's aggregator cannot find the
  // feed and neither can anything crawling for one. Gated on the setting the route is gated
  // on, so a site with the feed switched off does not advertise a 404.
  const feed = settings.seo.rss
    ? `<link rel="alternate" type="application/rss+xml"`
      + ` title="${escapeAttr(settings.title)}" href="/feed.xml">`
    : ''

  // `data-motion` and `data-chrome-font` are both read by CSS, not by script: the motion
  // switch zeroes every duration in one rule, and the chrome font selects the tracking
  // correction for the two mono faces. Both were missed in the port, so the owner's Motion
  // toggle did nothing and a mono chrome rendered untracked.
  const motion = settings.motion.enabled ? 'on' : 'off'
  // The third switch of the same kind, and stamped here for the same reason: CSS reads it,
  // the server writes it, so the first paint is already right and no island has to run for
  // the page to look like itself. Absent rather than "off" when the owner has it off, so
  // the whole IDE ruleset is one attribute selector that simply never matches.
  const ide = settings.ideChrome ? ' data-ide-chrome="on"' : ''
  return `<!DOCTYPE html>
<html lang="${escapeAttr(settings.language)}" data-motion="${motion}" data-chrome-font="${escapeAttr(settings.chromeFont)}"${ide}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(head.title)}</title>
${description}${canonical}${icon}${manifest}${feed}${og}${sheet}${preloads}
<style>${styles}</style>
${head.extra ?? ''}
</head>
<body${bodyAttrs}>
${body}
${shell.scripts ?? ''}</body>
</html>
`
}
