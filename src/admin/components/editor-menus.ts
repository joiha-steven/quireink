// The two menus that open AT THE WRITING rather than standing over it:
//  - the slash menu: the inserts, opened at the caret by typing "/" on an empty line.
//  - the bubble bar: a floating menu on a text selection, or with the cursor inside a link.
// The fixed button strip is next door in `editor-toolbar.ts`.
//
// ⚠️ PLAIN TYPESCRIPT, not React (ADR 0054 step 5): the editor is a client-side APPLICATION and
// builds its own chrome. The words arrive as the admin's whole dictionary rather than a mapped
// subset, and that is deliberate here where it was not for the node views: the five pens are
// named by a COMPUTED key (`ink` + the ink's name), so a fixed list of fields could not reach
// them. The type is erased at compile time and nothing extra ships.
import type { Editor } from '@/admin/editor/editor'
import { bubblePlugin, BUBBLE_KEY } from '@/admin/editor/bubble'
import { NodeSelection } from 'prosemirror-state'
import type { SheetWords } from '@/admin-shared/sheet-wire'
import { DEFAULT_INK, INKS } from '@/pen/grammar'
import { PEN_LIGHT } from '@/pen/pigments'
import { el } from './node-dom'
import { editLink } from './editor-link'
import { tip } from './editorKeys'

/** Named, because unregistering a plugin needs the same key registering it used. */

const className = {
  // The floating bar. z-40, ABOVE the sticky toolbar's z-10: flipping keeps them apart in most
  // cases, and when a selection spans the seam anyway, the bar the writer is reaching for wins.
  // `flex-wrap` and a viewport-bounded width. The bar had neither: 411px of buttons on a 375px
  // phone, `nowrap`, with the Link button off the right edge and unreachable — measured. 32rem
  // because the row MEASURES 487px with the headings on it; 30rem was tried and folded a
  // desktop that had the room. A phone takes the `100vw` half.
  bar: 'z-40 flex max-w-[min(32rem,calc(100vw-1.5rem))] flex-wrap items-center gap-0.5'
    + ' rounded-lg border border-neutral-200 bg-white p-1 shadow-lg'
    + ' dark:border-neutral-700 dark:bg-neutral-800',
  key: 'rounded-md px-2 py-1 text-sm',
  keyOn: 'bg-neutral-200 text-neutral-900 shadow-[inset_0_1.5px_2px_rgba(0,0,0,.16)]'
    + ' dark:bg-neutral-700 dark:text-white dark:shadow-[inset_0_1.5px_2px_rgba(0,0,0,.5)]',
  keyOff: 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700',
  mono: 'font-mono',
  small: 'text-xs font-semibold',
  ringGlyph: 'inline-block rounded-full border border-current px-1 leading-tight',
  rule: 'mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700',
  // The pens.
  swatch: 'grid h-6 w-6 place-items-center rounded-md',
  swatchOn: 'ring-2 ring-neutral-400 dark:ring-neutral-300',
  swatchOff: 'hover:bg-neutral-100 dark:hover:bg-neutral-700',
  ink: 'block h-3.5 w-3.5 rounded-[2px]',
  // The slash menu.
  menu: 'scroll-fade fixed z-40 max-h-[360px] w-64 overflow-y-auto rounded-lg border'
    + ' border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800',
  row: 'flex w-full items-baseline justify-between gap-4 rounded-md px-3 py-1.5 text-left text-sm'
    + ' text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700',
  hint: 'shrink-0 font-mono text-xs text-neutral-500 dark:text-neutral-400',
  divider: 'my-1 block h-px w-full bg-neutral-100 dark:bg-neutral-700',
}

/**
 * The five pens, READ from `pen/pigments.ts` rather than typed out. All five were written a
 * second time once, and a swatch that is a near-miss of the ink it applies is the worst kind of
 * wrong: it looks deliberate. The `#` is added here because CSS wants it and the stroke wants
 * the bare hex.
 */
const PEN: Record<string, string> = Object.fromEntries(
  Object.entries(PEN_LIGHT).map(([ink, hex]) => [ink, `#${hex}`]),
)

