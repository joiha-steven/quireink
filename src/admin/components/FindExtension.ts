// Find and replace inside the writing surface: the half that has to speak ProseMirror.
//
// The matching itself is `editorFind.ts`, which knows nothing about documents. This file does
// two things that cannot be done in a string: it turns the document into text WITH the
// positions to get back, and it draws the hits without touching the document.
//
// DECORATIONS, NOT MARKS, and that distinction is the whole design. A mark would be an edit:
// it would go in the undo history, it would be serialised into the Markdown the piece saves
// as, and clearing it would be a second edit. A decoration is a drawing instruction held
// beside the document — nothing about the piece changes while a writer is looking through it,
// which is what "find" has to mean in an editor whose save contract is that a save may not
// change the reader's page.
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection, type EditorState } from 'prosemirror-state'
import type { Node as PMNode } from 'prosemirror-model'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { findAll, MAX_HIGHLIGHT, type FindOptions } from './editorFind'

/** A hit in DOCUMENT positions, which is what a transaction and a decoration both want. */
export type DocHit = { from: number; to: number }

export type FindState = {
  query: string
  caseSensitive: boolean
  /** Which hit is the current one. Out of range is treated as 0 by every reader below. */
  index: number
  hits: DocHit[]
}

const EMPTY: FindState = { query: '', caseSensitive: false, index: 0, hits: [] }

export const findKey = new PluginKey<FindState>('quireFind')

/** The meta a transaction carries to change what is being looked for. */
type FindMeta = { query?: string; caseSensitive?: boolean; index?: number }

/**
 * The document as searchable runs, each with the position its first character sits at.
 *
 * ONE RUN PER BLOCK, not one per text node, and that is what makes a match survive a mark
 * boundary: `**Van** Gogh` is two text nodes, and a writer searching `Van Gogh` means the
 * words on the page rather than the shape of the markup underneath them. Consecutive text
 * nodes are joined; anything that is not text closes the run, so a query never matches across
 * the gap between two paragraphs — which would give a hit no reader could see.
 *
 * The positions stay exact because the run is a straight concatenation: a text node at `pos`
 * contributes its characters at `pos`, `pos + 1`, and so on, and ProseMirror numbers text that
 * way. Nothing here has to map anything.
 */
function runs(doc: PMNode): { text: string; pos: number }[] {
  const out: { text: string; pos: number }[] = []
  let open: { text: string; pos: number } | null = null
  doc.descendants((node, pos) => {
    if (node.isText) {
      if (open) open.text += node.text ?? ''
      else open = { text: node.text ?? '', pos }
      return false
    }
    if (open) { out.push(open); open = null }
    return true
  })
  if (open) out.push(open)
  return out
}

/** Every hit in the document, left to right, in document positions. */
export function hitsIn(doc: PMNode, query: string, opts: FindOptions): DocHit[] {
  if (!query) return []
  const out: DocHit[] = []
  for (const run of runs(doc)) {
    for (const hit of findAll(run.text, query, opts)) {
      out.push({ from: run.pos + hit.from, to: run.pos + hit.to })
    }
  }
  return out
}

/**
 * What the strip needs to draw itself, read straight off the editor.
 *
 * Takes an absent state, because Tiptap mounts asynchronously: `useEditor` returns null on
 * the first render and the strip is a React component that renders before it. Answering with
 * the empty state is the truth for that frame — nothing is being looked for yet.
 */
export function readFind(state: { doc: PMNode } | null | undefined): FindState {
  return (state ? findKey.getState(state as never) : null) ?? EMPTY
}

function decorate(doc: PMNode, state: FindState): DecorationSet {
  if (state.hits.length === 0) return DecorationSet.empty
  const current = state.hits[state.index] ?? state.hits[0]!
  // Past the ceiling only the current hit is drawn. The count beside the buttons still says
  // how many there are, so nothing is hidden — what is dropped is a wall of highlight the
  // writer could not have used, and the per-keystroke cost of carrying it.
  const marks = state.hits.length <= MAX_HIGHLIGHT
    ? state.hits.map((h) =>
      Decoration.inline(h.from, h.to, { class: h === current ? 'find-hit find-hit-now' : 'find-hit' }))
    : [Decoration.inline(current.from, current.to, { class: 'find-hit find-hit-now' })]
  return DecorationSet.create(doc, marks)
}

/**
 * The extension. It holds the query and redraws when the document changes underneath it.
 *
 * RECOMPUTED ON EVERY DOC CHANGE rather than mapped through the transaction. Mapping is the
 * cheaper move and the wrong one here: a Replace changes the length of the text it sits in, so
 * the hits after it all shift, and a mapped decoration that survives its own replacement
 * leaves a highlight over text that no longer matches. Re-scanning is one pass over the
 * block runs and happens only while a query is set.
 */
