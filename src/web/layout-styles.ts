// THE SHEET THIS PAGE'S OWN SETTINGS MAKE, inlined after the immutable one.
//
// Split out of `layout.ts` on 2026-09-19, when that file reached its 400-line ceiling. The
// seam is real rather than convenient: everything left there assembles a DOCUMENT — the head
// tags, the body attributes, the shell — and this assembles a STYLESHEET. They share nothing
// but the settings object, and the order inside this one is load-bearing in a way the other
// half never has to think about.

import type { GallerySettings, FigureSettings, SiteSettings, FeatureSettings, InkSettings, SiteLang } from '@/types'
import { fontPresetCss, chromeFontCss, themesToCss } from '@/content/themes'
import { cjkLangCss } from '@/content/fonts'
import { typographyToCss, fontToCss, shapeToCss, tableToCss } from '@/content/settings'
import { DEFAULT_RAIL_WIDTH, railHoldCss, railThemeCss, singleRailCss } from '@/render/rail-css'
import { fontFaceCss, monoTracking } from '@/render/font-faces'
import type { SiteTheme } from '@/content/themes-builtin'
import { resolveTheme } from '@/content/chosen-theme'
import { displayFontValue, drawnFonts, drawnPalettes, themeFamily, themeFontVarsCss } from '@/content/theme-choices'
import { t } from '@/i18n/i18n'
import { LISTS_PLAIN_CSS } from '@/pen/lists.css'
import { inLayer } from '@/web/css-layers'

/**
 * The site-wide gallery default, as the two variables `public.css.ts` reads. Emitted only when
 * it differs from the built-in behaviour, so a site that never opened the setting adds no bytes
 * and the `var()` fallbacks stay in charge. `--gallery-w` travels with the ratio because a
 * cropped tile has to fill its cell and an uncropped one must not be stretched into it.
 */
function galleryCss(g: GallerySettings): string {
  const parts = [
    g.ratio ? `--gallery-ratio:${g.ratio.replace('x', '/')};--gallery-w:100%` : '',
    g.captions ? '' : '--gallery-cap:none',
  ].filter(Boolean)
  return parts.length ? `:root{${parts.join(';')}}` : ''
}

/**
 * What a text selection looks like, when the owner has said. Emits NOTHING by default; the
 * sheet's own rule is the default and this only overrides it. Two fields rather than one
 * because the modes are genuinely different decisions — the value that reads as a marker on
 * paper is a flashbulb on a dark page.
 *
 * `html.dark` for the explicit case AND the media query for the reader whose SYSTEM is dark
 * before the island has run. Without the second, a customised light selection paints over a
 * dark page for one paint.
 */
function selectionCss(inks: InkSettings): string {
  const parts: string[] = []
  if (inks.selection) parts.push(`::selection{background:${inks.selection}}`)
  if (inks.selectionDark) {
    const rule = `::selection{background:${inks.selectionDark}}`
    parts.push(`html.dark ${rule}`)
    parts.push(`@media (prefers-color-scheme:dark){html:not([data-scheme]) ${rule}}`)
  }
  return parts.join('')
}

/**
 * The pen's line gestures, when an owner turns them OFF. On is the built-in behaviour and emits
 * nothing — the same no-bytes bargain. The selector lists name the `[data-pen]` forms too: the
 * per-variant grip rules in the hashed sheet outrank a bare `.prose u`, and this inline block
 * only wins the tie because it comes later.
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
  // The list markers: dots, dashes and numerals in a hand, on by default. Off gives the
  // browser's disc and decimal back, and this wins the tie with the prose sheet by order.
  if (!f.penLists) parts.push(LISTS_PLAIN_CSS)
  return parts.join('')
}

/**
 * The site-wide frame, as the four variables `figure img` reads when a picture names none.
 *
 * Points at `--fig-step-*` rather than at a length: this block is inlined AFTER the linked
 * sheet, so a length here would outrank the phone's media query and a thick default would
 * keep its desktop mat in a 350px column. See figure.css.ts.
 */
function figureCss(f: FigureSettings): string {
  if (f.frame === 'none') return '' // the default default: nothing to say, so nothing is said
  const pad = f.frame === 'thin' ? '--fig-step-thin' : f.frame === 'thick' ? '--fig-step-thick' : '--fig-step-med'
  const mat = f.ink ? 'var(--c-heading)' : 'var(--c-bg)'
  const line = f.ink ? 'var(--c-heading)' : 'color-mix(in srgb,var(--c-rule),var(--c-meta) 35%)'
  return `:root{--fig-default-pad:var(${pad});--fig-default-mat:${mat};`
    + `--fig-default-bw:1px;--fig-default-line:var(--c-rule);--fig-default-line:${line}}`
}

/**
 * A CSS string literal, safe inside a `<style>` element: quote and backslash escaped, every
 * control character and `<` written as a hex escape (so no `</style>` can be spelled).
 */