/** `yellow` -> the owner's word for yellow. The same lookup the settings screen uses. */
function inkName(t: SheetWords, ink: string): string {
  // The five are NAMED in the subset the sheet ships (`SHEET_WORD_KEYS`) precisely because this
  // lookup is computed: a key built at runtime cannot be seen by a type, and a dictionary that
  // no longer carries it would fail here rather than at the compiler.
  return t[`ink${ink[0]!.toUpperCase()}${ink.slice(1)}` as 'inkYellow']
}

// Keep the selection while clicking: a mousedown would otherwise blur the editor and collapse
// it before the command runs.
const hold = (e: Event): void => e.preventDefault()

export type BubbleBar = {
  /** The sticky band's height is measured at runtime, so it arrives after the bar is built. */
  setAvoidTop: (px: number) => void
  destroy: () => void
}

export function mountBubbleBar(
  editor: Editor,
  t: SheetWords,
  askLink: (previous: string) => Promise<string | null>,
): BubbleBar {
  const bar = el('div', { className: className.bar })
  // ⚠️ NOTHING HERE DECIDES WHETHER IT IS ON SCREEN, and it used to decide half of it: this
  // file set `visibility: hidden` and `position: absolute` because the package that positioned
  // the bar toggled `visibility` and placed it with a transform. `editor/bubble.ts` owns both
  // now and hides it with the `hidden` attribute — so leaving the old pair here left the bar
  // permanently invisible while every measurement said it was fine. Two mechanisms deciding one
  // `display` is one too many (`docs/admin-one-dom.md`); this is the same fault a rung up.

  /** Every key that can look pressed, so one pass answers for all of them. */
  const lit: { on: () => boolean; button: HTMLButtonElement; extra: string; announce: boolean }[] = []

  /**
   * ⚠️ `title` IS THE NAME; `aria-label` IS THE NAME PLUS ITS CHORD, and they are not
   * interchangeable. The glyph inside is the accessible name otherwise — content beats `title`
   * when a browser computes one — so this bar announced "B", "I", "O" instead of Bold, Italic
   * and Ring a word, while the tooltip a mouse could see said the right thing all along. Getting
   * the pair the wrong way round puts the chord in the tooltip, where it is noise, and takes it
   * out of the one place a keyboard user would hear it.
   *
   * `aria-pressed` is written only where the React bar wrote it: on the three headings and the
   * five inks. A bar where everything announces "not pressed" is noise.
   */
  const key = (
    label: string, aria: string | null, face: Node | string, run: () => void,
    on?: () => boolean, extra = '', announce = false,
  ): HTMLButtonElement => {
    // Every button names itself with `aria-label` as well as `title`, and the two must stay
    // together. The glyph inside is the accessible name otherwise — content beats `title` when
    // a browser computes one — so this bar announced "B", "I", "O" instead of Bold, Italic and
    // Ring a word, while the tooltip a mouse could see said the right thing all along.
    const button = el('button', { className: className.key, type: 'button', title: label })
    if (aria !== null) button.setAttribute('aria-label', aria)
    if (typeof face === 'string') button.textContent = face
    else button.appendChild(face)
    if (extra) button.classList.add(extra)
    button.addEventListener('mousedown', hold)
    button.addEventListener('click', run)
    if (on) lit.push({ on, button, extra, announce })
    bar.appendChild(button)
    return button
  }
  const tag = (name: 'strong' | 'em' | 'u' | 's' | 'span', text: string, cls?: string): Node => {
    const node = el(name, cls ? { className: cls } : {})
    node.textContent = text
    return node
  }
  const chain = () => editor.chain().focus()

  key(t.tbBold, tip(t.tbBold, 'bold'), tag('strong', 'B'), () => chain().toggleBold().run(), () => editor.isActive('bold'))
  key(t.tbItalic, tip(t.tbItalic, 'italic'), tag('em', 'I'), () => chain().toggleItalic().run(), () => editor.isActive('italic'))
  // THREE LEVELS, not one. A single `H` was hard-wired to H2 because the deeper levels "live
  // behind / and their `#` shortcuts" — and neither reaches the case this bar is FOR: the slash
  // menu opens only on an EMPTY paragraph, and a selection has content. `### ` does work at the
  // start of an existing line, measured, but nobody discovers it from a toolbar. H2/H3/H4 and
  // not H1, because the post title is the H1; H5 stays with the toolbar.
  for (const level of [2, 3, 4] as const) {
    const name = `${t.tbHeading} ${level}`
    key(name, name, tag('span', `H${level}`, className.small),
      () => chain().toggleHeading({ level }).run(), () => editor.isActive('heading', { level }), '', true)
  }
  key(t.tbUnderline, tip(t.tbUnderline, 'underline'), tag('u', 'U'), () => chain().toggleUnderline().run(), () => editor.isActive('underline'))
  key(t.tbRing, tip(t.tbRing, 'ring'), tag('span', 'O', className.ringGlyph), () => chain().toggleRing().run(), () => editor.isActive('ring'))
  key(t.tbStrike, t.tbStrike, tag('s', 'S'), () => chain().toggleStrike().run(), () => editor.isActive('strike'))
  key(t.tbCodeInline, t.tbCodeInline, '</>', () => chain().toggleCode().run(), () => editor.isActive('code'), className.mono)

  bar.appendChild(el('span', { className: className.rule }))

  /**
   * The five pens, as five swatches rather than one button behind a dropdown.
   *
   * A dropdown would be one glyph instead of five, and it would be the wrong trade: choosing the
   * ink IS the gesture here, the way choosing bold is not. The swatches carry the real pigments,
   * so the bar shows the pen about to be picked up rather than a word for it. Clicking the ink
   * already on the selection lifts the pen; clicking a different one recolours in place.
   */
  const swatches: { ink: string; button: HTMLButtonElement }[] = []
  for (const ink of INKS) {
    // NAMED, and each one differently. All five carried `t.tbHighlight` and nothing else: no
    // text, no `aria-label`, five buttons with one identical name, told apart only by an inline
    // background. Anything not looking at colour — a screen reader, and anyone who cannot
    // separate those five — got five controls it could not choose between. The chord goes on the
    // DEFAULT ink only; on all five it would promise four lies.
    const name = `${t.tbHighlight}: ${inkName(t, ink)}`
    const button = el('button', {
      className: className.swatch, type: 'button',
      title: ink === DEFAULT_INK ? tip(name, 'ink') : name, 'aria-label': name,
    })
    const chip = el('span', { className: className.ink })
    chip.style.background = PEN[ink] ?? ''
    button.appendChild(chip)
    button.addEventListener('mousedown', hold)
    button.addEventListener('click', () => chain().toggleInk(ink).run())
    bar.appendChild(button)
    swatches.push({ ink, button })
  }

  bar.appendChild(el('span', { className: className.rule }))

  key(t.tbLink, null, t.tbLink, () => { void editLink(editor, askLink) }, () => editor.isActive('link'))
  // No `title` and no `aria-label` on this one: its own text is its name, which is what the
  // React bar did. A title repeating the visible words is a tooltip that says nothing.
  const unlink = key('', null, t.tbLinkRemove,
    () => chain().extendMarkRange('link').unsetLink().run())
  unlink.removeAttribute('title')

  const sync = (): void => {
    for (const { on, button, extra, announce } of lit) {
      const active = on()
      button.className = `${className.key} ${active ? className.keyOn : className.keyOff}`
      if (extra) button.classList.add(extra)
      if (announce) button.setAttribute('aria-pressed', String(active))
    }
    unlink.className = `${className.key} ${className.keyOff}`
    // The one control here that comes and goes rather than changing colour.
    unlink.hidden = !editor.isActive('link')
    const current = editor.isActive('ink') ? (editor.getAttributes('ink').ink as string) : ''
    for (const { ink, button } of swatches) {
      const active = current === ink
      button.className = `${className.swatch} ${active ? className.swatchOn : className.swatchOff}`
      button.setAttribute('aria-pressed', String(active))
    }
  }
  sync()
  editor.on('transaction', sync)

  // `flip` is not decoration: the bar sits ABOVE the selection, and the toolbar above the
  // writing surface is sticky — so selecting the FIRST line put the bar underneath it, where it
  // was both covered and unclickable, and the opening sentence of a piece could not be
  // formatted. `padding` is the height of the zone the toolbar occupies, measured and passed in;
  // inside it, Floating UI flips the bar below the selection instead.
  // How much room the sticky chrome takes at the top of the window. Read fresh on every
  // reposition rather than captured, which is what `setAvoidTop` below changes.
  let avoidTop = 0
  editor.registerPlugin(bubblePlugin({
    element: bar,
    avoidTop: () => avoidTop,
    offset: 8,
    shouldShow: ({ state, from, to }) => {
      if (editor.isActive('link')) return true // cursor in a link -> offer edit/remove
      if (from === to) return false // nothing selected
      // A node selection (image / video) carries its own controls — don't cover it.
      if (state.selection instanceof NodeSelection) return false
      return true
    },
  }))

  return {
    // The plugin reads this through a closure on every reposition, so setting it is enough and
    // nothing has to be replaced. Replacing the options object is the identity change that used
    // to loop.
    setAvoidTop: (px: number) => {
      avoidTop = px
      if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(BUBBLE_KEY, 'reposition'))
    },
    destroy: () => {
      editor.off('transaction', sync)
      editor.unregisterPlugin(BUBBLE_KEY)
      bar.remove()
    },
  }
}

