// The Open Graph card: 1200x630, rendered on the server, no browser involved.
//
// `next/og` was satori (JSX to SVG) plus a WASM rasteriser. Here it is satori plus sharp,
// which is already a dependency and already rasterises SVG. The element tree is built as
// plain objects rather than JSX: satori accepts either, and plain objects avoid giving this
// one file a different JSX pragma from the rest of the codebase.
//
// THE CARD IS A PAGE FROM THE SITE, NOT A BANNER. It was a dark gradient with white text on
// it, which is what every generated card on the web looks like and which said nothing about
// what a reader would find on the other side of the link. It is now paper, set in the site's
// own face, with the title and the date under the SAME highlighter stroke the reader meets
// inside an article — the literal pen from `pen/ink.css.ts`, the same measured pigment and
// the same hand-drawn edges, carried here as the SVG it already is.
//
// The pen is the one part of this file that does not follow the palette, and deliberately:
// ADR 0018 fixes its pigment across every theme because a highlighter is a physical object,
// not a UI colour. A card built around the pen therefore has no palette to follow either.
//
// Rasterised at 2x. satori emits SVG, so the resolution is sharp's to choose (`density`),
// and 72 DPI was leaving the type visibly soft on any hi-DPI phone — which is where a
// shared link is opened.

import type { SatoriOptions } from 'satori'
import { rasterizeSvg } from '@/runtime/impl/image'
import { loadSatori } from '@/runtime/impl/satori'
import { DEFAULT_THEME } from '@/content/themes'
import { PEN_LIGHT, penStrokeFlat } from '@/pen/pigments'
import { readAsset } from '@/runtime/impl/assets'
import interLatin from '@/render/fonts/inter-latin.woff' with { type: 'file' }
import interLatinExt from '@/render/fonts/inter-latin-ext.woff' with { type: 'file' }
import interVietnamese from '@/render/fonts/inter-vietnamese.woff' with { type: 'file' }
import interCyrillic from '@/render/fonts/inter-cyrillic.woff' with { type: 'file' }

export const OG_SIZE = { width: 1200, height: 630 } as const

/** Rasterisation density. 72 is sharp's default for SVG; 144 is the same card at 2x. */
const DENSITY = 144

export type OgCard = {
  /** The big top line. */
  title: string
  /** A middle line: a post's excerpt. Clamped so it cannot push the date off the card. */
  desc?: string
  /** The bottom line. `date` wins over `site` when both are given. */
  date?: string
  site?: string
  /** Background image, already fetched, as a data URI. Absent means plain paper. */
  bg?: string
  /** The owner's font, already fetched. Absent means Inter. */
  customFont?: ArrayBuffer
}

/**
 * What the bundled Inter subsets (latin, latin-ext, vietnamese, cyrillic) can draw, as code
 * point ranges. satori has no system fallback and no way to ask a font for its cmap, so a
 * glyph outside every subset comes out as a tofu box.
 *
 * DERIVED, not guessed: the union of the cmaps of `fonts/inter-*.woff` (read with fontTools),
 * less the control range and the soft hyphen. Re-derive it when a subset is replaced. Note it
 * carries only the PRECOMPOSED Vietnamese letters and a few combining marks, so text is
 * normalised to NFC before it is checked.
 */
const DRAWABLE: ReadonlyArray<readonly [number, number]> = [
  [0x20, 0x7e], [0xa0, 0xac], [0xae, 0x148], [0x14a, 0x1c3], [0x1c5, 0x254], [0x256, 0x27b],
  [0x27e, 0x284], [0x286, 0x290], [0x292, 0x2a4], [0x2a6, 0x2cc], [0x2ce, 0x2d7], [0x2da, 0x2da],
  [0x2dc, 0x301], [0x303, 0x304], [0x308, 0x309], [0x323, 0x323],
  [0x400, 0x45f], [0x490, 0x491], [0x4b0, 0x4b1],
  [0x1d00, 0x1d00], [0x1d0d, 0x1d0d], [0x1d1b, 0x1d1b], [0x1d43, 0x1d43], [0x1d47, 0x1d49],
  [0x1d4d, 0x1d4d], [0x1d4f, 0x1d50], [0x1d52, 0x1d52], [0x1d56, 0x1d58], [0x1d5b, 0x1d5b],
  [0x1d62, 0x1d65], [0x1d9c, 0x1d9c], [0x1da0, 0x1da0], [0x1dbb, 0x1dbb], [0x1dbf, 0x1dbf],
  [0x1e00, 0x1e9b], [0x1e9d, 0x1eff],
  [0x2002, 0x2002], [0x2009, 0x2009], [0x2013, 0x2014], [0x2018, 0x201a], [0x201c, 0x201e],
  [0x2020, 0x2020], [0x2022, 0x2022], [0x2026, 0x2026], [0x2032, 0x2033], [0x2039, 0x203a],
  [0x2044, 0x2044], [0x20a0, 0x20af], [0x20b1, 0x20b5], [0x20b8, 0x20ba], [0x20bc, 0x20bf],
  [0x2113, 0x2113], [0x2116, 0x2116], [0x2122, 0x2122], [0x2191, 0x2191], [0x2193, 0x2193],
  [0x2212, 0x2212], [0x2c7c, 0x2c7c], [0x2c7f, 0x2c7f], [0xa7ff, 0xa7ff],
]
const inDrawable = (c: number): boolean => DRAWABLE.some(([lo, hi]) => c >= lo && c <= hi)

