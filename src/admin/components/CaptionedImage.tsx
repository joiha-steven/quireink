// Custom image node: a figure with an editable caption, alignment (left/center/
// right), a size (column width, 30% — which floats when aligned so the text runs
// around it — or "wide", nosing into the gutter on wide screens), and a "grid"
// toggle (gallery item — consecutive #grid images render as a CSS grid, see
// PostContent). Placement is encoded as a fragment on the src (e.g.
// ![caption](url#right-wide) or url#grid) and the caption lives in the alt, so
// the node still serializes to plain Markdown.
//
// A gallery has two options of its own, on the same fragment: a ratio that crops every
// tile to one shape (`#grid-1x1`), and `nocap`, which hides the captions. Both act on the
// whole run rather than the selected image, because they are properties of the gallery.
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useAdminT } from './I18nProvider'
import { SEGMENT_TRACK, tabItemClass } from './kit'
import { galleryCols } from '@/render/gallery-cols'

type Align = 'left' | 'center' | 'right'
/**
 * Both gallery options are three-valued, and the third value is SILENCE.
 *
 * '' means "no token", which is not the same as `asis` or `cap`: it means the gallery does
 * not have an opinion and follows Settings. That is the value an imported archive has, and
 * it is why one screen can restyle thirty galleries at once. Keeping a way BACK to it
 * matters as much as the explicit choices, or the first click pins a gallery forever.
 */
type Ratio = '' | 'asis' | '1x1' | '3x2' | '4x3'
type Caption = '' | 'cap' | 'nocap'
type GridOpts = { ratio: Ratio; caption: Caption }

const RATIOS: Ratio[] = ['', 'asis', '1x1', '3x2', '4x3']
const CAPTIONS: Caption[] = ['', 'cap', 'nocap']
// Ratios read the same in every language, so they are not translated. The words are.
const RATIO_LABEL: Record<string, string> = { '1x1': '1:1', '3x2': '3:2', '4x3': '4:3' }

// Column is the unmarked default; `third` (30%, floats when aligned) and `wide` are the
// other two sizes, and they are one three-valued choice rather than two booleans because a
// figure cannot be 30% of the column and wider than it at once.
type Size = '' | 'third' | 'wide'

// The frame is a mat of paper (or of ink) around the picture. Weight is one four-valued
// choice rather than a boolean plus a size, because "framed" and "how thick" are the same
// decision — you cannot be framed at no thickness. '' is unframed, which is the default and
// writes no token at all.
// '' is SILENCE — follow whatever the site setting says — and 'none' is this picture saying
// plain out loud. Both are needed the moment a site default exists to disagree with, which
// is the same shape the gallery ratio and caption switches already have.
type FrameWeight = '' | 'none' | 'thin' | 'frame' | 'thick'
const FRAME_WEIGHTS: FrameWeight[] = ['', 'none', 'thin', 'frame', 'thick']
// Paper or ink is three-valued for the same reason: '' follows the site.
type FrameInk = '' | 'paper' | 'ink'
const FRAME_INKS: FrameInk[] = ['', 'paper', 'ink']
type Frame = { weight: FrameWeight; ink: FrameInk }

type Frag = { clean: string; align: Align; size: Size; grid: boolean } & GridOpts & Frame

function parseFrag(src: string): Frag {
  const [clean, frag = ''] = src.split('#')
  // Exact hyphen tokens, matching what the renderer reads. This used to test the fragment
  // as a substring, which made the editor and the public page disagree about `#bright`.
  const tokens = frag.split('-')
  const align: Align = tokens.includes('left') ? 'left' : tokens.includes('right') ? 'right' : 'center'
  return {
    clean,
    align,
    // `wide` first, matching the renderer: a fragment carrying both was widened last.
    size: tokens.includes('wide') ? 'wide' : tokens.includes('third') ? 'third' : '',
    grid: tokens.includes('grid'),
    ratio: RATIOS.find((r) => r !== '' && tokens.includes(r)) ?? '',
    caption: CAPTIONS.find((c) => c !== '' && tokens.includes(c)) ?? '',
    // `thin` and `thick` mean nothing without `frame` beside them, exactly as the renderer
    // reads them: a stray `#thick` on some imported URL must not frame anything.
    weight: tokens.includes('noframe')
      ? 'none'
      : tokens.includes('frame')
        ? (tokens.includes('thin') ? 'thin' : tokens.includes('thick') ? 'thick' : 'frame')
        : '',
    ink: !tokens.includes('frame') ? '' : tokens.includes('ink') ? 'ink' : tokens.includes('paper') ? 'paper' : '',
  }
}

