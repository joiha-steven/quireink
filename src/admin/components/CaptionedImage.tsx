// Custom image node: a figure with an editable caption, alignment (left/center/
// right), a "wide" toggle (noses right into the gutter on wide screens; column
// width in between; every image is full-bleed on phones), and a "grid" toggle (gallery
// item — consecutive #grid images render as a CSS grid, see PostContent). Placement
// is encoded as a fragment on the src (e.g. ![caption](url#right-wide) or url#grid)
// and the caption lives in the alt, so the node still serializes to plain Markdown.
//
// A gallery has two options of its own, on the same fragment: a ratio that crops every
// tile to one shape (`#grid-1x1`), and `nocap`, which hides the captions. Both act on the
// whole run rather than the selected image, because they are properties of the gallery.
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useAdminT } from './I18nProvider'

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

type Frag = { clean: string; align: Align; wide: boolean; grid: boolean } & GridOpts

function parseFrag(src: string): Frag {
  const [clean, frag = ''] = src.split('#')
  // Exact hyphen tokens, matching what the renderer reads. This used to test the fragment
  // as a substring, which made the editor and the public page disagree about `#bright`.
  const tokens = frag.split('-')
  const align: Align = tokens.includes('left') ? 'left' : tokens.includes('right') ? 'right' : 'center'
  return {
    clean,
    align,
    wide: tokens.includes('wide'),
    grid: tokens.includes('grid'),
    ratio: RATIOS.find((r) => r !== '' && tokens.includes(r)) ?? '',
    caption: CAPTIONS.find((c) => c !== '' && tokens.includes(c)) ?? '',
  }
}

// `grid` is exclusive — a gallery item ignores align/wide (the grid lays it out).
function buildSrc(clean: string, f: Omit<Frag, 'clean'>): string {
  const marker = f.grid
    ? ['grid', f.ratio, f.caption].filter(Boolean).join('-')
    : [f.align !== 'center' ? f.align : '', f.wide ? 'wide' : ''].filter(Boolean).join('-')
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

function CaptionedImageView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const t = useAdminT()
  const src = (node.attrs.src as string) || ''
  const caption = (node.attrs.alt as string) || ''
  const { clean, align, wide, grid, ratio, caption: cap } = parseFrag(src)

  // Setting align/wide implies leaving grid mode; setGrid toggles membership. All three
  // stay per-image: pulling one photo out of a gallery is about that photo.
  const rest = { align, wide, grid, ratio, caption: cap }
  const setAlign = (a: Align) => updateAttributes({ src: buildSrc(clean, { ...rest, align: a, grid: false }) })
  const setWide = (w: boolean) => updateAttributes({ src: buildSrc(clean, { ...rest, wide: w, grid: false }) })
  const setGrid = (g: boolean) => updateAttributes({ src: buildSrc(clean, { ...rest, grid: g }) })

  const setGalleryOpts = (opts: Partial<GridOpts>) => {
    const pos = getPos()
    if (pos !== undefined) applyToGallery(editor, pos, opts)
  }

  const figCls = grid ? 'img-grid' : `img-${align}${wide ? ' img-wide' : ''}`
  const group = 'inline-flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800'
  const btn = (active: boolean) =>
    `rounded-lg px-2.5 py-1 text-xs font-medium ${
      active ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-neutral-500'
    }`

  return (
    <NodeViewWrapper as="figure" className={`my-4 ${figCls}`} data-drag-handle>
      {selected && (
        <div
          className="mb-2 flex flex-wrap gap-2"
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
                <button type="button" onClick={() => setWide(false)} className={btn(!wide)}>
                  {t.imgSizeColumn}
                </button>
                <button type="button" onClick={() => setWide(true)} className={btn(wide)}>
                  {t.imgSizeWide}
                </button>
              </div>
              <div className={group}>
                <button type="button" onClick={() => setGrid(true)} className={btn(false)}>
                  {t.imgGrid}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
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
        className={`w-full rounded-lg ${selected ? 'ring-2 ring-neutral-900 dark:ring-white' : ''}`}
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
