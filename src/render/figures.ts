// Figures: an <img> in the markdown becomes a <figure> here — where it sits, how wide it
// is, the frame it wears, the run of tiles it may belong to, and which of its stored widths
// the browser is allowed to choose from.
//
// Split out of `post-content.ts` on 2026-08-28, when making `sizes` honest per shape took
// that file past its 400-line cap. The guard says a file at the cap is SPLIT rather than
// squeezed, and this was the section that could leave whole: it is the same subject
// `figure.css.ts` owns on the other side, and every rule in here is about one element.
//
// It exports only what `post-content.ts` calls: the two fact types, and the two passes.
import { collapseBlob } from '@/media/blob'
import { galleryCols } from '@/render/gallery-cols'

/**
 * The same guard for an image's `src`, minus the part that would break a real image.
 *
 * The LINK path has been scheme-checked since the port and the IMAGE path never was, so
 * `![x](javascript:alert(1))` came out as `<img src="javascript:alert(1)">`. No browser
 * executes that — a `javascript:` URL in `src` is dead — so this closes an inconsistency
 * rather than a hole, and it is worth closing precisely because the next person to move
 * this URL somewhere executable would inherit the gap rather than the guard.
 *
 * `data:` is deliberately NOT blocked here, unlike in `safeHref`: `data:image/png;base64,…`
 * is a legitimate inline image and blocking it would break real posts to prevent nothing.
 * Script inside an SVG does not run when the SVG is loaded as an `<img>`; the case where it
 * DOES run — the SVG opened as its own document — is handled where that is served
 * (`web/uploads.ts`).
 */
const safeImageSrc = (src: string): string => {
  const cleaned = src.trim().replace(/[\u0000-\u001F\u007F]/g, '')
  return /^(?:javascript|vbscript):/i.test(cleaned) ? '' : cleaned
}

// Intrinsic dims of uploaded originals, keyed by collapsed pathname. width/height
// on the <img> reserves the box from the aspect ratio → no CLS.
export type ImageDims = Map<string, { width: number; height: number }>

/**
 * Which originals have display variants, and WHICH SET of them.
 *
 * A Set until 2026-08-28, when a third width was added and membership stopped being enough:
 * an original finalised before that day has 1024/1600 and nothing else, and a `<picture>`
 * that names a missing candidate fails outright rather than falling back. The version says
 * what is on disk, so an old image is offered exactly what it has and the ordinary sweep
 * upgrades it without a migration.
 */
export type ReadyOriginals = Map<string, number>

// The shapes a gallery tile can be cropped to. Written `1x1` rather than `1:1` because
// this travels in a URL fragment, where a colon is legal but reads as a scheme separator
// to every human who looks at it. `asis` is not the absence of a ratio: it is "keep the
// proportions", which a gallery has to be able to say out loud once a SITE default exists
// to disagree with.
const GRID_RATIOS = new Set(['asis', '1x1', '3x2', '4x3'])

// Figure placement from the src fragment: #left|#right (align, default center),
// #wide (noses right into the gutter on wide screens; every image is full-bleed on phones),
// #third (30% of the column; with an align it floats and the text runs around it,
// magazine-fashion — the one fragment that changes how TEXT lays out, not just the figure).
// Caption = alt.
// The frame a picture wears, independent of where the picture sits: a mat of paper (or of
// ink) with a line around it. `frame` alone is the middle weight; `thin` and `thick` mean
// nothing on their own, which is why they are read only from beside it.
//
// THREE-VALUED, like the gallery options above it, and the third value is SILENCE: no token
// means "whatever the site setting says". So `noframe` has to exist and has to be written
// down — on a site whose default is a frame, "this one, plain" is a thing an author needs to
// be able to say, and saying nothing already means something else.
function frameClasses(tokens: string[]): string {
  if (tokens.includes('noframe')) return 'img-noframe'
  if (!tokens.includes('frame')) return ''
  const weight = tokens.includes('thin') ? 'img-frame-thin' : tokens.includes('thick') ? 'img-frame-thick' : ''
  const ink = tokens.includes('ink') ? 'img-frame-ink' : ''
  return ['img-frame', weight, ink].filter(Boolean).join(' ')
}