// `grid` is exclusive — a gallery item ignores align/size (the grid lays it out).
function buildSrc(clean: string, f: Omit<Frag, 'clean'>): string {
  // The frame rides along with EITHER shape. A gallery of framed tiles is a real thing to
  // want, and the grid still owns the layout; the frame is only the picture's own edge.
  const frame = f.weight === ''
    ? []
    : f.weight === 'none'
      ? ['noframe']
      : [f.weight === 'frame' ? 'frame' : `frame-${f.weight}`, f.ink]
  const marker = f.grid
    ? ['grid', f.ratio, f.caption, ...frame].filter(Boolean).join('-')
    : [f.align !== 'center' ? f.align : '', f.size, ...frame].filter(Boolean).join('-')
  return marker ? `${clean}#${marker}` : clean
}

/**
 * Apply an option to EVERY tile in this gallery, in one transaction.
 *
 * A gallery is a run of consecutive `#grid` images, and the ratio and the caption switch
 * belong to the run: one square tile in a mosaic of tall ones is not something anybody
 * sets on purpose. The page this was built for has galleries of twenty photos, which is
 * twenty trips through this toolbar if a button only touches what is selected.
 *
 * The new value is decided once, by the caller, from the tile the author clicked. Deriving
 * it per tile instead would make a run that had somehow gone inconsistent stay that way,
 * with each half flipping past the other on every click.
 */
function applyToGallery(editor: NodeViewProps['editor'], pos: number, opts: Partial<GridOpts>): void {
  const tiles: { offset: number; src: string; grid: boolean }[] = []
  editor.state.doc.forEach((child, offset) => {
    const raw: unknown = child.attrs.src
    const src = typeof raw === 'string' ? raw : ''
    tiles.push({ offset, src, grid: child.type.name === 'image' && parseFrag(src).grid })
  })

  const here = tiles.findIndex((t) => t.offset === pos)
  if (here < 0) return
  let from = here
  let to = here
  while (from > 0 && tiles[from - 1]?.grid) from -= 1
  while (to < tiles.length - 1 && tiles[to + 1]?.grid) to += 1

  // Attribute-only changes, so no position shifts: the offsets stay valid across the loop.
  const tr = editor.state.tr
  for (let i = from; i <= to; i += 1) {
    const tile = tiles[i]
    if (!tile) continue
    const f = parseFrag(tile.src)
    tr.setNodeAttribute(tile.offset, 'src', buildSrc(f.clean, { ...f, ...opts }))
  }
  editor.view.dispatch(tr)
}

/**
 * How many tiles are in THIS tile's run — the number the published grid is built from.
 *
 * The editor used to lay every gallery out three across, whatever its size, while the page
 * used `galleryCols`: two, three or four by count. So the commonest gallery of all — four
 * pictures — was 3+1 while you wrote it and 2x2 once you published it, and nothing on the
 * screen said which was true. Same walk as `applyToGallery`, which already had to find the
 * run's edges for the ratio and caption switches.
 */
function runLength(editor: NodeViewProps['editor'], pos: number): number {
  const tiles: { offset: number; grid: boolean }[] = []
  editor.state.doc.forEach((child, offset) => {
    const raw: unknown = child.attrs.src
    const src = typeof raw === 'string' ? raw : ''
    tiles.push({ offset, grid: child.type.name === 'image' && parseFrag(src).grid })
  })
  const here = tiles.findIndex((t) => t.offset === pos)
  if (here < 0) return 0
  let from = here
  let to = here
  while (from > 0 && tiles[from - 1]?.grid) from -= 1
  while (to < tiles.length - 1 && tiles[to + 1]?.grid) to += 1
  return to - from + 1
}

