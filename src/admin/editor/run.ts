// HOW SEVERAL COMMANDS BECOME ONE EDIT (ADR 0054 step 7).
//
// A ProseMirror command is `(state, dispatch?) => boolean`: it asks the state whether it can do
// the thing, and if it is given a `dispatch` it does it. That is the whole contract, and it is
// enough for one command at a time.
//
// ⚠️ IT IS NOT ENOUGH FOR THREE, AND THAT IS WHY THIS FILE EXISTS. The toolbar asks for
// "focus, then extend the selection over the link, then unset it" — and running those as three
// commands means three transactions: three trips through every plugin, three redraws, and
// THREE ENTRIES IN THE UNDO HISTORY, so one press of the Bold key would need three presses of
// Mod-Z to take back. The product's own call sites already say `chain().focus().toggleBold()`,
// in thirty-one places, because the wrapper that is leaving offered exactly this.
//
// So a chain accumulates into ONE transaction. Each command is run against a state that reports
// the document and the selection AS THE TRANSACTION HAS THEM SO FAR — a later command in the
// chain sees what the earlier one did — while `state.tr` hands back the SAME transaction rather
// than a fresh one. That is the trick, and it is the only unusual thing here.
//
// ⚠️ A CHAIN IS ALL OR NOTHING. A command that answers `false` stops the rest and the
// transaction is never dispatched, because half of "wrap this in a link and set its href" is
// worse than none of it.
import type { EditorState, Transaction } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

/** What every command in this editor is. ProseMirror's own shape, with the view for the few that need it. */
export type Cmd = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
  view?: EditorView,
) => boolean

/**
 * A state that answers from a transaction in progress.
 *
 * Built with `Object.create` over the real state so that everything not named here — `schema`,
 * `plugins`, `storedMarks`, the plugin states every command may read — still answers from the
 * original. Only the three fields a transaction changes are intercepted.
 */
export function stateFor(base: EditorState, tr: Transaction): EditorState {
  const view = Object.create(base) as EditorState
  Object.defineProperties(view, {
    doc: { get: () => tr.doc, configurable: true },
    selection: { get: () => tr.selection, configurable: true },
    storedMarks: { get: () => tr.storedMarks, configurable: true },
    // ⚠️ THE SAME TRANSACTION, NOT A NEW ONE. `state.tr` normally starts a fresh transaction
    // from the current document; here it hands back the one being built, so a command that
    // writes `state.tr.insertText(...)` is adding a step to the chain rather than starting a
    // second edit that would be thrown away.
    tr: { get: () => tr, configurable: true },
  })
  return view
}

export type Chain = {
  /** Add a command. A command that answers `false` stops the chain. */
  cmd: (fn: Cmd) => Chain
  /** Dispatch what was accumulated. `false` if any command refused, and then nothing is dispatched. */
  run: () => boolean
  /** Whether every command WOULD succeed, changing nothing. */
  can: () => boolean
}

/**
 * Start a chain against a view.
 *
 * `dry` is what `can()` is: the commands are asked and their steps are accumulated — they have
 * to be, or the second command would be answering about the document before the first one —
 * and the transaction is then simply not dispatched.
 */
export function chainOn(view: EditorView, dry = false): Chain {
  const base = view.state
  const tr = base.tr
  let ok = true
  const chain: Chain = {
    cmd(fn) {
      if (!ok) return chain
      // The dispatch is a no-op on purpose: the command has already written its steps into
      // `tr`, which it reached through `state.tr`. Handing it a function that re-dispatches
      // would apply the same steps twice.
      ok = fn(stateFor(base, tr), () => {}, view)
      return chain
    },
    run() {
      if (!ok) return false
      // Dispatched whether or not there are steps: a chain can be entirely about the selection
      // or the stored marks — `focus().toggleBold()` on an empty selection writes no step and
      // still has to reach the view, or pressing Bold before typing would do nothing.
      if (!dry) view.dispatch(tr)
      return true
    },
    can: () => ok,
  }
  return chain
}

/** One command, dispatched on its own. The shape every keymap entry wants. */
export function runOne(view: EditorView, fn: Cmd): boolean {
  return fn(view.state, view.dispatch.bind(view), view)
}