export const Find = Extension.create({
  name: 'quireFind',

  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: () => EMPTY,
          apply(tr, value) {
            const meta = tr.getMeta(findKey) as FindMeta | undefined
            if (!meta && !tr.docChanged) return value
            const query = meta?.query ?? value.query
            const caseSensitive = meta?.caseSensitive ?? value.caseSensitive
            const hits = query ? hitsIn(tr.doc, query, { caseSensitive }) : []
            // The index is clamped rather than kept: a replace removes a hit, and an index
            // pointing past the end would leave the panel counting "4 of 3".
            const wanted = meta?.index ?? value.index
            const index = hits.length === 0 ? 0 : Math.min(Math.max(wanted, 0), hits.length - 1)
            return { query, caseSensitive, index, hits }
          },
        },
        props: {
          // ⚠️ THERE WAS A CAST HERE, and it was a packaging fact rather than a type this file
          // got wrong: two copies of `prosemirror-view` were installed — 1.42.3 hoisted, which
          // is where `Decoration` came from, and 1.42.2 nested under `prosemirror-state` and
          // four of its siblings. `DecorationSet` carries a private field, so TypeScript read
          // the two as different classes although they are the same code.
          //
          // The comment said the cast would become a no-op when the duplicate was deduped. It
          // has been (2026-09-15, `scripts/checks/deps.ts`), so the cast is gone rather than
          // left standing as a lie about a problem that no longer exists.
          decorations: (state: EditorState) => decorate(state.doc, findKey.getState(state) ?? EMPTY),
        },
      }),
    ]
  },
})

// ----- driving it from the panel ------------------------------------------------------
//
// These take the editor rather than living on it as Tiptap commands. A command would have to
// be declared on the editor's type, and everything below is one dispatch with a meta on it —
// the indirection would buy a longer import and nothing else.

/** The minimum of Tiptap's editor this file uses, so the tests can stand in for it. */
type Driveable = {
  state: { doc: PMNode; tr: import('prosemirror-state').Transaction }
  view: { dispatch: (tr: import('prosemirror-state').Transaction) => void; focus: () => void }
}

/** Change what is being looked for, or which hit is current. Never touches the document. */
export function setFind(editor: Driveable, meta: FindMeta): void {
  editor.view.dispatch(editor.state.tr.setMeta(findKey, meta))
}

/**
 * Put the current hit on screen, and the caret on it.
 *
 * The SELECTION moves as well as the scroll, which is the behaviour every editor's find has:
 * closing the panel leaves the writer standing on the thing they went looking for, ready to
 * type over it. It does not steal the focus — the panel's own field keeps that — so a
 * selection set here is drawn as an inactive one until the writer clicks back into the paper.
 */
export function revealCurrent(editor: Driveable): void {
  const found = findKey.getState(editor.state as never) ?? EMPTY
  const hit = found.hits[found.index]
  if (!hit) return
  const tr = editor.state.tr
  tr.setSelection(TextSelection.create(tr.doc, hit.from, hit.to)).scrollIntoView()
  editor.view.dispatch(tr)
}

/**
 * Replace the current hit and stand on the one that takes its place.
 *
 * The index is kept rather than advanced. After a replacement the hit that WAS next has moved
 * down into this index, so keeping it is what "replace, then replace, then replace" does — and
 * advancing would skip one every time, which is the classic off-by-one in a replace button.
 */
export function replaceCurrent(editor: Driveable, replacement: string): void {
  const found = findKey.getState(editor.state as never) ?? EMPTY
  const hit = found.hits[found.index]
  if (!hit) return
  const tr = editor.state.tr.insertText(replacement, hit.from, hit.to)
  tr.setMeta(findKey, { index: found.index })
  editor.view.dispatch(tr)
}

/**
 * Every hit, in ONE transaction, so it is one undo.
 *
 * BACKWARDS through the document, and that is the whole reason this is not a loop over
 * `replaceCurrent`. Each replacement changes the length of the text it sits in, so every
 * position after it moves; walking from the end means every position still to be used is
 * ahead of the edits already made and none of them has to be mapped.
 *
 * `setStoredMarks(null)` before each one because `insertText` remembers the marks it used and
 * would carry the first hit's formatting into the last hit's paragraph.
 */
export function replaceEveryHit(editor: Driveable, replacement: string): number {
  const found = findKey.getState(editor.state as never) ?? EMPTY
  if (found.hits.length === 0) return 0
  const tr = editor.state.tr
  for (let i = found.hits.length - 1; i >= 0; i--) {
    const hit = found.hits[i]!
    tr.setStoredMarks(null)
    tr.insertText(replacement, hit.from, hit.to)
  }
  tr.setMeta(findKey, { index: 0 })
  editor.view.dispatch(tr)
  return found.hits.length
}