const cssString = (value: string): string =>
  `"${value.replace(/[\\"]/g, (c) => `\\${c}`).replace(/[\u0000-\u001f\u007f<]/g,
    (c) => `\\${c.charCodeAt(0).toString(16)} `)}"`

/**
 * The words a theme may print through `content:`, in the blog's language, for EVERY theme.
 *
 * A content string in a theme's sheet cannot be translated, and that sheet is one hashed file
 * shared by every blog, so the engine hands the words over as variables instead: the sheet
 * writes `content:var(--l-figure) " " counter(fig)` and gets "Fig." here and "Hình" there.
 * Declared whatever the theme, so a theme the engine has never heard of can number its figures
 * the same way. About 40 bytes a page.
 */
export function labelVarsCss(lang: SiteLang): string {
  const d = t(lang)
  return `:root{--l-figure:${cssString(d.figureLabel)};--l-table:${cssString(d.tableLabel)}}`
}

/**
 * The part of the sheet that depends on the OWNER'S SETTINGS, inlined into the page.
 *
 * Order is load-bearing: the fonts first, then the reading column, then the palette and
 * typography, then the owner's custom font and CSS. Each later part is allowed to win, and
 * a fresh install with nothing configured still gets a complete sheet.
 *
 * Unlayered, so all of it wins over the base and theme sheets whatever their selectors weigh
 * (ADR 0072, `web/css-layers.ts`). The geometry is not the owner's to style and is wrapped in
 * place in the layer of what it extends, which keeps each piece in the cascade position it had:
 * the reading column, the rail of a moved column and the page's own geometry (`extra`) in
 * `base`; the theme's rail rules and the chrome font's tracking correction in `theme`. Nothing
 * is moved, so inside each tier the order is the one it always was.
 *
 * The static half is no longer here. It is `PUBLIC_SHEET`, linked immediately before this
 * block so the cascade reads exactly as it did when the two were one string — see
 * `web/assets.ts` for why it was split.
 */
/**
 * The meta ink, a step toward the text ink, for a theme whose page lies on a ground darker than
 * the palette's background (`layout.deepenMetaInk`, `content/themes-builtin.ts`).
 *
 * The palette's `--c-meta` is chosen against `--c-bg`. The notebook puts a desk under the page
 * that is the page darkened, and the tagline, the footer and the dates down the rail stand on
 * it: mono's #6d6c6c measured 4.47:1 there, under the 4.5 AA asks at that size. 94% of the meta
 * ink into the text ink lands it at 4.60:1, and every palette moves by the same slice, derived
 * from its own two tokens.
 *
 * TWO DECLARATIONS, because a custom property that names itself is a cycle and not a reference
 * to its parent: `--c-meta` mixed from `var(--c-meta)` on the body made it invalid for
 * everything under it (shipped that way 2026-09-14 to 09-23). The mix is taken on the root,
 * where `--c-meta` is the palette's own, and handed to the body under the engine's name.
 *
 * The engine's and not the theme sheet's: a theme may not set an engine variable (V1, ADR
 * 0072). Written by `renderDocument` straight after the theme's sheet, where the rule sat when
 * the sheet carried it, so the cascade is unchanged; and only where that sheet is linked, so the
 * sign-in pages, which wear no theme, keep the palette's own ink. The owner's custom CSS still
 * comes after it and has the last word.
 */
export function deepenMetaInkCss(theme: SiteTheme): string {
  if (!theme.layout.deepenMetaInk) return ''
  const root = `html[data-theme="${theme.id}"]`
  return `${root}{--meta-deepened:color-mix(in srgb,var(--c-meta) 94%,var(--c-text))}`
    + `${root} body{--c-meta:var(--meta-deepened)}`
}

