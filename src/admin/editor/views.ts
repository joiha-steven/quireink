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
import type { Node as PMNode } from 'prosemirror-model'
import type { EditorView, NodeViewConstructor } from 'prosemirror-view'
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
 * ⚠️ `contenteditable="false"` ON THE INPUT. Without it the browser treats the checkbox as part
 * of the text: clicking puts a caret beside it instead of ticking it, and Backspace deletes it.
 * The `toDOM` in the schema deliberately does NOT carry that attribute — that one is the
 * clipboard's copy, where an uneditable input would be a strange thing to paste.
 */
function taskItemView(node: PMNode, view: EditorView, getPos: () => number | undefined): {
  dom: HTMLElement; contentDOM: HTMLElement; update: (n: PMNode) => boolean
} {
  const li = document.createElement('li')
  li.dataset.type = 'taskItem'
  const label = document.createElement('label')
  const box = document.createElement('input')
  box.type = 'checkbox'
  box.contentEditable = 'false'
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
  }
}

/** Every node view, by node name, ready for `EditorView`'s `nodeViews` option. */
export function nodeViews(words: NodeWords): Record<string, NodeViewConstructor> {
  return {
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
