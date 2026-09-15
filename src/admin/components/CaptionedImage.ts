// Custom image node: a figure with an editable caption, alignment, a size (column, 30% — which
// floats when aligned so the text runs around it — or "wide", nosing into the gutter), a frame,
// and a "grid" toggle that makes it a gallery tile. The grammar of all that is `image-frag.ts`;
// this file is the surface it is chosen on.
//
// ⚠️ A PLAIN PROSEMIRROR NODE VIEW, not a React one (ADR 0054 step 5, last of the three). It
// held no React state at all — no `useState`, no `useRef`, no `useEffect` — so nothing is lost
// in the move. What is GAINED is the wrapper: `ReactNodeViewRenderer` puts a `.react-renderer`
// div around every node view, and because a gallery tile's width has to live on the element in
// the flow, seven rules in `admin.css` reached that wrapper through `:has(> figure…)`. Those
// were the last seven `:has()` selectors in the admin, a construct that has already taken
// Safari's render process down once on another site. The figure is now the node view's own
// element, so the rules key on it directly.
import type { Node as PMNode } from 'prosemirror-model'
import { SEGMENT_TRACK, edgeAt, tabItemClass } from '@/admin-shared/tabs'
import { el } from './node-dom'
import {
  ALIGNS, CAPTIONS, FRAME_INKS, FRAME_WEIGHTS, RATIOS, RATIO_LABEL, SIZES,
  buildSrc, framed, parseFrag,
  type Align, type Caption, type Frag, type FrameInk, type FrameWeight, type GridOpts,
  type Ratio, type Size,
} from './image-frag'

/**
 * ⚠️ THE WORDS ARRIVE THROUGH `configure()`, because a node view runs inside the DOCUMENT
 * rather than inside the application: it has no React context and no dictionary. Passing them
 * in keeps all seventeen in `locales/` where the eleven languages are — the alternative is a
 * node view importing all eleven to print a toolbar.
 */
export type ImageWords = {
  alignLeft: string; alignCenter: string; alignRight: string
  sizeColumn: string; sizeWide: string
  grid: string
  siteDefault: string; ratioNatural: string
  captions: string; noCaptions: string
  frameNone: string; frameThin: string; frameMedium: string; frameThick: string
  framePaper: string; frameInk: string
  caption: string
}


/**
 * EVERY CLASS THIS NODE VIEW WRITES, IN ONE TABLE.
 *
 * ⚠️ THE NAME IS LOAD-BEARING. `check:admin-css` proves the stylesheet has a rule for every
 * class the admin writes, and it finds them by reading what follows a `className`. After a
 * QUOTE it stops at the closing quote, so only the first arm of `cond ? 'a' : 'b'` is ever
 * seen; after a BRACE it scans the whole balanced expression and collects every literal in it.
 * A table called `className` is therefore a table the guard reads whole — and a class it cannot
 * see, with no rule behind it, does nothing on a screen only the owner ever opens. That is the
 * silent failure the guard exists to catch, and it went blind on this file's two siblings once
 * already (2026-09-15).
 */
const className = {
  // The figure's shape. `img-left` and `img-wide` earned their rules in `admin.css` in the same
  // commit that made them visible here: until then the editor drew a "Large" picture exactly
  // like a column one, so the size keys offered a choice the writing surface did not show.
  figure: 'my-4',
  grid: 'img-grid',
  wide: 'img-wide',
  third: 'img-third',
  left: 'img-left',
  centre: 'img-center',
  right: 'img-right',
  // The toolbar. A tile's bar leaves the cell (`qi-tile-bar`); a lone picture's does not.
  bar: 'mb-2 flex flex-wrap gap-2',
  tileBar: 'qi-tile-bar mb-2 flex flex-wrap gap-2',
  // The picture, and the mat drawn around it — the same padding-on-the-img trick the public
  // sheet uses, so choosing a weight is a decision you can see. The colours are the admin's
  // own: this previews the SHAPE, and on the site the mat takes the reader's paper colour,
  // which the admin has no token for.
  picture: 'w-full rounded-lg',
  picked: 'ring-2 ring-neutral-900 dark:ring-white',
  matThin: 'p-2',
  matMedium: 'p-4',
  matThick: 'p-7',
  matPaper: 'border border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-900',
  matInk: 'border border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100',
  // The caption. Still editable with captions switched off: it is the alt text, so it keeps
  // working for screen readers and for search, it just does not print under the photo.
  caption: 'mt-1.5 w-full border-0 bg-transparent text-center text-sm outline-none'
    + ' placeholder:text-neutral-300 dark:placeholder:text-neutral-600',
  captionOn: 'text-neutral-500 dark:text-neutral-400',
  captionOff: 'text-neutral-300 dark:text-neutral-600',
}

