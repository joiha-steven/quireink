// THE SHEET THIS PAGE'S OWN SETTINGS MAKE, inlined after the immutable one.
//
// Split out of `layout.ts` on 2026-09-19, when that file reached its 400-line ceiling. The
// seam is real rather than convenient: everything left there assembles a DOCUMENT — the head
// tags, the body attributes, the shell — and this assembles a STYLESHEET. They share nothing
// but the settings object, and the order inside this one is load-bearing in a way the other
// half never has to think about.

import type { GallerySettings, FigureSettings, SiteSettings, FeatureSettings, InkSettings } from '@/types'
import { fontPresetCss, chromeFontCss, themesToCss } from '@/content/themes'
import { cjkLangCss } from '@/content/fonts'
import { typographyToCss, fontToCss, shapeToCss, tableToCss } from '@/content/settings'
import { DEFAULT_RAIL_WIDTH, railLookCss, singleRailCss } from '@/render/rail-css'
import { fontFaceCss, monoTracking } from '@/render/font-faces'
import { paperLabelCss } from '@/web/look-paper.css'
import { LISTS_PLAIN_CSS } from '@/pen/lists.css'

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
    fontFaceCss(settings.fontPreset, settings.chromeFont, settings.look),
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
    //
    // ...and ONLY when the owner has moved the column. The default geometry is in the hashed
    // sheet, right after `RAIL_CSS`, where it is cached immutably instead of being re-sent
    // with every page: 1,046 compressed bytes a view. A site that has changed the width still
    // gets its own copy here, after the sheet, so it overrides the precomputed one.
    settings.contentWidth === DEFAULT_RAIL_WIDTH ? '' : singleRailCss(settings.contentWidth),
    // The source-code look's two corrections to the band, and nothing for the other three.
    railLookCss(settings.contentWidth, settings.look),
    // The site default for galleries. In CSS on purpose: rendered Markdown is cached under
    // a hash of its input, so a default that changed the MARKUP would leave every body that
    // was already rendered serving the old shape until something unrelated evicted it.
    figureCss(settings.figure),
    galleryCss(settings.gallery),
    // The pen toggles, on the same terms as the gallery above.
    penGesturesCss(settings.features),
    selectionCss(settings.inks),
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
    // The newspaper dialect's two translated words. Nothing when another look is on, and
    // nothing at all when the look is plain: see `look-paper.css.ts` for why these two
    // strings cannot ride in the dialect's own cached sheet.
    settings.look === 'paper' ? paperLabelCss(settings.language) : '',
    // `enabledPalettes` third: a reader can only ever reach what the owner turned on, so a
    // blog with one palette ships one rather than all six (`content/themes.ts`).
    themesToCss(settings.themes, settings.themePreset, settings.enabledPalettes,
      settings.defaultScheme),
    // BEFORE typography, because `--density` is read inside the block typography emits
    // (`settings-css.ts` says why it has to be read there and nowhere else). Radius and the
    // two heading weights are ordinary variables and could sit anywhere; they ride along so
    // the shape knobs are one line in one place.
    shapeToCss(settings.shape),
    // Anywhere after the palette: every ground it emits is MIXED from `--c-rule` and
    // `--c-bg`, so the table follows whichever of the six palettes is on without a second
    // declaration and without naming a colour (`prose.css.ts` holds the selectors).
    tableToCss(settings.table),
    typographyToCss(settings.typography),
    fontToCss(settings.customFont),
    // Keyed on `data-chrome-font`, which `renderDocument` puts on <html>. It has to come
    // after the chrome font is resolved and before the owner's own CSS can override it, and
    // it emits only the one block this page's own attributes can match.
    monoTracking(settings.chromeFont, settings.look),
    settings.customCss,
  ].filter(Boolean).join('\n')
}
