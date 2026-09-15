// WHAT HAPPENS TO THE WHOLE DOCUMENT, AND TO WHERE THE CARET IS (ADR 0054 step 7).
//
// Opening a piece, putting one back, inserting a run of nodes, moving the selection, undo. The
// commands that are not about a mark or a block.
//
// ⚠️ `setContent` AND `insertContent` TAKE MARKDOWN HERE, and that is the whole reason the
// editor can be handed a post and show it. It was a wrapper around a wrapper before — the
// bridge extension overrode two of the library's own commands to parse the string on the way in
// — and it is one call now: `md/to-editor.ts` builds the ProseMirror JSON straight from the
// parse, with no HTML in the middle and nothing to spell twice.
import { undo as pmUndo, redo as pmRedo, undoDepth, redoDepth } from 'prosemirror-history'
import { undoInputRule as pmUndoInputRule } from 'prosemirror-inputrules'
import {
  chainCommands, createParagraphNear, exitCode as pmExitCode, liftEmptyBlock,
  newlineInCode, selectAll as pmSelectAll, splitBlock,
} from 'prosemirror-commands'
import { NodeSelection, TextSelection, AllSelection } from 'prosemirror-state'
import { Fragment, Slice } from 'prosemirror-model'
import type { Node as PMNode } from 'prosemirror-model'
import { parse } from '@/md/index'
import { toEditor } from '@/md/to-editor'
import type { Cmd } from './run'
import { schema } from './schema'

/**
 * Markdown, a node's JSON, or a run of them, as nodes this schema can hold.
 *
 * ⚠️ `nodeFromJSON` DOES NOT CHECK, and a document that breaks the schema does not announce
 * itself: it opens, it draws, and the first Enter in the wrong place throws
 * `Called contentMatchAt on a node with invalid content` from inside ProseMirror, where nothing
 * can catch it usefully.
 *
 * One input reaches this today and it is one THE EDITOR ITSELF WRITES. Nest a bullet, clear its
 * text, and the save is `- one\n  - `; `  - ` is a setext underline as well as an empty list
 * item, the parser reads the first, and `listItem` is `paragraph block*` so a heading cannot
 * lead it. Both builds do this — it is `md/`'s, not this editor's, and deciding what that
 * Markdown MEANS is a question about the reader's page as much as about the writing surface.
 * What is decided here is only that the editor will not hold a document it cannot edit.
 */
export function contentToNodes(content: unknown): PMNode[] {
  if (typeof content === 'string') {
    const doc = repaired(schema.nodeFromJSON(toEditor(parse(content))))
    const out: PMNode[] = []
    doc.forEach((child) => out.push(child))
    return out
  }
  const list = Array.isArray(content) ? content : [content]
  return list.map((item) => schema.nodeFromJSON(item))
}

/**
 * A document the schema accepts, repaired only where it does not.
 *
 * ⚠️ IT CHECKS FIRST AND RETURNS THE ORIGINAL WHEN IT PASSES, so the ordinary path — every post
 * anybody has ever written — is one `check()` and nothing else. The repair is a re-creation
 * through `createChecked`'s forgiving sibling: `createAndFill` inserts whatever the content
 * expression requires, which for a `listItem` led by a heading is the paragraph it is missing.
 */
function repaired(doc: PMNode): PMNode {
  try {
    doc.check()
    return doc
  } catch {
    const fixed = schema.topNodeType.createAndFill(doc.attrs, mend(doc))
    // If even that fails there is nothing honest left to do but let the original through and
    // let ProseMirror say so, which is better than an empty post.
    return fixed ?? doc
  }
}

/** Each node rebuilt so its content satisfies its own type, deepest first. */
function mend(node: PMNode): PMNode[] {
  const kids: PMNode[] = []
  node.forEach((child) => {
    if (child.isText || child.isAtom) { kids.push(child); return }
    const inner = mend(child)
    kids.push(child.type.createAndFill(child.attrs, inner, child.marks) ?? child)
  })
  return kids
}

/**
 * Replace the whole document.
 *
 * ⚠️ THE SELECTION IS PUT AT THE START rather than left to fall where it may. Without it, a
 * revision loaded into a longer document leaves the caret at a position the new document has
 * — ProseMirror clamps it — which is the middle of somebody else's paragraph, and the next
 * keystroke lands there.
 */
export const setContent = (content: unknown): Cmd => (state, dispatch) => {
  if (dispatch) {
    const nodes = contentToNodes(content)
    const doc = schema.topNodeType.create(null, nodes.length ? nodes : schema.nodes.paragraph!.create())
    const tr = state.tr.replaceWith(0, state.doc.content.size, doc.content)
    // ⚠️ `near`, NOT `create` — the same trap `setTextSelection` below carries a paragraph
    // about, and this line fell into it. Position 0 resolves to the DOCUMENT, not into the
    // first paragraph, so `create` makes a selection whose endpoint is not in inline content:
    // ProseMirror warns, and the next character typed lands in a NEW paragraph before the
    // first one. Restoring a snapshot and typing was enough to see it.
    tr.setSelection(TextSelection.near(tr.doc.resolve(0)))
    // Not part of the undo history: opening a piece is not an edit somebody made, and letting
    // Mod-Z walk back into the previous post is how a writer loses the one they are in.
    tr.setMeta('addToHistory', false)
    dispatch(tr)
  }
  return true
}

