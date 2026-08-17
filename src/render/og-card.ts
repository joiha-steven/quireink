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
// inside an article — the literal pen from `web/ink.css.ts`, the same measured pigment and
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
import { DEFAULT_THEME } from '@/content/themes'
import { PEN_LIGHT, penStroke } from '@/render/pen'
import interLatin from '@/render/fonts/inter-latin.woff' with { type: 'file' }
import interLatinExt from '@/render/fonts/inter-latin-ext.woff' with { type: 'file' }
import interVietnamese from '@/render/fonts/inter-vietnamese.woff' with { type: 'file' }

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

// Loaded once. Three subsets, because a title can mix Vietnamese and ASCII and Inter ships
// them separately.
let fonts: SatoriOptions['fonts'] | null = null
async function interFonts(): Promise<SatoriOptions['fonts']> {
  if (fonts) return fonts
  const [latin, latinExt, vietnamese] = await Promise.all([
    Bun.file(interLatin).arrayBuffer(),
    Bun.file(interLatinExt).arrayBuffer(),
    Bun.file(interVietnamese).arrayBuffer(),
  ])
  // DISTINCT names with an explicit fallback chain. Under ONE name satori treats
  // overlapping subsets as a single font and double-renders any glyph present in more than
  // one: đ (U+0111) is in both latin-ext and vietnamese, and came out with two crossbars.
  fonts = [
    { name: 'Inter', data: latin, weight: 600, style: 'normal' },
    { name: 'InterExt', data: latinExt, weight: 600, style: 'normal' },
    { name: 'InterVN', data: vietnamese, weight: 600, style: 'normal' },
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
 * `render/pen.ts` holds the pen now, the page reads it from there too, and `og.test.ts`
 * compares the two — which is what the old comment described and what nothing did.
 */
const STROKE = {
  backgroundImage: penStroke(PEN_LIGHT.yellow),
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
function marked(text: string, size: number): Node {
  const words = text.split(/\s+/).filter(Boolean)
  // Padding .16em out, margin .06em BACK. The margin is negative on purpose and it is the
  // whole trick: at a positive margin every word gets its own island of yellow with paper
  // showing between them, which is a set of labels and not a pen. Pulled back, the boxes
  // overlap, the ink runs through the word space, and what is left is one sweep — the same
  // arithmetic `.prose mark` uses (padding:0 .16em; margin:0 -.12em).
  const padX = Math.round(size * 0.16)
  return div({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start' },
    words.map((w) => div({
      ...STROKE,
      display: 'flex',
      color: HEADING,
      fontSize: size,
      lineHeight: 1.24,
      letterSpacing: '-0.02em',
      padding: `${Math.round(size * 0.04)}px ${padX}px`,
      marginRight: -Math.round(size * 0.06),
      marginBottom: Math.round(size * 0.1),
    }, w)))
}

function tree(card: OgCard, family: string): Node {
  // Smaller type for a longer title, so it never overflows the card. A photo takes the top
  // of the card, so a title beside one starts a step down.
  const long = card.title.length
  const titleSize = card.bg
    ? (long > 90 ? 40 : long > 55 ? 46 : 54)
    : (long > 90 ? 52 : long > 55 ? 60 : 68)

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

  const block: unknown[] = [marked(card.title, titleSize)]

  if (card.desc) {
    block.push(div({
      marginTop: 26,
      fontSize: card.bg ? 26 : 30,
      lineHeight: 1.5,
      color: TEXT,
      // More of the excerpt than the old card showed: it stopped at four lines of 28px and
      // the space under it went to the gradient. Six lines on a card with no photo is
      // roughly the whole 200-character excerpt, which is the point of writing one.
      display: '-webkit-box',
      WebkitLineClamp: card.bg ? 3 : 6,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    }, card.desc))
  }

  rows.push(div({
    display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center',
    padding: card.bg ? '36px 72px 0' : '56px 72px 0',
  }, block))

  // The foot: the date under its own stroke, and the site name opposite it. A hairline
  // above, the same weight as the rules inside an article.
  const bottom = card.date || card.site
  rows.push(div({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    margin: '0 72px', padding: '22px 0 40px', borderTop: `1px solid ${RULE}`,
  }, [
    bottom ? marked(bottom, 26) : div({ display: 'flex' }),
    card.date && card.site
      ? div({ display: 'flex', fontSize: 24, color: META, letterSpacing: '0.01em' }, card.site)
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
  const family = (card.customFont ? 'Site, ' : '') + 'Inter, InterExt, InterVN'

  // satori joins sharp below in being loaded on first use rather than at boot, for the
  // other reason: this module is reachable from the route table, so a static import put
  // the whole SVG-layout engine into the resident set of every process, including the
  // ones nobody has ever asked for a social card.
  const { default: satori } = await import('satori')
  const svg = await satori(tree(card, family) as never, { ...OG_SIZE, fonts: all })

  // sharp is loaded HERE, not at the top of the file, and the reason is measured rather
  // than stylistic: `bun build --compile` bundles sharp's JavaScript but not its native
  // module, so a compiled binary throws "Could not load the sharp module". As a top-level
  // import that happens during boot and the server never starts — a blog that serves
  // nothing because it cannot draw a social card. Deferred, the same broken install serves
  // every page and fails only `/og`, which the caller turns into a 500 for that one URL.
  const { default: sharp } = await import('sharp')
  return new Uint8Array(await sharp(Buffer.from(svg), { density: DENSITY }).png().toBuffer())
}
