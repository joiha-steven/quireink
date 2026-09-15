// Mathematics, in the editor.
//
// THIS FILE IS NOT A NICETY, which is worth saying because it looks like one: the server half in
// `render/math.ts` renders formulas perfectly well without it. What it does not do is survive
// the editor. Measured on the real extension set before a line of this was written, opening a
// post and saving it again did:
//
//     $$M \times V = P \times Q$$   ->   $$M \\times V = P \\times Q$$
//     \(a_1 + b_2\)                 ->   (a_1 + b_2)
//
// The first doubles every backslash, so the formula stops parsing. The second is worse:
// markdown-it's `escape` rule reads `\(` as an escaped parenthesis and eats the delimiters, so
// the formula is not damaged but GONE, with no way to tell from the saved file that it was ever
// maths. Neither throws. Both corrupt the author's source on a save they did not know was a
// rewrite.
//
// So the editor has to know the grammar — but it does not restate it: `render/math.ts` owns it
// and this calls `matchMathAt` / `matchDisplayBlockAt`, the same discipline `InkMark.ts`
// follows, and for the same reason.
import { Node, InputRule, type NodeViewRenderer } from '@tiptap/core'
import type { Node as PMNode } from 'prosemirror-model'
import {
  renderMath, type MathDelim,
  INLINE_PAREN_SOURCE, DISPLAY_DOLLAR_SOURCE, DISPLAY_BRACKET_SOURCE,
} from '@/render/math'

export type MathWords = { placeholder: string }

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    math: {
      /** Drop a formula in at the cursor, display or inline, ready to be typed into. */
      setMath: (display: boolean, tex?: string) => ReturnType
    }
  }
}

/**
 * What a formula looks like while you are writing it.
 *
 * Rendered, not shown as source, because the argument the pen makes applies here twice over: a
 * stroke you cannot see is one you cannot place, and a formula you cannot see is one you cannot
 * check. A misplaced brace in `\frac{a}{b}` is invisible in the source and obvious the moment it
 * is set. Selecting the node swaps in the TeX so it can be corrected, and the same `renderMath`
 * the server uses draws it — one function, so the writing surface cannot show something the
 * published page will not.
 *
 * ⚠️ A PLAIN PROSEMIRROR NODE VIEW (ADR 0054 step 5). It was the only one of the three with real
 * React state — a `draft` mirroring the TeX so the `<input>` could be controlled — and that
 * state disappears here rather than being ported: a DOM input holds its own value, so the
 * double-write of `setDraft` AND `updateAttributes` collapses into the second one.
 */
class MathView {
  readonly dom: HTMLElement
  private readonly box: HTMLInputElement
  private readonly shown: HTMLElement
  private node: PMNode
  private selected = false

  constructor(node: PMNode, private readonly words: MathWords) {
    this.node = node
    const display = node.attrs.display as boolean
    this.dom = document.createElement(display ? 'div' : 'span')
    this.dom.className = display ? 'my-4 block' : 'inline-block'
    this.box = document.createElement('input')
    this.box.className = 'w-full rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1'
      + ' font-mono text-sm text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800'
      + ' dark:text-neutral-100'
    this.box.placeholder = words.placeholder
    this.box.spellcheck = false
    this.box.addEventListener('input', () => this.attrs({ tex: this.box.value }))
    // Typing in the box is typing in a field, not in the document: without this every keystroke
    // also reaches ProseMirror, which reads it as an edit at the node's position.
    this.box.addEventListener('keydown', (e) => e.stopPropagation())
    this.shown = document.createElement('span')
    this.dom.append(this.box, this.shown)
    this.paint()
  }

  private paint(): void {
    const tex = ((this.node.attrs.tex as string) || '')
    const display = this.node.attrs.display as boolean
    this.box.hidden = !this.selected
    this.shown.hidden = this.selected
    // ⚠️ THE VALUE IS ONLY PUSHED IN WHEN THE BOX IS NOT BEING TYPED IN. Writing it on every
    // paint would move the caret to the end on every keystroke, because each keystroke is a
    // transaction and every transaction repaints.
    if (document.activeElement !== this.box) this.box.value = tex
    if (this.selected) return
    this.shown.className = display && tex.trim() ? 'block overflow-x-auto text-center' : ''
    if (tex.trim()) {
      // The MathML comes from `renderMath`, which builds it from the TeX with Temml and escapes
      // its own fallback. Nothing here is reader-supplied: the only person who can put TeX into
      // a post is the signed-in owner.
      this.shown.innerHTML = renderMath(tex, display)
    } else {
      this.shown.className = 'text-sm text-neutral-400'
      this.shown.textContent = this.words.placeholder
    }
  }

  /** Set by the extension, which is the only place that can reach `getPos`. */
  attrs: (next: Record<string, unknown>) => void = () => {}

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.paint()
    return true
  }

  /**
   * Selecting an empty formula — the toolbar has just inserted one — should put the caret in
   * the box rather than make the writer click it as well.
   */
  selectNode(): void {
    this.selected = true
    this.paint()
    this.box.focus()
  }

  deselectNode(): void { this.selected = false; this.paint() }

  /**
   * ⚠️ ONLY WHAT HAPPENS INSIDE THE BOX IS THE VIEW'S, and `true` for everything was a bug that
   * made the formula uneditable. A click on the RENDERED maths has to reach ProseMirror, because
   * that click is what selects the atom — and `selectNode` is what swaps the box in. Swallowing
   * it meant the box never appeared, so a formula could be read and never corrected. Every unit
   * test passed: the node's attributes, its serializer and its input rules are all reachable
   * without a pointer. Found by clicking one (2026-09-15).
   */
  stopEvent(e: Event): boolean {
    // `globalThis.Node`, because `Node` in this file is Tiptap's extension class. Written bare
    // it type-checks against the wrong Node and the test is always false.
    return this.box.contains(e.target as globalThis.Node | null)
  }

  ignoreMutation(): boolean { return true }
}

