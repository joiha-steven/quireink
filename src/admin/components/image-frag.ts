// The grammar of an image's placement, as the editor reads and writes it.
//
// Placement rides on a fragment on the src — `![caption](url#right-wide)`, `url#grid-1x1` —
// and the caption lives in the alt, so a picture with a layout is still plain Markdown and
// still opens in any other editor. `render/figures.ts` reads the same fragment on publish;
// this is the writing half of one grammar, which is why it is a file of its own rather than
// a private corner of the node view: it is pure, it is the half that can be wrong in silence,
// and `image-frag.test.ts` is what holds the two halves together.
//
// EVERY THREE-VALUED SWITCH HERE HAS SILENCE AS ITS THIRD VALUE. '' is not `asis`, not `cap`,
// not `none`: it means this picture has no opinion and follows Settings. That is what an
// imported archive carries, and it is why one screen can restyle thirty galleries at once.
// Keeping a way BACK to it matters as much as the explicit choices, or the first click pins
// a picture forever.

export type Align = 'left' | 'center' | 'right'
export type Ratio = '' | 'asis' | '1x1' | '3x2' | '4x3'
export type Caption = '' | 'cap' | 'nocap'
export type GridOpts = { ratio: Ratio; caption: Caption }

export const ALIGNS: Align[] = ['left', 'center', 'right']
export const RATIOS: Ratio[] = ['', 'asis', '1x1', '3x2', '4x3']
export const CAPTIONS: Caption[] = ['', 'cap', 'nocap']
// Ratios read the same in every language, so they are not translated. The words are.
export const RATIO_LABEL: Record<string, string> = { '1x1': '1:1', '3x2': '3:2', '4x3': '4:3' }

// Column is the unmarked default; `third` (30%, floats when aligned) and `wide` are the other
// two sizes, and they are ONE three-valued choice rather than two booleans because a figure
// cannot be 30% of the column and wider than it at once.
export type Size = '' | 'third' | 'wide'
export const SIZES: Size[] = ['', 'third', 'wide']

// The frame is a mat of paper (or of ink) around the picture. Weight is one four-valued choice
// rather than a boolean plus a size, because "framed" and "how thick" are the same decision —
// you cannot be framed at no thickness. '' follows the site; 'none' is this picture saying
// plain out loud. Both are needed the moment a site default exists to disagree with.
export type FrameWeight = '' | 'none' | 'thin' | 'frame' | 'thick'
export const FRAME_WEIGHTS: FrameWeight[] = ['', 'none', 'thin', 'frame', 'thick']
export type FrameInk = '' | 'paper' | 'ink'
export const FRAME_INKS: FrameInk[] = ['', 'paper', 'ink']
export type Frame = { weight: FrameWeight; ink: FrameInk }

export type Frag = { clean: string; align: Align; size: Size; grid: boolean } & GridOpts & Frame

/** True when there is a mat at all — `''` and `'none'` both mean no frame is drawn. */
export const framed = (w: FrameWeight): boolean => w !== '' && w !== 'none'

export function parseFrag(src: string): Frag {
  const [clean = '', frag = ''] = src.split('#')
  // Exact hyphen tokens, matching what the renderer reads. This used to test the fragment as a
  // substring, which made the editor and the public page disagree about `#bright`.
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

/** `grid` is exclusive — a gallery item ignores align and size, because the grid lays it out. */
export function buildSrc(clean: string, f: Omit<Frag, 'clean'>): string {
  // The frame rides along with EITHER shape. A gallery of framed tiles is a real thing to want,
  // and the grid still owns the layout; the frame is only the picture's own edge.
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