export function pageStyles(settings: SiteSettings, extra = ''): string {
  const theme = resolveTheme(settings)
  // What is DRAWN, which is what is stored unless it names a font or palette no longer on offer
  // (an installed theme's, under another theme): then the default, and the row keeps the id.
  const fonts = drawnFonts(settings, theme)
  const palettes = drawnPalettes(settings, theme)
  return [
    // FIRST: a family has to be declared before anything can ask for it by name.
    fontFaceCss(fonts.reading ? null : fonts.readingPreset, fonts.chromeFont, theme),
    // The chrome face, and the reading face's fallback until a preset repoints it. Inter
    // is the universal base, exactly as in the frozen tree. --font-mono is the third and
    // last handle: code, and only code. It is a constant rather than a setting because
    // there is no code-font picker — the two mono families in CHROME_FONTS are a chrome
    // choice, which is a different question from what a fenced block is set in.
    // --font-display is the theme's headline face, and the reading face where the theme has
    // none: a sheet may name it on any theme and gets a face either way.
    `:root{--font-sans:'Inter', 'Inter Fallback', system-ui, -apple-system, 'Segoe UI', sans-serif;`
    + `--font-reading:var(--font-sans);`
    + `--font-mono:'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;`
    + `--font-display:${displayFontValue(theme, fonts)}}`,
    // The reading column, from the owner's setting. A two-rail listing narrows it by
    // overriding this later in the sheet, which is why it is a variable and not baked in.
    //
    // In `base`, with the page geometry below that overrides it: the front page and a two-rail
    // listing restate `--shell-w` there, and must still win. No theme can set it (the checker
    // refuses an engine variable), and custom CSS beats every layer, so nothing else moves.
    inLayer('base', `:root{--shell-w:${settings.contentWidth}px}`),
    // Injected at runtime, not written by hand, because a media query cannot read a CSS
    // variable and the breakpoint is COMPUTED from the reading column: the rail only moves
    // into the gutter when there is room for it on BOTH sides, so the column stays centred.
    //
    // ...and ONLY when the owner has moved the column. The default geometry is in the hashed
    // sheet, right after `RAIL_CSS`, where it is cached immutably instead of being re-sent
    // with every page: 1,046 compressed bytes a view. A site that has changed the width still
    // gets its own copy here, after the sheet, so it overrides the precomputed one.
    settings.contentWidth === DEFAULT_RAIL_WIDTH ? ''
      : inLayer('base', singleRailCss(settings.contentWidth)) + inLayer('theme', railHoldCss(settings.contentWidth)),
    // The theme's rules for the rail band, which only exist inside queries computed from the
    // column; nothing for a theme that has none (`content/themes-builtin.ts`). In the theme's
    // layer, beside the sheet it belongs to.
    inLayer('theme', railThemeCss(settings.contentWidth, theme.rail)),
    // The site default for galleries. In CSS on purpose: rendered Markdown is cached under
    // a hash of its input, so a default that changed the MARKUP would leave every body that
    // was already rendered serving the old shape until something unrelated evicted it.
    figureCss(settings.figure),
    galleryCss(settings.gallery),
    // The pen toggles, on the same terms as the gallery above.
    penGesturesCss(settings.features),
    selectionCss(settings.inks),
    // Page-specific geometry: the listing's second rail, the feed's gutter timeline. It
    // comes BEFORE the owner's own settings, so custom CSS still has the last word. In `base`,
    // the layer of the sheet it extends: the code theme's rail rules above outweigh some of
    // these and have to keep winning.
    inLayer('base', extra),
    fontPresetCss(fonts.readingPreset),
    // Straight after the preset it overrides, and before the owner's own CSS can have the
    // last word. `:lang(zh|ja|ko)` swaps ONLY the CJK tail of the reading stack, so a Han
    // character is drawn in that language's letterforms instead of whichever CJK family the
    // machine happens to have installed first (`content/fonts.ts`). Inert on a site whose
    // language is none of the three — no selector matches, and it is ~700 bytes.
    cjkLangCss(fonts.readingPreset, fonts.reading ? themeFamily(fonts.reading) : null),
    chromeFontCss(fonts.chromeFont),
    // An installed theme's reading or chrome font, when the owner chose it: after the engine's
    // own rules above, so it wins them, and before the uploaded font, which still wins.
    themeFontVarsCss(fonts),
    // The translated words a theme prints through `content:`, for every theme (above).
    labelVarsCss(settings.language),
    // `enabledPalettes` third: a reader can only ever reach what the owner turned on, so a
    // blog with one palette ships one rather than all six (`content/themes.ts`).
    themesToCss(palettes.themes, palettes.themePreset, palettes.enabledPalettes,
      settings.defaultScheme),
    // BEFORE typography, because `--density` is read inside the block typography emits
    // (`settings-css.ts` says why it has to be read there and nowhere else). Radius and the
    // two heading weights are ordinary variables and could sit anywhere; they ride along so
    // the shape knobs are one line in one place.
    shapeToCss(settings.shape),
    // Anywhere after the palette: every ground it emits is MIXED from `--c-rule` and
    // `--c-bg`, so the table follows whichever of the six palettes is on without a second
    // declaration and without naming a colour (`prose.css.ts` holds the selectors).
    tableToCss(settings.table, theme.ownsSettings),
    typographyToCss(settings.typography),
    fontToCss(settings.customFont, fonts),
    // Keyed on `data-chrome-font`, which `renderDocument` puts on <html>. It has to come
    // after the chrome font is resolved and before the owner's own CSS can override it, and
    // it emits only the one block this page's own attributes can match.
    //
    // In the THEME layer, after the theme's sheet, which is the place it had: a correction of the
    // chrome face that a theme refines, weight against weight. The notebook's site title states
    // its own tracking in a heavier rule and kept it; unlayered, the correction would take it.
    inLayer('theme', monoTracking(fonts.chromeFont, theme)),
    settings.customCss,
  ].filter(Boolean).join('\n')
}