/**
 * Insert at the caret, replacing whatever is selected. A string is Markdown.
 *
 * ⚠️ A SLICE, NOT A NODE. `replaceSelectionWith` takes one node, and the gallery inserts a RUN
 * of pictures — nine of them, in the order somebody chose. Inserting them one at a time leaves
 * only the last, because each insertion selects the node it just made and the next one replaces
 * it. That is a real fault this repository has already paid for once, which is why
 * `insertGalleryMany` passes an array.
 *
 * `openStart`/`openEnd` of 0: the nodes go in whole rather than being merged into the block the
 * caret is in. A pasted sentence joins its paragraph; an inserted picture does not.
 */
export const insertContent = (content: unknown): Cmd => (state, dispatch) => {
  const nodes = contentToNodes(content)
  if (nodes.length === 0) return false
  if (dispatch) {
    dispatch(state.tr.replaceSelection(new Slice(Fragment.from(nodes), 0, 0)).scrollIntoView())
  }
  return true
}

/** Insert at a given range, replacing it. What the "/" menu uses after eating its own slash. */
export const insertContentAt = (range: { from: number; to: number }, content: unknown): Cmd =>
  (state, dispatch) => {
    const nodes = contentToNodes(content)
    if (dispatch) {
      const tr = state.tr.replaceWith(range.from, range.to, nodes)
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(range.from + 1, tr.doc.content.size))))
      dispatch(tr.scrollIntoView())
    }
    return true
  }

/**
 * Put the caret somewhere, or select a range.
 *
 * ⚠️ `between`, NOT `create`, AND THAT IS NOT A DETAIL. A caller says
 * `setTextSelection(doc.content.size)` meaning "the end" — and the end of a document is the
 * position AFTER the last paragraph, which is not a place a caret can be. `create` throws or
 * lands nowhere; `between` walks to the nearest position that can hold one, which is inside
 * that paragraph and is what the caller meant. Found by a typing test putting its text in a
 * second paragraph that did not exist.
 */
export const setTextSelection = (at: number | { from: number; to: number }): Cmd =>
  (state, dispatch) => {
    const { from, to } = typeof at === 'number' ? { from: at, to: at } : at
    const size = state.doc.content.size
    const clamp = (n: number): number => Math.max(0, Math.min(n, size))
    if (dispatch) {
      const $from = state.doc.resolve(clamp(from))
      const $to = state.doc.resolve(clamp(to))
      dispatch(state.tr.setSelection(TextSelection.between($from, $to)))
    }
    return true
  }

/** Select a node whole — what a click on a picture or a formula means. */
export const setNodeSelection = (pos: number): Cmd => (state, dispatch) => {
  const node = state.doc.nodeAt(pos)
  if (!node || !NodeSelection.isSelectable(node)) return false
  if (dispatch) dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)))
  return true
}

export const selectAll: Cmd = pmSelectAll as Cmd
export const undo: Cmd = pmUndo as Cmd
export const redo: Cmd = pmRedo as Cmd
export const canUndo = (state: import('prosemirror-state').EditorState): boolean => undoDepth(state) > 0
export const canRedo = (state: import('prosemirror-state').EditorState): boolean => redoDepth(state) > 0

/** Backspace right after a typing rule fired puts the characters back. */
export const undoInputRule: Cmd = pmUndoInputRule as Cmd

/** A line break inside a paragraph: Shift-Enter, and Mod-Enter. */
export const setHardBreak: Cmd = (state, dispatch) => {
  const type = schema.nodes.hardBreak!
  if (dispatch) dispatch(state.tr.replaceSelectionWith(type.create()).scrollIntoView())
  return true
}

/** Out of a fence and into a fresh paragraph after it. The only way out by key. */
export const exitCode: Cmd = pmExitCode as Cmd

/** Enter, everywhere a list has not already claimed it. */
export const splitBlockSmart: Cmd = chainCommands(
  newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock,
) as Cmd

/** Everything back to plain paragraphs. What the "clear formatting" gesture means for blocks. */
export const clearNodes: Cmd = (state, dispatch) => {
  const { from, to } = state.selection
  if (dispatch) {
    const tr = state.tr
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isTextblock || node.type === schema.nodes.paragraph) return true
      tr.setNodeMarkup(tr.mapping.map(pos), schema.nodes.paragraph!, {})
      return true
    })
    dispatch(tr)
  }
  return true
}

/** Change a node's attributes where the selection is. The picture bar's every button. */
export const updateNodeAttrs = (name: string, attrs: Record<string, unknown>): Cmd =>
  (state, dispatch) => {
    const type = schema.nodes[name]
    if (!type) return false
    const selected = state.selection as NodeSelection
    const at = selected.node?.type === type
      ? selected.from
      : (() => {
        const { $from } = state.selection
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type === type) return $from.before(depth)
        }
        return null
      })()
    if (at === null) return false
    if (dispatch) {
      const node = state.doc.nodeAt(at)
      dispatch(state.tr.setNodeMarkup(at, undefined, { ...node?.attrs, ...attrs }))
    }
    return true
  }

/** The whole document selected, including the nodes a text selection cannot reach. */
export const selectEverything: Cmd = (state, dispatch) => {
  if (dispatch) dispatch(state.tr.setSelection(new AllSelection(state.doc)))
  return true
}
