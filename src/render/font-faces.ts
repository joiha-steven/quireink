// The `@font-face` declarations for the self-hosted families.
//
// THIS FILE EXISTED NOWHERE, and its absence was invisible: the settings named
// 'Literata' and 'JetBrains Mono', the layout preloaded their .woff2 files, the routes
// served those files with a 200 — and no rule ever told the browser what they were. Every
// page fell back to Georgia and a system serif, so the site rendered in the wrong two
// faces at the wrong two sizes while every part of the machinery around it looked healthy.
// A preload with no matching face is a download the browser throws away.
//
// Generated from a table rather than written out, because the frozen tree's globals.css
// spelled all 21 faces by hand and the only thing that varied between them was three
// strings. Only the faces a page can actually use are emitted: the reading preset and the
// chrome font, six declarations, rather than every family the binary happens to carry.

import { getChromeFont, getFontPreset } from '@/content/themes'

/**
 * The unicode ranges each subset covers, straight from Google Fonts' own slicing. Two
 * sets, because the mono families were sliced by a later version of the pipeline: their
 * latin drops U+2074, their latin-ext drops the ligature block, and their vietnamese adds
 * the combining marks Vietnamese stacks on its vowels. Ranges that do not match the actual
 * subset files would leave glyph holes, so these are copied, not reasoned about.
 */
const TEXT = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,'
    + 'U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,'
    + 'U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,'
    + 'U+2C60-2C7F,U+A720-A7FF,U+FB00-FB06',
  vietnamese: 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,'
    + 'U+1EA0-1EF9,U+20AB',
}

const MONO = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,'
    + 'U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,'
    + 'U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,'
    + 'U+2C60-2C7F,U+A720-A7FF',
  vietnamese: 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,'
    + 'U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
}

type Face = {
  /** The CSS family name, which must match what the preset's stack asks for. */
  family: string
  /** File stem: `/fonts/<slug>-<subset>.woff2`. */
  slug: string
  /** A variable font covers a range in one file; a static one needs a face per range. */
  weight: string
  ranges: typeof TEXT
}

/**
 * Every self-hosted family, keyed by the id the settings store.
 *
 * IBM Plex Mono is the one static family: no variable axis, so its 400 and 600 files each
 * claim a weight range instead of one face covering both.
 */
const FACES: Record<string, Face[]> = {
  inter: [{ family: 'Inter', slug: 'inter', weight: '400 700', ranges: TEXT }],
  sourcesans: [{ family: 'Source Sans 3', slug: 'sourcesans', weight: '200 900', ranges: TEXT }],
  literata: [{ family: 'Literata', slug: 'literata', weight: '400 700', ranges: TEXT }],
  sourceserif: [{ family: 'Source Serif 4', slug: 'sourceserif', weight: '400 700', ranges: TEXT }],
  'jetbrains-mono': [
    { family: 'JetBrains Mono', slug: 'jetbrainsmono', weight: '400 700', ranges: MONO },
  ],
  'plex-mono': [
    { family: 'IBM Plex Mono', slug: 'plexmono-400', weight: '100 500', ranges: MONO },
    { family: 'IBM Plex Mono', slug: 'plexmono-600', weight: '600 900', ranges: MONO },
  ],
}

const declare = (f: Face): string =>
  (Object.keys(f.ranges) as (keyof typeof TEXT)[]).map((subset) =>
    `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};`
    + `font-display:swap;src:url('/fonts/${f.slug}-${subset}.woff2') format('woff2');`
    + `unicode-range:${f.ranges[subset]}}`).join('')

/**
 * The faces this page needs: the owner's reading font, plus the chrome font when it is a
 * different family. Inter is always included — it is the fallback `--font-sans` points at
 * when the owner has chosen no chrome font, and the last resort under every other stack.
 *
 * JetBrains Mono is always included too, for the same reason and at the same cost: it is
 * what `--font-mono` resolves to, and `unicode-range` means a DECLARATION is not a
 * download. A post with no code renders no glyph in the family, so the browser never
 * fetches the file; a post with code gets the face it asked for instead of whatever
 * `ui-monospace` happens to be on that machine.
 */
