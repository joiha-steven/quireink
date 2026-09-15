// THE FOUR NODES THAT ARE DRAWN BY CODE RATHER THAN BY A SPEC (ADR 0054 step 7).
//
// A picture with its toolbar and its caption, a video with its player, a formula that swaps
// between its source and its rendering, and a task item whose checkbox is a working control.
// None of those can be a `toDOM` array: they have their own chrome, their own listeners and, in
// three cases, a field you type into.
//
// ⚠️ THE VIEW CLASSES THEMSELVES DID NOT CHANGE. They were already plain ProseMirror node views
// — the step before this one took React out of them — and what wrapped them was a Tiptap
// `addNodeView` that did exactly what the four functions below do: build the view, and give it a
// way to write attributes back. That wrapper is what left.
import { NodeSelection } from 'prosemirror-state'
import { TableView } from 'prosemirror-tables'
import type { Node as PMNode } from 'prosemirror-model'
import type { EditorView, NodeView, NodeViewConstructor } from 'prosemirror-view'
import { ImageView } from '@/admin/components/CaptionedImage'
import { applyToGallery } from '@/admin/components/image-gallery'
import type { GridOpts } from '@/admin/components/image-frag'
import { VideoView } from '@/admin/components/VideoNode'
import { MathView } from '@/admin/components/MathNode'
import type { ImageWords } from '@/admin/components/CaptionedImage'
import type { VideoWords } from '@/admin/components/VideoNode'
import type { MathWords } from '@/admin/components/MathNode'

export type NodeWords = { image: ImageWords; video: VideoWords; math: MathWords }

/**
 * ⚠️ THE DEFAULT IS ENGLISH AND IT IS NOT DECORATION. A node view runs INSIDE the document: it
 * has no context and no dictionary, so its labels have to be handed in. Making them REQUIRED
 * would mean every caller that is not the writing sheet — fourteen test files among them —
 * building an editor with no node views at all, which is a different editor from the one the
 * writer uses. That is precisely the drift `editorExtensions.ts` was written to prevent, and it
 * carried this same default for the same reason.
 */
export const ENGLISH: NodeWords = {
  video: { column: 'Column', wide: 'Large' },
  math: { placeholder: 'LaTeX formula' },
  image: {
    alignLeft: 'Left', alignCenter: 'Center', alignRight: 'Right',
    sizeColumn: 'Column', sizeWide: 'Large',
    grid: 'Grid',
    siteDefault: 'Default', ratioNatural: 'As shot',
    captions: 'Captions', noCaptions: 'No captions',
    frameNone: 'No frame', frameThin: 'Thin', frameMedium: 'Medium', frameThick: 'Thick',
    framePaper: 'Paper', frameInk: 'Ink',
    caption: 'Image caption',
  },
}

/**
 * Write attributes back onto the node a view is drawing.
 *
 * ⚠️ READ AT CALL TIME, NOT CAPTURED. `getPos` is a function for a reason: a node view outlives
 * edits above it, and a position captured when the view was built points somewhere else by the
 * time the writer presses one of its buttons. The node's CURRENT attributes are read the same
 * way, so a second button press does not put back what the first one changed.
 */
const writer = (view: EditorView, getPos: () => number | undefined) =>
  (next: Record<string, unknown>): void => {
    const pos = getPos()
    if (pos == null) return
    const at = view.state.doc.nodeAt(pos)
    if (!at) return
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...at.attrs, ...next }))
  }

/**
 * A task item's checkbox, and the one thing that makes it a control rather than a character.
 *
 * ⚠️ `contenteditable="false"` GOES ON THE `<label>`, NOT ON THE `<input>`, and the first cut put
 * it on the input. An `<input>` is a replaced element — the attribute on it is close to a no-op
 * — while the `<label>` and the `<span>` around it inherited `contenteditable=true` from the
 * ProseMirror root and became an editable island inside a node view: a place the caret can land
 * and Backspace can eat, holding text that is in no document. The package this replaced walled
 * off the wrapper, which is what actually works.
 *
 * `ignoreMutation` for the same reason the other four views carry one: this subtree is drawn by
 * this code, and ProseMirror must not try to read a document back out of it.
 *
 * The `toDOM` in the schema deliberately carries none of this — that one is the clipboard's
 * copy, where an uneditable input would be a strange thing to paste.
 */