/** ONE ELEMENT, REDRAWN — `dom` is the figure itself, and ProseMirror holds that reference. */
export class ImageView {
  readonly dom: HTMLElement
  private readonly bar: HTMLElement
  private readonly pic: HTMLImageElement
  private readonly cap: HTMLInputElement
  private node: PMNode
  private selected = false
  /** What the toolbar was last drawn for, so a caption keystroke does not rebuild it. */
  private barFor: string | null = null

  constructor(node: PMNode, private readonly words: ImageWords) {
    this.node = node
    this.dom = el('figure')
    this.dom.setAttribute('data-drag-handle', '')

    this.bar = el('div')
    this.bar.contentEditable = 'false'
    // The bar belongs to the chrome, not to the document: a mousedown that reached ProseMirror
    // would move the selection out of the node whose toolbar is being pressed.
    this.bar.addEventListener('mousedown', (e) => e.preventDefault())

    this.pic = el('img')
    this.cap = el('input', { className: className.caption, type: 'text' })
    this.cap.contentEditable = 'false'
    this.cap.placeholder = words.caption
    this.cap.addEventListener('input', () => this.attrs({ alt: this.cap.value }))
    // Typing in the caption is typing in a field, not in the document: without this every
    // keystroke also reaches ProseMirror, which reads it as an edit at the node's position.
    this.cap.addEventListener('keydown', (e) => e.stopPropagation())

    this.dom.append(this.bar, this.pic, this.cap)
    this.paint()
  }

  /** Set by the extension, which is the only place that can reach `getPos`. */
  attrs: (next: Record<string, unknown>) => void = () => {}
  gallery: (opts: Partial<GridOpts>) => void = () => {}

  private set(f: Frag, next: Partial<Omit<Frag, 'clean'>>): void {
    this.attrs({ src: buildSrc(f.clean, { ...f, ...next }) })
  }

  /**
   * ⚠️ ONE STATEMENT PER SHAPE, and the reason is the guard again: a second class list inside
   * the same ternary is a class list `check:admin-css` never reads. The align class is written
   * only where the editor has a rule for it — at column and at full width the sheet says
   * nothing about alignment, and a class with no rule is the thing being guarded against.
   */
  private shape(f: Frag): void {
    if (f.grid) { this.dom.className = `${className.figure} ${className.grid}`; return }
    if (f.size === 'wide') { this.dom.className = `${className.figure} ${className.wide}`; return }
    if (f.size !== 'third') { this.dom.className = className.figure; return }
    const side = f.align === 'left' ? className.left
      : f.align === 'right' ? className.right : className.centre
    this.dom.className = `${className.figure} ${side} ${className.third}`
  }

  /** A segmented control: one track, one button per value, the pressed one marked. */
  private group<T>(
    values: readonly T[], current: T, label: (v: T) => string, pick: (v: T) => void,
  ): HTMLElement {
    const track = el('div', { className: SEGMENT_TRACK })
    for (const [i, v] of values.entries()) {
      const key = el('button', {
        className: tabItemClass(v === current, 'sm', false, 'choice', edgeAt(i, values.length)),
        type: 'button',
        // The server's own `tabs()` says this and the React node view never did: a segmented
        // control whose pressed state is only a background colour is a control a screen reader
        // cannot report.
        'aria-pressed': String(v === current),
      })
      key.textContent = label(v)
      key.addEventListener('click', () => pick(v))
      track.appendChild(key)
    }
    return track
  }

  private fillBar(f: Frag): void {
    const w = this.words
    const groups: HTMLElement[] = f.grid
      // In a gallery: how the tiles are cropped, whether captions show, and the way out. Align
      // and size do not apply, because the grid decides them. Both of these act on the whole
      // run rather than on the selected tile, because they are properties of the gallery.
      ? [
        this.group(RATIOS, f.ratio,
          (r: Ratio) => r === '' ? w.siteDefault
            : r === 'asis' ? w.ratioNatural : RATIO_LABEL[r] ?? r,
          (r) => this.gallery({ ratio: r })),
        this.group(CAPTIONS, f.caption,
          (c: Caption) => c === '' ? w.siteDefault : c === 'cap' ? w.captions : w.noCaptions,
          (c) => this.gallery({ caption: c })),
      ]
      : [
        this.group(ALIGNS, f.align,
          (a: Align) => a === 'left' ? w.alignLeft : a === 'center' ? w.alignCenter : w.alignRight,
          (a) => this.set(f, { align: a, grid: false })),
        // 30% is not translated: a percentage reads the same in every language, the same
        // argument `RATIO_LABEL` already makes for 1:1 and 3:2.
        this.group(SIZES, f.size,
          (s: Size) => s === '' ? w.sizeColumn : s === 'third' ? '30%' : w.sizeWide,
          (s) => this.set(f, { size: s, grid: false })),
      ]

    // In or out of the gallery. One button, pressed when this picture is a tile.
    groups.push(this.group([true], f.grid, () => w.grid, () => this.set(f, { grid: !f.grid })))

    // The frame, and it is deliberately LAST in both shapes: it is the only choice here that
    // does not move the picture, so it reads as trim rather than as layout. Ink is a separate
    // toggle rather than a fifth weight, because the mat's colour and its thickness are two
    // questions.
    groups.push(this.group(FRAME_WEIGHTS, f.weight,
      (v: FrameWeight) => v === '' ? w.siteDefault
        : v === 'none' ? w.frameNone
          : v === 'thin' ? w.frameThin
            : v === 'frame' ? w.frameMedium : w.frameThick,
      // Turning the frame off takes the mat's colour with it: there is no mat left for it to
      // describe, and a stale `ink` would surprise whoever framed the picture again later.
      (v) => this.set(f, { weight: v, ink: framed(v) ? f.ink : '' })))
    if (framed(f.weight)) {
      groups.push(this.group(FRAME_INKS, f.ink,
        (v: FrameInk) => v === '' ? w.siteDefault : v === 'paper' ? w.framePaper : w.frameInk,
        (v) => this.set(f, { weight: framed(f.weight) ? f.weight : 'frame', ink: v })))
    }
    this.bar.replaceChildren(...groups)
  }

