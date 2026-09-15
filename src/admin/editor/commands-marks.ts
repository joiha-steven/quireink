// WHAT THE TOOLBAR DOES TO A RUN OF TEXT (ADR 0054 step 7).
//
// Eight marks, and the commands the keys and the buttons reach for. `prosemirror-commands` has
// `toggleMark` and that is most of it; what is here is the handful of things the product needs
// that it does not offer — asking WHETHER a mark is on, reading its attributes, growing a
// selection to cover the whole of the mark under the caret, and changing a mark's attributes
// without lifting and re-applying it.
import { toggleMark as pmToggleMark } from 'prosemirror-commands'
import type { MarkType, Mark, ResolvedPos } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorState } from 'prosemirror-state'
import type { Cmd } from './run'
import { schema } from './schema'

const markType = (name: string): MarkType => {
  const type = schema.marks[name]
  if (!type) throw new Error(`no mark named ${name} in the schema`)
  return type
}

/**
 * THE WHOLE RUN OF ONE MARK AROUND A POSITION, or null.
 *
 * ProseMirror gives the marks AT a position and the node they sit on; it does not give the span
 * a mark covers, and three things here need it — the link box has to know what it is editing,
 * `extendMarkRange` has to know what to select, and the ink's `#colour` afterthought has to find
 * the stroke it is recolouring. It walks out from the position's own text node in both
 * directions while the mark is still in the set, with the ATTRIBUTES compared too when they are
 * given: two links side by side to different addresses are two runs, not one.
 */
export function markRange(
  $pos: ResolvedPos,
  type: MarkType,
  attrs?: Record<string, unknown>,
): { from: number; to: number } | null {
  const parent = $pos.parent
  if (parent.childCount === 0) return null
  const same = (mark: Mark): boolean =>
    mark.type === type && (!attrs || Object.entries(attrs).every(([k, v]) => mark.attrs[k] === v))
  const wears = (i: number): boolean => i >= 0 && i < parent.childCount && parent.child(i).marks.some(same)

  // ⚠️ A CARET SITS BETWEEN TWO CHILDREN, so "which child" has two answers and both have to be
  // tried. `index()` names the child AFTER the position; at a boundary — `textOffset === 0` —
  // the one before is usually what a writer means by "the word I am in", so it is asked first.
  let index = $pos.index()
  if ($pos.textOffset === 0 && index > 0 && wears(index - 1)) index -= 1
  if (!wears(index)) return null

  let first = index
  let last = index
  while (wears(first - 1)) first -= 1
  while (wears(last + 1)) last += 1

  let from = $pos.start()
  for (let i = 0; i < first; i++) from += parent.child(i).nodeSize
  let to = from
  for (let i = first; i <= last; i++) to += parent.child(i).nodeSize
  return { from, to }
}

/** Whether a mark is on the selection, or on what the next keystroke would carry. */
export function markActive(state: EditorState, name: string, attrs?: Record<string, unknown>): boolean {
  const type = markType(name)
  const fits = (mark: Mark): boolean =>
    mark.type === type && (!attrs || Object.entries(attrs).every(([k, v]) => mark.attrs[k] === v))
  const { from, $from, to, empty } = state.selection
  // An empty selection asks what the NEXT character would wear: the stored marks if the writer
  // has just pressed a key, otherwise whatever is at the caret.
  if (empty) return Boolean((state.storedMarks ?? $from.marks()).some(fits))
  let on = false
  state.doc.nodesBetween(from, to, (node) => {
    if (node.isInline && node.marks.some(fits)) on = true
  })
  return on
}

/** A mark's attributes at the selection, or an empty object. What the link box reads. */
export function markAttrs(state: EditorState, name: string): Record<string, unknown> {
  const type = markType(name)
  const { $from, empty, from, to } = state.selection
  const found = empty
    ? (state.storedMarks ?? $from.marks()).find((m) => m.type === type)
    : (() => {
      let hit: Mark | undefined
      state.doc.nodesBetween(from, to, (node) => {
        if (!hit && node.isInline) hit = node.marks.find((m) => m.type === type)
      })
      return hit
    })()
  return found ? { ...found.attrs } : {}
}

export const toggleMark = (name: string, attrs?: Record<string, unknown>): Cmd =>
  pmToggleMark(markType(name), attrs) as Cmd

/** Take a mark off, whether or not the selection is entirely inside it. */
export const unsetMark = (name: string): Cmd => (state, dispatch) => {
  const type = markType(name)
  const { from, to, empty } = state.selection
  if (dispatch) {
    const tr = state.tr
    if (empty) tr.removeStoredMark(type)
    else tr.removeMark(from, to, type)
    dispatch(tr)
  }
  return true
}

/** Every mark off the selection. `Mod-Shift-x`, and the editor's "start again" for emphasis. */
export const unsetAllMarks: Cmd = (state, dispatch) => {
  const { from, to, empty } = state.selection
  if (empty) return false
  if (dispatch) dispatch(state.tr.removeMark(from, to))
  return true
}

/**
 * Grow the selection to cover the whole run of a mark under the caret.
 *
 * This is what makes the link box work on a click rather than on a careful drag: put the caret
 * anywhere in a linked phrase, press the key, and the whole link is what gets changed. An empty
 * selection outside any such run is left alone rather than refused, so a chain built on it still
 * runs — `setLink` on nothing is how a link is made from scratch.
 */
export const extendMarkRange = (name: string, attrs?: Record<string, unknown>): Cmd =>
  (state, dispatch) => {
    const type = markType(name)
    const { $from, from, to, empty } = state.selection
    if (!empty) return true
    const range = markRange($from, type, attrs)
    if (!range || range.from > from || range.to < to) return true
    if (dispatch) {
      dispatch(state.tr.setSelection(TextSelection.create(state.doc, range.from, range.to)))
    }
    return true
  }

/**
 * Change a mark's attributes in place, over the whole run.
 *
 * Lifting the mark and applying it again would work and would be wrong: it is two steps in the
 * undo history for one gesture, and on a recolour it makes the phrase flash unhighlighted for a
 * frame. This rewrites the mark where it is.
 */
export const updateMarkAttrs = (name: string, attrs: Record<string, unknown>): Cmd =>
  (state, dispatch) => {
    const type = markType(name)
    const { $from, from, to, empty } = state.selection
    const range = empty ? markRange($from, type) : { from, to }
    if (!range) return false
    if (dispatch) {
      const tr = state.tr
      // Removed and re-added inside ONE transaction, which is not the same as two commands:
      // nothing between the two steps is ever drawn, and the pair is one undo.
      tr.removeMark(range.from, range.to, type)
      tr.addMark(range.from, range.to, type.create({ ...markAttrs(state, name), ...attrs }))
      dispatch(tr)
    }
    return true
  }

/** The link, made or changed. `href` of `''` means take it off. */
export const setLink = (href: string, extra?: Record<string, unknown>): Cmd => (state, dispatch) => {
  const type = markType('link')
  const { from, to, empty } = state.selection
  if (empty) return false
  if (dispatch) {
    const tr = state.tr.removeMark(from, to, type)
    if (href) tr.addMark(from, to, type.create({ href, ...extra }))
    dispatch(tr)
  }
  return true
}