/**
 * A typing rule that swallows the WHOLE match, delimiters included.
 *
 * Tiptap ships `nodeInputRule` and it is the wrong tool here, which is not obvious until it
 * is measured: it replaces only capture group 1 and leaves everything around it standing. So
 * typing `\(x^2\)` produced a correct formula node with `\(` and `\)` still sitting either
 * side of it, and the post saved as `\(\(x^2\)\)`. With `$$…$$` it was worse — the block node
 * split the paragraph and the stray dollars became two paragraphs of their own.
 *
 * `range` is the span of `match[0]`, so deleting it first is what makes the delimiters go.
 */
const mathInputRule = (find: RegExp, name: string, display: boolean, delim: MathDelim) =>
  new InputRule({
    find,
    handler: ({ range, match, chain }) => {
      const tex = (match[1] ?? '').trim()
      // An empty pair (`$$$$`) is someone typing, not a formula. Leave the characters alone.
      if (!tex) return null
      chain().deleteRange(range).insertContent({ type: name, attrs: { tex, display, delim } }).run()
      return undefined
    },
  })

/** Everything both nodes share; only `inline`/`group` and the default delimiter differ. */
const common = {
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      tex: { default: '' },
      display: { default: false },
      delim: { default: 'dollar' as MathDelim },
    }
  },
  addOptions() {
    return { words: { placeholder: 'LaTeX formula' } as MathWords }
  },
  addNodeView(this: { options: { words: MathWords } }): NodeViewRenderer {
    const words = this.options.words
    return ({ node, editor, getPos }) => {
      const view = new MathView(node, words)
      view.attrs = (next) => {
        const pos = getPos?.()
        if (pos == null) return
        const at = editor.view.state.doc.nodeAt(pos)
        if (!at) return
        editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, { ...at.attrs, ...next }))
      }
      return view
    }
  },
}

const parseAttrs = (el: HTMLElement) => ({
  tex: el.getAttribute('data-tex') || '',
  display: el.getAttribute('data-math') !== 'inline',
  delim: (el.getAttribute('data-delim') || 'dollar') as MathDelim,
})

export const MathInline = Node.create({
  ...common,
  name: 'mathInline',
  inline: true,
  group: 'inline',
  parseHTML() {
    return [{ tag: 'span[data-math]', getAttrs: (el) => parseAttrs(el as HTMLElement) }]
  },
  renderHTML({ node }) {
    return ['span', {
      'data-math': node.attrs.display ? 'display' : 'inline',
      'data-tex': node.attrs.tex,
      'data-delim': node.attrs.delim,
    }]
  },
  /**
   * Typing `\(x\)` sets it on the spot. `$…$` DELIBERATELY DOES NOT, and the asymmetry is
   * the point.
   *
   * An input rule fires on the text already typed, so it cannot see the character coming
   * next — and the third of Pandoc's guards, "the closing `$` must not be followed by a
   * digit", is a lookahead at exactly that character. Type `giá $5-$8` and at the instant
   * the second `$` lands the rule sees `$5-$`, whose content ends on a non-space and so
   * passes both guards it CAN check. The price would turn into a formula under the writer's
   * hands, and the guard that exists to stop it has not been given its evidence yet.
   *
   * The renderer has no such problem: it reads a finished document. So `$…$` stays valid
   * everywhere and simply is not a typing gesture — it converts when the post is next
   * opened, through the markdown-it rule above, where the whole line is known.
   */
  addInputRules() {
    return [
      mathInputRule(new RegExp(`${INLINE_PAREN_SOURCE}$`), this.name, false, 'paren'),
    ]
  },

  addCommands() {
    return {
      setMath:
        (display, tex = '') =>
        ({ commands }) =>
          commands.insertContent({
            type: display ? 'mathBlock' : 'mathInline',
            attrs: { tex, display, delim: display ? 'dollar' : 'dollar' },
          }),
    }
  },
})

export const MathBlock = Node.create({
  ...common,
  name: 'mathBlock',
  group: 'block',
  draggable: true,
  // A block node is display maths by definition; the shared default is the inline one.
  addAttributes() {
    return { tex: { default: '' }, display: { default: true }, delim: { default: 'dollar' as MathDelim } }
  },

  /** `$$…$$` on its own is safe to fire on: two dollars in a row are never a price. */
  addInputRules() {
    return [
      mathInputRule(new RegExp(`${DISPLAY_DOLLAR_SOURCE}$`), this.name, true, 'dollar'),
      mathInputRule(new RegExp(`${DISPLAY_BRACKET_SOURCE}$`), this.name, true, 'bracket'),
    ]
  },
  parseHTML() {
    return [{ tag: 'div[data-math]', getAttrs: (el) => parseAttrs(el as HTMLElement) }]
  },
  renderHTML({ node }) {
    return ['div', { 'data-math': 'block', 'data-tex': node.attrs.tex, 'data-delim': node.attrs.delim }]
  },
})