  private paint(): void {
    const f = parseFrag((this.node.attrs.src as string) || '')
    this.shape(f)

    this.bar.hidden = !this.selected
    // THE TOOLBAR MUST NOT BE AS NARROW AS THE TILE. In a gallery the node view IS a grid cell
    // — 202px on a 1440px screen, 102px on a phone — and this bar carries up to seventeen
    // buttons in five segmented groups, each `w-fit max-w-full overflow-hidden`. So the
    // overflow was not a squeeze but a CLIP: measured 2026-08-28, five of fourteen buttons on
    // a desktop and ten of fourteen on a phone were cut off and unclickable, and the ones that
    // went were the choices. A selected tile's bar leaves the cell and lays itself out against
    // the writing column instead.
    if (f.grid) this.bar.className = className.tileBar
    else this.bar.className = className.bar
    // Rebuilt only when something it draws has changed. A caption keystroke is a transaction
    // and every transaction repaints, so redrawing here would throw away the keyboard focus of
    // anybody tabbing through the toolbar, once per character.
    const key = this.selected
      ? `${f.grid}|${f.align}|${f.size}|${f.ratio}|${f.caption}|${f.weight}|${f.ink}`
      : ''
    if (key !== this.barFor) {
      this.barFor = key
      if (this.selected) this.fillBar(f)
      else this.bar.replaceChildren()
    }

    this.pic.src = f.clean
    this.pic.alt = (this.node.attrs.alt as string) || ''
    // The crop is shown here too, so choosing a ratio is a decision you can see rather than one
    // you take on trust and check on the live site.
    const cropped = f.grid && f.ratio !== '' && f.ratio !== 'asis'
    this.pic.style.aspectRatio = cropped ? f.ratio.replace('x', ' / ') : ''
    this.pic.style.objectFit = cropped ? 'cover' : ''
    const pad = f.weight === 'thin' ? className.matThin
      : f.weight === 'frame' ? className.matMedium
        : f.weight === 'thick' ? className.matThick : ''
    const mat = !framed(f.weight) ? '' : f.ink === 'ink' ? className.matInk : className.matPaper
    this.pic.className = [className.picture, pad, mat, this.selected ? className.picked : '']
      .filter(Boolean).join(' ')

    this.cap.className = `${className.caption} ${
      f.grid && f.caption === 'nocap' ? className.captionOff : className.captionOn}`
    // ⚠️ THE VALUE IS ONLY PUSHED IN WHEN THE FIELD IS NOT BEING TYPED IN. Writing it on every
    // paint would move the caret to the end on every keystroke, because each keystroke is a
    // transaction and every transaction repaints.
    if (document.activeElement !== this.cap) this.cap.value = this.pic.alt
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.paint()
    return true
  }

  selectNode(): void { this.selected = true; this.paint() }
  deselectNode(): void { this.selected = false; this.paint() }

  /**
   * ⚠️ ONLY THE TOOLBAR'S AND THE CAPTION'S EVENTS ARE THE VIEW'S. `true` for everything is a
   * bug with a shape this project has already paid for: a click on the PICTURE has to reach
   * ProseMirror, because that click is what selects the node — and selecting it is what shows
   * the toolbar. Swallow it and the picture can be looked at and never changed. The maths node
   * lost its editing box to exactly that, one day before this was written, and every unit test
   * passed while it was broken: attributes, serializers and input rules are all reachable
   * without a pointer.
   */
  stopEvent(e: Event): boolean {
    const target = e.target as globalThis.Node | null
    return this.bar.contains(target) || this.cap.contains(target)
  }

  /** The toolbar, the picture and the caption are drawn here; ProseMirror must not read back. */
  ignoreMutation(): boolean { return true }
}