export function fontFaceCss(fontPreset: string, chromeFont: string): string {
  const wanted = new Set<string>(['inter', 'jetbrains-mono', getFontPreset(fontPreset).slug])
  // 'reading' follows the reading font and 'inter' is already in; neither adds a family.
  if (getChromeFont(chromeFont).sans && chromeFont !== 'reading') wanted.add(chromeFont)
  return [...wanted].flatMap((id) => FACES[id] ?? []).map(declare).join('')
}

/**
 * Every family, for the ADMIN only.
 *
 * The font picker paints each tile in the font it offers, and the admin declared the
 * ACTIVE families alone — so five of the eight tiles rendered in a fallback and the owner
 * chose a typeface from a grid that would not show it to them. A picker that cannot show
 * its own options is the one surface where the narrow rule is the wrong rule.
 *
 * It costs the reader nothing (this never reaches a public page) and the owner nearly
 * nothing: a declaration is not a download, so a family arrives only on the tab where a
 * tile actually paints in it.
 */
export function allFontFaceCss(): string {
  return Object.values(FACES).flat().map(declare).join('')
}

/**
 * The chrome surfaces that STATE their own letter-spacing.
 *
 * Tracking inherits, so `body` alone used to cover the whole chrome. It stopped being
 * enough the moment each of these rules began naming its own `--ls-<role>` — which they do
 * because the owner's tracking setting has to reach them (see `check:type`). A rule that
 * sets the property no longer inherits the correction, so every one of them has to be
 * listed here.
 *
 * Reading surfaces are deliberately ABSENT, and three of them used to be here by
 * accident, and the whole book overlay was a fourth. `.deck`, `figcaption` and
 * `.footnotes` sit inside the article and are set in
 * the READING face — but with no tracking of their own they inherited the correction
 * from `body`, which is a mono adjustment applied to a serif. Measured 2026-07-29: all
 * three carried -0.05em under a JetBrains Mono chrome while rendering in Literata. They
 * take their own `--ls-h4` / `--ls-caption` / `--ls-small` now, like the rest of the
 * article. `.prose`, `.fs-*` and anything carrying `.reading-font` were never in scope.
 */
const CHROME_TRACKED = [
  'body', '.t-small:not(.reading-font)', '.t-body:not(.reading-font)',
  'header.site .tagline', 'header.site .title',
  'footer.site', '.pager', 'p.tags', '.related', 'aside.series',
  '.rail-sub', '.preview-note', '.subscribe-card', '#comments',
  '.code-copy', '.lightbox-caption', '.lightbox-count',
  // The newspaper's section headings. The front page arrived after this list and brought
  // one rule that states --ls-small without carrying `.t-small` in the markup, so it was
  // the only thing on that page the correction did not reach: measured under a JetBrains
  // Mono chrome, the word "Typography" set 90.2px as a section label and 82.7px as the
  // kicker three lines below it. Same font, same size, same screen, 9% apart. The page's
  // other chrome rules (`.fc-cat`, `.fc-meta`, `.front-topics`) all carry `.t-small` and
  // were right by inheritance; `.fc-title`, `.fc-deck` and `.fc-intro` are `.reading-font`
  // and are right by being excluded.
  '.front-label',
]

/**
 * Tracking correction for the two mono chrome faces, keyed on `data-chrome-font`.
 *
 * IBM Plex Mono and JetBrains Mono are wide monospaces, so chrome text set in them (the
 * rail, the menu, meta lines, and the whole admin) reads too airy at zero tracking. Pull it
 * in a touch, and ONLY there: the reader's own words carry their own letter-spacing and are
 * left alone. JetBrains runs wider than Plex, so it gets a little more.
 *
 * Ported late. It was missing from 2.0 entirely — public and admin — which is why a site set
 * to a mono chrome looked loose next to the frozen tree.
 */
const track = (id: string, em: string): string =>
  `${CHROME_TRACKED.map((s) => `html[data-chrome-font="${id}"] ${s}`).join(',')}{letter-spacing:${em}}`

export const MONO_TRACKING = `${track('plex-mono', '-0.04em')}${track('jetbrains-mono', '-0.05em')}`
