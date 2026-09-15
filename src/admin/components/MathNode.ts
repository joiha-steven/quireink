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
import type { Node as PMNode } from 'prosemirror-model'
import { renderMath } from '@/render/math'

export type MathWords = { placeholder: string }


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
export class MathView {
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
