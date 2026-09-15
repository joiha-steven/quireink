// WHICH OF THE FORTY PENS THE WRITER SEES.
//
// The published page deals every stroke a variant of its own: `md/html.ts` hashes the
// gesture's Markdown source (`pen/grammar.ts`, `penSeed`) into `data-pen="0".."79"`, and the
// forty grips and their dies in `pen/ink.css.ts` make one hand that never repeats itself.
//
// The editor had none of it. Nothing in `src/admin` ever wrote `data-pen` — the attribute
// does not exist in the whole history of this directory — so every stroke in the writing
// surface fell back to the four `var(--x, default)` values at the foot of `ink.css.ts`: ONE
// pen, forty times, while the page under the same words dealt forty. Found on 2026-09-14 by
// the underline sitting through the middle of the letters in the editor and at their feet on
// the page; the fallback was the cause of both.
//
// ⚠️ THE SEED IS A VIEW CONCERN, NOT A DOCUMENT ONE, and that is the whole shape of this
// file. Putting the number in the mark's attributes would have been shorter and is wrong
// twice over: ProseMirror compares marks BY their attributes, so two neighbouring strokes
// dealt different pens would stop being one mark and save as `==a====b==` — which reads back
// as a single stroke over `a====b`, losing a gesture in silence. And `from-editor.ts` groups
// runs by `JSON.stringify(attrs)`, so the same difference would re-cut every run. The page
// does not store the number either; it computes it at render time from the source. This does
// the same thing, against the DOM, at draw time.
//
// The same seam `pen-feedback.ts` sits on, for the same reason (ADR 0049): nothing here is a
// transaction, nothing is in the undo history, and a save cannot see it.

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { DOMSerializer, type Mark } from 'prosemirror-model'
import type { MarkView } from 'prosemirror-view'
import { penSeed } from '@/pen/grammar'

/** Every stroke the writing surface can be holding. `<u>` is the underline; `<mark>` is both
 *  the highlighter and — with `data-form="o"` — the ring. */
const STROKES = 'mark,u'

/**
 * The little of the editor view this file reads, as a shape rather than the class.
 *
 * TWO COPIES OF `prosemirror-view` ARE INSTALLED — 1.42.3 at the root and 1.42.2 nested under
 * `prosemirror-state` — and `EditorView` carries a private field, so TypeScript calls them
 * different classes. `FindExtension.ts` answers that with one derived cast; three properties
 * are few enough to simply name, and naming them also says what a test has to stand in for.
 */
type Surface = {
  dom: HTMLElement
  state: { selection: { from: number; to: number } }
  domAtPos: (pos: number) => { node: Node; offset: number }
}

/**
 * A drawn stroke read back as the Markdown it came from, because that is what is hashed.
 *
 * `penSeed` takes the gesture's SOURCE, fences and colour suffix and all, so `==a==` and the
 * word `a` are different pens. The three fences and the `#colour` rule are the same ones
 * `to-markdown.ts` writes with, and the attributes are the ones the marks render: no
 * `data-ink` means yellow for a highlight and graphite or red for the two line gestures, and
 * in all three cases the source carries no suffix either.
 *
 * ONE SHAPE DIFFERS FROM THE PAGE, on purpose: a stroke drawn across emphasis, a link, code
 * or a formula hashes here from the WORDS (`==a b c==`) and on the page from the SOURCE
 * (`==a **b** c==`), because the element holds text and the engine holds Markdown. Such a
 * stroke is dealt a DIFFERENT one of the forty rather than a wrong one — the grip changes,
 * the gesture does not — and the exact answer would mean serializing a slice of the document
 * on every draw, in the one loop this editor has already been bitten for the cost of.
 *
 * Measured on the live pages 2026-09-14, parsed rather than pattern-matched: 171 strokes
 * across 120 pages, 6 of them carrying markup, all six in one post. So 165 agree exactly.
 */
export function penRawOf(el: Element): string {
  const fence = el.tagName === 'U' ? '++' : el.getAttribute('data-form') === 'o' ? '@@' : '=='
  const ink = el.getAttribute('data-ink')
  return `${fence}${el.textContent ?? ''}${fence}${ink ? `#${ink}` : ''}`
}

/** The stroke the caret or the selection is standing in, or null. */
function underTheHand(view: Surface): Element | null {
  const { from, to } = view.state.selection
  for (const pos of from === to ? [from] : [from, to]) {
    let node: Node | null = null
    try { node = view.domAtPos(pos).node } catch { continue }
    const el = (node instanceof Element ? node : node?.parentElement)?.closest(STROKES)
    if (el) return el
  }
  return null
}

/**
 * Deal every stroke its pen. Returns how many changed hands, for the tests.
 *
 * THE STROKE BEING WRITTEN IN IS LEFT ALONE. Its seed is a hash of its own words, so every
 * keystroke inside a highlight would deal it a new grip — up to 0.22em of height and a
 * different die, four pixels of the stroke jumping under the cursor on each letter. That is
 * the one thing the editor's motion rules forbid, so a stroke keeps the pen it was dealt
 * while the hand is on it and settles to the page's the moment the caret leaves. A stroke
 * with no pen at all is dealt one even under the hand: the alternative is the fallback, and
 * the fallback is the single pen this file exists to end.
 */
export function dealPens(view: Surface): number {
  const held = underTheHand(view)
  let changed = 0
  for (const el of view.dom.querySelectorAll(STROKES)) {
    const has = el.getAttribute('data-pen')
    if (el === held && has !== null) continue
    const want = String(penSeed(penRawOf(el)))
    if (has === want) continue
    el.setAttribute('data-pen', want)
    changed++
  }
  return changed
}

/**
 * The mark's own DOM, plus the one thing the default rendering cannot say.
 *
 * ProseMirror watches the editable DOM for changes it did not make, and an attribute written
 * on a `<mark>` reads as one: it dirties the range and the next flush re-parses that stretch
 * of document out of the DOM. Harmless in the end and pure waste every time. A mark view is
 * the documented place to say otherwise — `MarkViewDesc` asks `spec.ignoreMutation` first —
 * so the element is built exactly as `renderHTML` would build it and given that one answer.
 *
 * ATTRIBUTES ONLY. A browser does not put attributes on a `<mark>`; this file and
 * `pen-feedback.ts` are the only writers, and both write attributes. Ignoring more than that
 * would mean ignoring the childList and characterData mutations an IME makes mid-composition,
 * which is how input goes missing.
 */
function penMarkView(mark: Mark, _view: unknown, inline: boolean): MarkView {
  const spec = mark.type.spec.toDOM?.(mark, inline)
  if (!spec) throw new Error(`the ${mark.type.name} mark has no toDOM`)
  const { dom, contentDOM } = DOMSerializer.renderSpec(document, spec)
  return { dom, contentDOM, ignoreMutation: (m) => m.type === 'attributes' }
}

export const PenDeal = Extension.create({
  name: 'quirePenDeal',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('quirePenDeal'),
        props: { markViews: { ink: penMarkView, underline: penMarkView, ring: penMarkView } },
        // `update` runs after the view has redrawn, so the strokes a transaction produced
        // are already in the DOM and no frame has to be waited for. Nothing is scheduled and
        // nothing is remembered between calls: the attribute in the DOM is the state.
        view: (view) => {
          dealPens(view)
          return { update: () => { dealPens(view) } }
        },
      }),
    ]
  },
})