export type SlashHooks = {
  editor: Editor
  t: SheetWords
  /** Viewport coordinates of the caret the "/" was typed at. */
  at: { left: number; top: number }
  onClose: () => void
  onPickImage: () => void
  onPickGallery: () => void
}

/**
 * The "/" menu: everything that puts something NEW on the page, opened at the caret by typing
 * "/" on an empty line. Each block's Markdown shortcut is printed beside its row, so the menu
 * teaches the gesture that makes itself unnecessary.
 *
 * `mousedown` is prevented THROUGHOUT: a mousedown in here would blur the editor and move the
 * caret before the command ran — the same trap the bubble bar documents.
 */
export function openSlashMenu({ editor, t, at, onClose, onPickImage, onPickGallery }: SlashHooks): () => void {
  const box = el('div', { className: className.menu, role: 'menu', 'aria-label': t.tbInsert })
  box.addEventListener('mousedown', hold)
  // Keep the menu on screen when "/" is typed near the bottom edge.
  box.style.left = `${Math.min(at.left, window.innerWidth - 280)}px`
  box.style.top = `${Math.min(at.top + 24, window.innerHeight - 380)}px`

  const chain = () => editor.chain().focus()
  // `onClose` first, matching what the React menu did: the caller drops the state that
  // opened this, and the box goes with it on the next pass.
  const run = (fn: () => void): void => { onClose(); fn() }
  const row = (label: string, act: () => void, hint?: string): void => {
    const button = el('button', { className: className.row, type: 'button', 'data-slash-row': '' })
    const name = el('span')
    name.textContent = label
    button.appendChild(name)
    if (hint) {
      const key = el('span', { className: className.hint })
      key.textContent = hint
      button.appendChild(key)
    }
    button.addEventListener('click', () => run(act))
    box.appendChild(button)
  }

  row(t.tbImage, onPickImage)
  row(t.tbGallery, onPickGallery)
  row(t.tbTable, () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())
  row(tip(t.tbCodeBlock, 'codeBlock'), () => chain().toggleCodeBlock().run(), '```')
  row(t.tbMath, () => chain().setMath(true).run())
  row(t.tbMathInline, () => chain().setMath(false).run())
  row(t.tbDivider, () => chain().setHorizontalRule().run(), '---')
  box.appendChild(el('span', { className: className.divider, 'aria-hidden': 'true' }))
  row(tip(t.tbQuote, 'blockquote'), () => chain().toggleBlockquote().run(), '>')
  row(tip(t.tbList, 'bulletList'), () => chain().toggleBulletList().run(), '-')
  row(tip(t.tbListNumbered, 'orderedList'), () => chain().toggleOrderedList().run(), '1.')
  row(tip(t.tbTask, 'taskList'), () => chain().toggleTaskList().run(), '[ ]')
  for (const level of [2, 3] as const) {
    row(`${t.tbHeading} ${level}`, () => chain().toggleHeading({ level }).run(), '#'.repeat(level))
  }

  const away = (e: MouseEvent): void => { if (!box.contains(e.target as Node)) onClose() }
  // One scroll closes it: the menu is pinned to where the caret WAS, and a menu that stays
  // behind while the page moves reads as broken.
  const scrolled = (): void => onClose()
  document.addEventListener('mousedown', away)
  document.addEventListener('scroll', scrolled, true)
  document.body.appendChild(box)

  function close(): void {
    document.removeEventListener('mousedown', away)
    document.removeEventListener('scroll', scrolled, true)
    box.remove()
  }
  return close
}