function taskItemView(node: PMNode, view: EditorView, getPos: () => number | undefined): NodeView {
  const li = document.createElement('li')
  li.dataset.type = 'taskItem'
  const label = document.createElement('label')
  label.contentEditable = 'false'
  const box = document.createElement('input')
  box.type = 'checkbox'
  const seen = document.createElement('span')
  const body = document.createElement('div')
  label.append(box, seen)
  li.append(label, body)

  const paint = (n: PMNode): void => {
    const on = Boolean(n.attrs.checked)
    li.dataset.checked = String(on)
    box.checked = on
  }
  paint(node)
  box.addEventListener('mousedown', (e) => e.preventDefault())
  box.addEventListener('change', () => {
    const pos = getPos()
    if (pos == null) return
    const at = view.state.doc.nodeAt(pos)
    if (!at) return
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...at.attrs, checked: box.checked }))
  })

  return {
    dom: li,
    contentDOM: body,
    update(next) {
      if (next.type.name !== 'taskItem') return false
      paint(next)
      return true
    },
    // The checkbox and its label are drawn here; ProseMirror must not read them back. `body` is
    // the `contentDOM` and is deliberately outside this — that half IS the document.
    ignoreMutation(record: { target: globalThis.Node }) {
      return label.contains(record.target)
    },
    // A click on the box is a control being used, not a caret being placed.
    stopEvent(event: Event) {
      return label.contains(event.target as globalThis.Node | null)
    },
  }
}

/**
 * THE TABLE'S OWN VIEW, which is `prosemirror-tables`' and not this file's.
 *
 * ⚠️ WITHOUT IT A TABLE HAS NO `<colgroup>`, and that is not cosmetic: `updateColumnsOnResize`
 * gives every column a `min-width`, so a column whose cells are all empty still has a width to
 * be clicked into. Without one it collapses to nothing and the writer cannot put the caret in
 * it — which is exactly the state a table is in for the first few seconds after it is inserted.
 *
 * Measured against the outgoing build, 2026-09-15: it drew `<table style="min-width: 75px">`
 * with a `<col style="min-width: 25px">` per column, and this schema drew a bare `<table>`. The
 * 25 is `prosemirror-tables`' own default and the number the previous editor used.
 *
 * ⚠️ AND IT IS ALSO WHAT PUTS `.tableWrapper` AROUND THE TABLE, which `admin.css` line 653 needs
 * and says why: a wide table has to pan inside its own box, because panning the WRITING surface
 * sideways moves every paragraph away from the caret still sitting in one of them. Without this
 * view there was no wrapper and the rule applied to nothing — a wide table dragged the whole
 * sheet. No test could see it: nothing measures horizontal overflow of the writing surface.
 * `tour-flows-hold.ts` measures it now.
 */
const CELL_MIN_WIDTH = 25

/** Every node view, by node name, ready for `EditorView`'s `nodeViews` option. */
export function nodeViews(words: NodeWords = ENGLISH): Record<string, NodeViewConstructor> {
  return {
    table: (node) => new TableView(node, CELL_MIN_WIDTH) as never,
    image: (node, view, getPos) => {
      const v = new ImageView(node, words.image)
      v.attrs = writer(view, getPos)
      v.gallery = (opts: Partial<GridOpts>) => {
        const pos = getPos()
        if (pos != null) applyToGallery(view, pos, opts)
      }
      return v as never
    },
    video: (node, view, getPos) => {
      // The player lays a transparent sheet over itself and selects the node from it, because a
      // click that reached the `<video>` would be a click on the player's own controls.
      const v = new VideoView(node, words.video, () => {
        const pos = getPos()
        if (pos == null) return
        view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)))
      })
      v.attrs = writer(view, getPos)
      return v as never
    },
    mathInline: (node, view, getPos) => {
      const v = new MathView(node, words.math)
      v.attrs = writer(view, getPos)
      return v as never
    },
    mathBlock: (node, view, getPos) => {
      const v = new MathView(node, words.math)
      v.attrs = writer(view, getPos)
      return v as never
    },
    taskItem: (node, view, getPos) => taskItemView(node, view, () => getPos()) as never,
  }
}