function CaptionedImageView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const t = useAdminT()
  const src = (node.attrs.src as string) || ''
  const caption = (node.attrs.alt as string) || ''
  const { clean, align, size, grid, ratio, caption: cap, weight, ink } = parseFrag(src)

  // Setting align/size implies leaving grid mode; setGrid toggles membership. All three
  // stay per-image: pulling one photo out of a gallery is about that photo.
  const rest = { align, size, grid, ratio, caption: cap, weight, ink }
  const setAlign = (a: Align) => updateAttributes({ src: buildSrc(clean, { ...rest, align: a, grid: false }) })
  const setSize = (s: Size) => updateAttributes({ src: buildSrc(clean, { ...rest, size: s, grid: false }) })
  const setGrid = (g: boolean) => updateAttributes({ src: buildSrc(clean, { ...rest, grid: g }) })
  // Turning the frame off turns the ink off with it: an unframed picture has no mat to be
  // made of ink, and leaving `ink` set would surprise whoever framed it again later.
  // Leaving the frame behind takes the mat's colour with it: there is no mat left for it to
  // describe, and a stale `ink` would surprise whoever framed the picture again later.
  const framed = (w: FrameWeight) => w !== '' && w !== 'none'
  const setWeight = (v: FrameWeight) => updateAttributes({ src: buildSrc(clean, { ...rest, weight: v, ink: framed(v) ? ink : '' }) })
  const setInk = (v: FrameInk) => updateAttributes({ src: buildSrc(clean, { ...rest, weight: framed(weight) ? weight : 'frame', ink: v }) })

  const setGalleryOpts = (opts: Partial<GridOpts>) => {
    const pos = getPos()
    if (pos !== undefined) applyToGallery(editor, pos, opts)
  }

  const figCls = grid ? 'img-grid' : `img-${align}${size ? ` img-${size}` : ''}`
  const group = SEGMENT_TRACK
  const btn = (active: boolean) => tabItemClass(active, 'sm')

  // The published column count, so the preview is the same grid the reader gets. A tile that
  // cannot find its own position (getPos is undefined between transactions) falls back to
  // the old fixed three rather than jumping about.
  const pos = grid ? getPos() : undefined
  const cols = pos === undefined ? 3 : galleryCols(runLength(editor, pos)) || 3

  return (
    <NodeViewWrapper
      as="figure"
      className={`my-4 ${figCls}`}
      data-drag-handle
      // The COUNT, as an attribute the parent can be selected on. A custom property was the
      // first attempt and it cannot work: the width belongs to `.react-renderer`, which is
      // this node's PARENT, and a variable set here does not travel upward. `admin.css`
      // matches on the attribute instead, with `editorTileWidth` as the one source of the
      // three numbers and a test holding the sheet to them.
      {...(grid ? { 'data-cols': String(cols) } : {})}
    >
      {selected && (
        <div
          // THE TOOLBAR MUST NOT BE AS NARROW AS THE TILE. In a gallery the node view IS a
          // grid cell — 202px on a 1440px screen, 102px on a phone — and this bar carries up
          // to seventeen buttons in five segmented groups. Each group is `w-fit max-w-full
          // overflow-hidden`, so the overflow was not a squeeze but a CLIP: measured
          // 2026-08-28, five of fourteen buttons on a desktop and ten of fourteen on a phone
          // were cut off and unclickable, and the ones that went were the choices — the crop
          // ratios and the frame weights. Editing a gallery on a phone was impossible.
          //
          // So a selected tile's bar leaves the cell: it is taken out of flow and given the
          // writing column to lay itself out in. Only for a tile — a lone picture's node view
          // is already the full column and the bar is happier in the flow above it, where it
          // pushes nothing sideways.
          className={grid
            ? 'qi-tile-bar mb-2 flex flex-wrap gap-2'
            : 'mb-2 flex flex-wrap gap-2'}
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
        >
          {grid ? (
            // In a gallery: how the tiles are cropped, whether captions show, and the way out.
            // Align and size do not apply, because the grid decides them.
            <>
              <div className={group}>
                {RATIOS.map((r) => (
                  <button
                    key={r || 'default'}
                    type="button"
                    onClick={() => setGalleryOpts({ ratio: r })}
                    className={btn(ratio === r)}
                  >
                    {r === '' ? t.imgDefault : r === 'asis' ? t.imgRatioNatural : RATIO_LABEL[r]}
                  </button>
                ))}
              </div>
              <div className={group}>
                {CAPTIONS.map((c) => (
                  <button
                    key={c || 'default'}
                    type="button"
                    onClick={() => setGalleryOpts({ caption: c })}
                    className={btn(cap === c)}
                  >
                    {c === '' ? t.imgDefault : c === 'cap' ? t.imgCaptions : t.imgNoCaptions}
                  </button>
                ))}
              </div>
              <div className={group}>
                <button type="button" onClick={() => setGrid(false)} className={btn(true)}>
                  {t.imgGrid}
                </button>
              </div>
              {/* The frame, and it is deliberately the LAST group in both shapes: it is the
                  only choice here that does not move the picture, so it reads as trim rather
                  than as layout. Ink is a separate toggle rather than a fifth weight, because
                  the mat's colour and its thickness are two questions. */}
              <div className={group}>
                {FRAME_WEIGHTS.map((v) => (
                  <button
                    key={v || 'site'}
                    type="button"
                    onClick={() => setWeight(v)}
                    className={btn(weight === v)}
                  >
                    {v === '' ? t.imgDefault
                      : v === 'none' ? t.imgFrameNone
                        : v === 'thin' ? t.imgFrameThin
                          : v === 'frame' ? t.imgFrameMedium : t.imgFrameThick}
                  </button>
                ))}
              </div>
              {framed(weight) && (
                <div className={group}>
                  {FRAME_INKS.map((v) => (
                    <button key={v || 'site'} type="button" onClick={() => setInk(v)} className={btn(ink === v)}>
                      {v === '' ? t.imgDefault : v === 'paper' ? t.imgFramePaper : t.imgFrameInk}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className={group}>
                <button type="button" onClick={() => setAlign('left')} className={btn(align === 'left')}>
                  {t.imgAlignLeft}
                </button>
                <button type="button" onClick={() => setAlign('center')} className={btn(align === 'center')}>
                  {t.imgAlignCenter}
                </button>
                <button type="button" onClick={() => setAlign('right')} className={btn(align === 'right')}>
                  {t.imgAlignRight}
                </button>
              </div>
              <div className={group}>
                <button type="button" onClick={() => setSize('')} className={btn(size === '')}>
                  {t.imgSizeColumn}
                </button>
                {/* Not translated: a percentage reads the same in every language, the same
                    argument RATIO_LABEL already makes for 1:1 and 3:2. */}
                <button type="button" onClick={() => setSize('third')} className={btn(size === 'third')}>
                  30%
                </button>
                <button type="button" onClick={() => setSize('wide')} className={btn(size === 'wide')}>
                  {t.imgSizeWide}
                </button>
              </div>
              <div className={group}>
                <button type="button" onClick={() => setGrid(true)} className={btn(false)}>
                  {t.imgGrid}
                </button>
              </div>
              {/* The frame, and it is deliberately the LAST group in both shapes: it is the
                  only choice here that does not move the picture, so it reads as trim rather
                  than as layout. Ink is a separate toggle rather than a fifth weight, because
                  the mat's colour and its thickness are two questions. */}
              <div className={group}>
                {FRAME_WEIGHTS.map((v) => (
                  <button
                    key={v || 'site'}
                    type="button"
                    onClick={() => setWeight(v)}
                    className={btn(weight === v)}
                  >
                    {v === '' ? t.imgDefault
                      : v === 'none' ? t.imgFrameNone
                        : v === 'thin' ? t.imgFrameThin
                          : v === 'frame' ? t.imgFrameMedium : t.imgFrameThick}
                  </button>
                ))}
              </div>
              {framed(weight) && (
                <div className={group}>
                  {FRAME_INKS.map((v) => (
                    <button key={v || 'site'} type="button" onClick={() => setInk(v)} className={btn(ink === v)}>
                      {v === '' ? t.imgDefault : v === 'paper' ? t.imgFramePaper : t.imgFrameInk}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      <img
        src={clean}
        alt={caption}
        // The crop is shown here too, so choosing a ratio is a decision you can see rather
        // than one you take on trust and check on the live site.
        style={
          grid && ratio && ratio !== 'asis'
            ? { aspectRatio: ratio.replace('x', ' / '), objectFit: 'cover' }
            : undefined
        }
        // The frame is DRAWN HERE, not just recorded: the same padding-on-the-img trick the
        // public sheet uses, so choosing a weight is a decision you can see. The colours are
        // the admin's own — this is a preview of the shape, and the mat takes the reader's
        // paper colour on the site, which the admin has no token for.
        className={[
          'w-full rounded-lg',
          weight === 'thin' ? 'p-2' : weight === 'frame' ? 'p-4' : weight === 'thick' ? 'p-7' : '',
          !framed(weight) ? '' : ink === 'ink'
            ? 'border border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100'
            : 'border border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-900',
          selected ? 'ring-2 ring-neutral-900 dark:ring-white' : '',
        ].filter(Boolean).join(' ')}
      />
      <input
        value={caption}
        onChange={(e) => updateAttributes({ alt: e.target.value })}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder={t.captionPlaceholder}
        contentEditable={false}
        // Still editable with captions off: it is the alt text, so it keeps working for
        // screen readers and for search, it just does not print under the photo.
        className={`mt-1.5 w-full border-0 bg-transparent text-center text-sm outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-600 ${
          grid && cap === 'nocap' ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-500 dark:text-neutral-400'
        }`}
      />
    </NodeViewWrapper>
  )
}

export const CaptionedImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CaptionedImageView)
  },
})