/** Emoji and the characters that glue them (joiner, variation selector, keycap, skin tone, flags). */
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200d\ufe0e\ufe0f\u20e3\u{e0020}-\u{e007f}]/gu
/** Invisible format characters: nothing to draw, so nothing to decline. */
const INVISIBLE = /[\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/g

/**
 * The text as the card may draw it: emoji removed, spaces collapsed, or `null` when it still
 * holds a character no bundled face carries. Empty string means there is nothing left.
 *
 * `declineUnknown: false` is for an owner's own font, which is not subsetted and may draw
 * what Inter cannot: emoji still go (no text face has them), nothing else is declined.
 */
export function drawableText(text: string, declineUnknown = true): string | null {
  // Emoji go, except a symbol the font itself carries (©, ®, ™ are Extended_Pictographic).
  const noEmoji = text.normalize('NFC').replace(EMOJI, (m) => (inDrawable(m.codePointAt(0) ?? 0) && m.length === 1 ? m : ' '))
  // Unicode's hyphen, non-breaking hyphen and figure dash are not in the subsets; the ASCII one is.
  const t = noEmoji.replace(INVISIBLE, '').replace(/[‐-‒]/g, '-').replace(/\s+/g, ' ').trim()
  if (declineUnknown) {
    for (const ch of t) if (!inDrawable(ch.codePointAt(0) ?? 0)) return null
  }
  return t
}

/** Lines the title may take before it is cut with an ellipsis. */
const TITLE_LINES = 3
const TITLE_LINES_WITH_PHOTO = 2
/** Width of the text column: the card less 72px of margin each side. */
const COLUMN = OG_SIZE.width - 144

/** One title line box: line height, stroke padding and the gap under it, in em. */
const LINE_EM = 1.24 + 0.08 + 0.1

/**
 * Cut a title to what `lines` lines at `size` can hold, at a word boundary, with an
 * ellipsis. Estimated from an average glyph width (Inter semibold ~0.56em) with 10% slack
 * for the ragged right edge; the box's own maxHeight is the hard stop behind it.
 */
/** Grapheme clusters, so a cut never parts a base letter from its combining mark. */
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const graphemes = (text: string): string[] => Array.from(segmenter.segment(text), (x) => x.segment)

function clampTitle(text: string, size: number, lines: number): string {
  const budget = Math.floor((COLUMN / (size * 0.56)) * lines * 0.9)
  const g = graphemes(text)
  if (g.length <= budget) return text
  const cut = g.slice(0, budget - 1).join('')
  const space = cut.lastIndexOf(' ')
  return (space > budget * 0.5 ? cut.slice(0, space) : cut).trimEnd() + '\u2026'
}

// Loaded once. Four subsets, because a title can mix Vietnamese and ASCII and Inter ships
// them separately.
let fonts: SatoriOptions['fonts'] | null = null
async function interFonts(): Promise<SatoriOptions['fonts']> {
  if (fonts) return fonts
  const [latin, latinExt, vietnamese, cyrillic] = await Promise.all([
    readAsset(interLatin),
    readAsset(interLatinExt),
    readAsset(interVietnamese),
    readAsset(interCyrillic),
  ])
  // DISTINCT names with an explicit fallback chain. Under ONE name satori treats
  // overlapping subsets as a single font and double-renders any glyph present in more than
  // one: đ (U+0111) is in both latin-ext and vietnamese, and came out with two crossbars.
  fonts = [
    { name: 'Inter', data: latin, weight: 600, style: 'normal' },
    { name: 'InterExt', data: latinExt, weight: 600, style: 'normal' },
    { name: 'InterVN', data: vietnamese, weight: 600, style: 'normal' },
    // Cyrillic joined when the site grew Russian (2026-08-28): 10 KB, official Google
    // subset, converted woff2 -> woff because satori reads woff. Without it a Russian
    // title rendered as tofu on every share card. (CJK titles still do — a CJK face is
    // megabytes, and that trade is documented in content/fonts.ts.)
    { name: 'InterCyr', data: cyrillic, weight: 600, style: 'normal' },
  ]
  return fonts
}

type Node = { type: string; props: Record<string, unknown> }
const div = (style: Record<string, unknown>, children?: unknown): Node =>
  ({ type: 'div', props: children === undefined ? { style } : { style, children } })

/**
 * Paper, ink and the muted line: the default (mono) LIGHT palette, read rather than copied.
 *
 * The card is always paper, whatever palette the site is set to, so it takes one specific
 * theme rather than the reader's — but it took it as five literals, and `#747474` then had
 * to be corrected in `themes.ts` for contrast and the card kept the old grey. Exactly the
 * fault the pen had one file over. `.light` is not a choice made here; it is the card's
 * whole premise.
 */
const { bg: PAPER, heading: HEADING, text: TEXT, meta: META, rule: RULE } = DEFAULT_THEME.light

/**
 * The highlighter, exactly as the reader meets it — now literally so.
 *
 * This was a COPY of the path and of the measured yellow, with a comment saying the copy was
 * pinned to the original by a test. There was no such test, and the copy had drifted: the
 * second of the two paths — the denser lower band, the one that makes a stroke look like a
 * second pass rather than a wash — ended at 196,15.6 / L198,28 here and at 199,15.6 /
 * L200,29.5 on the page. The card was not showing the reader's pen. It was showing one four
 * numbers away from it, on the picture that represents the site everywhere it is shared.
 *
 * `pen/pigments.ts` holds the pen now, the page reads it from there too, and `og.test.ts`
 * compares the two — which is what the old comment described and what nothing did.
 */
const STROKE = {
  backgroundImage: penStrokeFlat(PEN_LIGHT.yellow),
  backgroundSize: '100% 100%',
  backgroundRepeat: 'no-repeat',
} as const

/**
 * A phrase under the pen, one stroke PER WORD.
 *
 * Not one box around the whole phrase, which is what a wrapping title would otherwise get:
 * a single rectangle two lines tall, which is a highlighted block and not a stroke. Per word
 * with the padding and negative margin in the same ratio the sheet uses
 * (`padding:0 .16em; margin:0 -.12em`) the strokes overlap through the spaces, so a phrase
 * reads as one sweep and a wrapped line starts a new one — which is precisely what
 * `box-decoration-break: clone` does for the reader, and what satori has no property for.
 */
function marked(text: string, size: number, lines?: number): Node {
  const words = text.split(/\s+/).filter(Boolean)
  // Padding .16em out, margin .06em BACK. The margin is negative on purpose and it is the
  // whole trick: at a positive margin every word gets its own island of yellow with paper
  // showing between them, which is a set of labels and not a pen. Pulled back, the boxes
  // overlap, the ink runs through the word space, and what is left is one sweep — the same
  // arithmetic `.prose mark` uses (padding:0 .16em; margin:0 -.12em).
  const padX = Math.round(size * 0.16)
  // `lines` makes it a clamped block: the box is `lines` line boxes tall and hides the rest.
  const clamp = lines
    ? { maxHeight: Math.round(size * LINE_EM * lines - size * 0.1), overflow: 'hidden' }
    : {}
  return div({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', ...clamp },
    words.map((w) => div({
      ...STROKE,
      display: 'flex',
      // A word wider than the column breaks inside itself instead of running off the card.
      maxWidth: '100%',
      wordBreak: 'break-all',
      color: HEADING,
      fontSize: size,
      lineHeight: 1.24,
      letterSpacing: '-0.02em',
      padding: `${Math.round(size * 0.04)}px ${padX}px`,
      marginRight: -Math.round(size * 0.06),
      marginBottom: Math.round(size * 0.1),
    }, w)))
}

export function ogCardTree(card: OgCard, family: string): Node {
  // Every line is checked against what the faces can draw. A title that cannot be drawn is
  // not drawn at all: the card then leads with the site name (or just the date) rather than
  // showing boxes or an empty hole.
  const decline = !card.customFont
  const title = drawableText(card.title, decline) || ''
  const desc = (card.desc && drawableText(card.desc, decline)) || ''
  const date = (card.date && drawableText(card.date, decline)) || ''
  const site = (card.site && drawableText(card.site, decline)) || ''
  const headline = title || site

  // Smaller type for a longer title, so it never overflows the card. A photo takes the top
  // of the card, so a title beside one starts a step down.
  const long = headline.length
  const titleSize = card.bg
    ? (long > 90 ? 40 : long > 55 ? 46 : 54)
    : (long > 90 ? 52 : long > 55 ? 60 : 68)
  const titleLines = card.bg ? TITLE_LINES_WITH_PHOTO : TITLE_LINES
  const headlineText = clampTitle(headline, titleSize, titleLines)

  const rows: unknown[] = []

  // The photo, as a band across the top rather than a wash behind everything. A dark
  // gradient with text over it was the old card, and it made every post look the same;
  // a band keeps the picture a picture and the words legible without a scrim.
  if (card.bg) {
    rows.push({
      type: 'img',
      props: { src: card.bg, width: OG_SIZE.width, height: 250, style: { objectFit: 'cover' } },
    })
  }

  const block: unknown[] = headlineText ? [marked(headlineText, titleSize, titleLines)] : []

  if (desc) {
    // Room left for the excerpt under the title (the foot takes ~100px), so its last line
    // is a whole line and never half of one cut by the box.
    const descSize = card.bg ? 26 : 30
    const titleLinesUsed = Math.min(titleLines, Math.ceil(headlineText.length * titleSize * 0.56 / COLUMN))
    const room = (card.bg ? 249 : 479) - Math.round(titleLinesUsed * titleSize * LINE_EM) - 26
    const descLines = Math.max(1, Math.min(card.bg ? 3 : 6, Math.floor(room / (descSize * 1.5))))
    block.push(div({
      marginTop: 26,
      fontSize: card.bg ? 26 : 30,
      lineHeight: 1.5,
      color: TEXT,
      // More of the excerpt than the old card showed: it stopped at four lines of 28px and
      // the space under it went to the gradient. Six lines on a card with no photo is
      // roughly the whole 200-character excerpt, which is the point of writing one.
      display: '-webkit-box',
      WebkitLineClamp: descLines,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    }, desc))
  }

  rows.push(div({
    // flexShrink + overflow: whatever happens inside, the foot below stays on the card.
    display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, minHeight: 0,
    overflow: 'hidden', justifyContent: 'center',
    padding: card.bg ? '36px 72px 0' : '56px 72px 0',
  }, block))

  // The foot: the date under its own stroke, and the site name opposite it. A hairline
  // above, the same weight as the rules inside an article.
  // With no title the site name already leads the card, so the foot carries the date alone.
  const siteInFoot = title ? site : ''
  const bottom = date || siteInFoot
  rows.push(div({
    display: 'flex', flexShrink: 0, alignItems: 'center', justifyContent: 'space-between',
    margin: '0 72px', padding: '22px 0 40px', borderTop: `1px solid ${RULE}`,
  }, [
    bottom ? marked(clampTitle(bottom, 26, 1), 26, 1) : div({ display: 'flex' }),
    date && siteInFoot
      ? div({ display: 'flex', fontSize: 24, color: META, letterSpacing: '0.01em' }, clampTitle(siteInFoot, 24, 1))
      : div({ display: 'flex' }),
  ]))

  return div({
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    background: PAPER, fontFamily: family,
  }, rows)
}

/** Render the card to PNG bytes. */
export async function renderOgCard(card: OgCard): Promise<Uint8Array> {
  const base = await interFonts()
  // The owner's face first, with the Inter subsets always behind it, so a glyph it lacks
  // still resolves. Same idea as the site's own font stack.
  const all = card.customFont
    ? [{ name: 'Site', data: card.customFont, weight: 600 as const, style: 'normal' as const }, ...base]
    : base
  const family = (card.customFont ? 'Site, ' : '') + 'Inter, InterExt, InterVN, InterCyr'

  // satori joins sharp below in being loaded on first use rather than at boot, for the
  // other reason: this module is reachable from the route table, so a static import put
  // the whole SVG-layout engine into the resident set of every process, including the
  // ones nobody has ever asked for a social card.
  const satori = await loadSatori()
  const svg = await satori(ogCardTree(card, family) as never, { ...OG_SIZE, fonts: all })

  // The PNG is the runtime's (`@/runtime/impl/image`): sharp on Bun, loaded on first use.
  return rasterizeSvg(svg, DENSITY)
}