function imgClasses(frag: string): string {
  // Exact hyphen tokens so `#bright` can't match `right`: left|right|wide|third|left-third|….
  const tokens = frag.split('-')
  // `#grid` marks a gallery item; groupGalleries() wraps consecutive ones. The
  // grid owns layout, so align/wide are ignored for a grid item.
  //
  // A gallery may also name its own shape and caption state. Each is three-valued and the
  // third value is SILENCE: no token means "whatever the site setting says", which is what
  // lets one screen fix a whole imported archive. The classes only carry an override.
  if (tokens.includes('grid')) {
    const ratio = tokens.find((t) => GRID_RATIOS.has(t))
    const cap = tokens.includes('nocap') ? 'g-nocap' : tokens.includes('cap') ? 'g-cap' : ''
    const opts = [ratio ? `g-${ratio}` : '', cap, frameClasses(tokens)].filter(Boolean)
    return opts.length ? `img-grid ${opts.join(' ')}` : 'img-grid'
  }
  const align = tokens.includes('left') ? 'img-left' : tokens.includes('right') ? 'img-right' : 'img-center'
  // The frame is ORTHOGONAL to all of this: it is drawn on the picture, while align and
  // size decide where the picture goes. So it rides along with whichever answer wins below.
  const frame = frameClasses(tokens)
  const with_ = (base: string): string => (frame ? `${base} ${frame}` : base)
  // `wide` and `third` are both sizes, so they cannot compose; wide wins because a fragment
  // carrying both was almost certainly widened last.
  if (tokens.includes('wide')) return with_(`${align} img-wide`)
  return with_(tokens.includes('third') ? `${align} img-third` : align)
}

// Wrap a run of 2+ consecutive `#grid` figures (separated only by whitespace)
// into one `.gallery` grid container, with a column count chosen from how many
// images are in the run. A lone grid image stays a normal figure.
// `img-grid[^"]*` rather than `img-grid"`, because a tile now carries its ratio and
// caption classes alongside. Matching the exact old string silently stopped grouping the
// moment an option was set, and a gallery that quietly falls apart into a column of
// full-width photos is the kind of break nobody reports as a bug.
export function groupGalleries(html: string): string {
  return html.replace(/(?:<figure class="img-grid[^"]*">[\s\S]*?<\/figure>\s*){2,}/g, (run) => {
    const count = (run.match(/<figure class="img-grid[^"]*">/g) ?? []).length
    const cols = galleryCols(count)
    // THE ONLY PLACE A TILE'S WIDTH IS KNOWN. `buildFigures` sees one image at a time and
    // cannot tell a tile from a lone picture's neighbour; the column count exists here and
    // nowhere earlier, so this is where the tile's `sizes` stops being a placeholder.
    // Without it every tile claimed the full column and the browser fetched accordingly.
    return `<div class="gallery gallery-cols-${cols}">${run.trim().replaceAll(`sizes="${SIZES_TILE}"`, `sizes="${tileSizes(cols)}"`)}</div>`
  })
}

/**
 * What a gallery tile will really be, in one string the browser can act on.
 *
 * The numbers come from `figure.css.ts`: the gallery is the reading measure wide and the
 * gap is half a spacing unit (8px at the default scale), so a tile is the measure less the
 * gaps, divided by the columns. Below 639px `mobile.css.ts` caps the gallery at two
 * columns whatever this count is, so the phone half of the promise is 47vw regardless —
 * a tile beside one other tile, inside the page's own padding.
 */
function tileSizes(cols: number): string {
  const px = Math.round((COLUMN_PX - 8 * (cols - 1)) / cols)
  return `(max-width: 639px) 47vw, ${px}px`
}

// <picture> (AVIF/WebP) ONLY for raster originals with confirmed variants (`ready`, which
// carries the VERSION of the set on disk). A <picture> has no fallback on a 404 source, so
// anything unconfirmed renders as a plain <img> of the original (always loads) — and a v1
// original is offered only the two widths v1 generated.
//
// `sizes` IS A PROMISE ABOUT LAYOUT, and for a year this file made the same promise about
// every picture: `100vw` on a phone, 768px above. That is true of an image holding the
// reading column and false of every other shape the renderer can produce. Measured
// 2026-08-28 on a 390px phone: a gallery tile renders at 167px and was being told 100vw, so
// the browser dutifully fetched the 1024 file — six times the pixels it would draw. A
// `sizes` that lies costs bytes on every reader's connection and cannot be caught by any
// test that reads the markup, because the markup is exactly what was asked for.
//
// So each shape states its own, from the geometry in `figure.css.ts`:
//   column   672px, the reading measure
//   third    30% of it, and 60% of the viewport on a phone (mobile.css unfloats it)
//   wide     the measure plus both gutters, clamp(0,4vw,4rem) each side
//   grid     a tile, rewritten by `groupGalleries` once the column count is known
const COLUMN_PX = 672
const SIZES_COLUMN = `(max-width: 768px) 100vw, ${COLUMN_PX}px`
const SIZES_THIRD = `(max-width: 768px) 60vw, ${Math.round(COLUMN_PX * 0.3)}px`
const SIZES_WIDE = `(max-width: 768px) 100vw, ${COLUMN_PX + 128}px`
// A placeholder the tile carries until the run is grouped; `groupGalleries` replaces it
// with the width the tile will really have. If a tile somehow never gets grouped it is a
// lone `#grid` figure at column width, which is what this says.
const SIZES_TILE = SIZES_COLUMN

function sizesFor(cls: string): string {
  if (cls.includes('img-grid')) return SIZES_TILE
  if (cls.includes('img-wide')) return SIZES_WIDE
  if (cls.includes('img-third')) return SIZES_THIRD
  return SIZES_COLUMN
}

function responsiveSources(cleanSrc: string, ready: ReadyOriginals, sizes: string): string | null {
  const m = cleanSrc.match(/^(.*\/media\/.+)\.(?:jpe?g|png)$/i)
  if (!m) return null
  const version = ready.get(collapseBlob(cleanSrc))
  if (!version) return null // variants not generated -> plain <img>
  // Only the widths this original actually HAS. Naming -512 for a v1 image would break the
  // picture outright rather than degrade it.
  const widths = version >= 2 ? [512, 1024, 1600] : [1024, 1600]
  const set = (fmt: string) => widths.map((w) => `${m[1]}-${w}.${fmt} ${w}w`).join(', ')
  return (
    `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">` +
    `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
  )
}
export function buildFigures(html: string, ready: ReadyOriginals, dims: ImageDims): string {
  let seen = 0 // index of the image within the body, in source order
  return html
    .replace(/<p>\s*(<img\b[^>]*>)\s*<\/p>/g, '$1')
    .replace(/<img\b[^>]*>/g, (tag) => {
      const src = tag.match(/\bsrc="([^"]*)"/)?.[1]
      if (!src) return tag
      const alt = tag.match(/\balt="([^"]*)"/)?.[1] ?? ''
      const [rawSrc, frag = ''] = src.split('#')
      const cleanSrc = safeImageSrc(rawSrc ?? '')
      const caption = alt ? `<figcaption>${alt}</figcaption>` : ''
      // Intrinsic size (when known) reserves the box -> no CLS as it loads.
      const d = dims.get(collapseBlob(cleanSrc))
      const sizeAttrs = d ? ` width="${d.width}" height="${d.height}"` : ''
      // First image = likely LCP → eager + high priority; later images stay lazy.
      const priority = seen === 0 ? ' fetchpriority="high"' : ' loading="lazy"'
      seen++
      const img = `<img src="${cleanSrc}" alt="${alt}"${sizeAttrs}${priority}>`
      // The classes decide the shape, and the shape decides what `sizes` may honestly say,
      // so they are computed BEFORE the sources rather than after.
      const cls = imgClasses(frag)
      const sources = responsiveSources(cleanSrc, ready, sizesFor(cls))
      const media = sources ? `<picture>${sources}${img}</picture>` : img
      return `<figure class="${cls}">${media}${caption}</figure>`
    })
}
