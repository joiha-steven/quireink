// EVERY CHORD THE WRITING SURFACE ANSWERS (ADR 0054 step 7).
//
// ⚠️ ONE TABLE, WHERE THERE WERE TWENTY-ONE. Each package's extension declared its own keys and
// each became its own `keymap` plugin, so the editor mounted with 102 plugins and a keystroke
// walked most of them. The behaviour is the same and the list is now readable: this is every
// chord, in one place, and a collision is visible rather than being a question about which
// extension's `priority` is higher.
//
// The chords themselves are not this file's to choose — they are the ones the previous editor
// answered, read off it rather than remembered — and the ones a person sees are in
// `components/editorKeys.ts`, which the Help sheet and the rail both print.
//
// `Mod` is ProseMirror's own word for "Cmd on a Mac, Ctrl everywhere else".
import { keymap } from 'prosemirror-keymap'
import {
  baseKeymap, chainCommands, deleteSelection, joinBackward, joinForward,
  selectNodeBackward, selectNodeForward,
} from 'prosemirror-commands'
import { goToNextCell } from 'prosemirror-tables'
import type { Plugin } from 'prosemirror-state'
import type { Cmd } from './run'
import {
  liftItem, sinkItem, splitItem, toggleBlockquote, toggleBulletList, toggleCodeBlock,
  toggleHeading, toggleOrderedList, toggleTaskList, setParagraph, fenceFromOpener,
  joinItemForward, tabOutOfTable,
} from './commands-blocks'
import { toggleMark, unsetAllMarks } from './commands-marks'
import {
  exitCode, redo, setHardBreak, splitBlockSmart, undo, undoInputRule,
} from './commands-doc'
import { DEFAULT_INK } from '@/pen/grammar'

/** What the link key needs from outside: the product's own link box. */
export type KeyHooks = {
  /** Opens the link box and resolves to a URL, '' to unlink, or null if the writer backed out. */
  askLink: (previous: string) => Promise<string | null>
}

/**
 * ⚠️ BACKSPACE AT THE START OF A BLOCK IS THREE COMMANDS, and the order is the behaviour.
 *
 * Lift out of a quote or a list first — that is what a writer means by backspacing at the start
 * of an indented line — and only then fall through to joining with the block before, and finally
 * to selecting it. The base keymap has the last two; the first is this editor's.
 */
const backspace: Cmd = chainCommands(
  undoInputRule as never,
  ((state: import('prosemirror-state').EditorState,
    dispatch?: (tr: import('prosemirror-state').Transaction) => void,
    view?: import('prosemirror-view').EditorView) => {
    const { $from, empty } = state.selection
    if (!empty || $from.parentOffset > 0) return false
    // Only when there is something to come out of.
    for (let depth = $from.depth; depth > 0; depth--) {
      const name = $from.node(depth).type.name
      if (name === 'listItem' || name === 'taskItem') return liftItem(state, dispatch, view)
      if (name === 'blockquote') return toggleBlockquote(state, dispatch, view)
    }
    return false
  }) as never,
  joinBackward,
  selectNodeBackward,
) as Cmd

/**
 * Enter: a fence opener becomes a fence, a list item splits, a fence keeps its newline, and
 * everything else splits the block. The fence opener goes FIRST because the line it acts on is
 * an ordinary paragraph, which every command after it would happily split instead.
 */
const enter: Cmd = chainCommands(
  fenceFromOpener as never, splitItem as never, splitBlockSmart as never,
) as Cmd

/**
 * Tab: the next cell in a table — adding a row when there is no next cell — or one level deeper
 * in a list. Nothing elsewhere, so Tab still moves the focus off a writing surface that is not
 * in either.
 */
const tab: Cmd = chainCommands(tabOutOfTable as never, sinkItem as never) as Cmd
const shiftTab: Cmd = chainCommands(goToNextCell(-1) as never, liftItem as never) as Cmd

/**
 * Delete: join two list items when that is what it means, otherwise the ordinary thing.
 *
 * ⚠️ IT WAS BOUND NOWHERE, so `baseKeymap`'s `joinForward` answered — and that pulls the next
 * item's paragraph INSIDE the current item instead of merging the two rows.
 */
const del: Cmd = chainCommands(
  deleteSelection, joinItemForward as never, joinForward, selectNodeForward,
) as Cmd

export function editorKeymap(hooks: KeyHooks): Plugin[] {
  const link: Cmd = (_state, _dispatch, view) => {
    if (!view) return false
    // The box is asked OUTSIDE the transaction, because a person answers it in their own time.
    // What comes back is applied to wherever the selection is then — which is where it was,
    // since the box takes the focus and gives it back.
    void (async () => {
      const { markAttrs, extendMarkRange, setLink } = await import('./commands-marks')
      const { chainOn } = await import('./run')
      const previous = String(markAttrs(view.state, 'link').href ?? '')
      const answer = await hooks.askLink(previous)
      if (answer === null) return
      chainOn(view).cmd(extendMarkRange('link')).cmd(setLink(answer)).run()
      view.focus()
    })()
    return true
  }

  const table: Record<string, Cmd> = {
    Tab: tab,
    'Shift-Tab': shiftTab,
  }

  const own: Record<string, Cmd> = {
    // ----- emphasis -----------------------------------------------------------------------
    'Mod-b': toggleMark('bold'),
    // ⚠️ NO `Mod-B`, AND THAT IS A FIX RATHER THAN AN OMISSION. `prosemirror-keymap` tries the
    // chord, then the chord with Shift STRIPPED, before it falls back to the key code — so a
    // `Mod-B` binding answers `Mod-Shift-b` first and takes it. The blockquote chord below
    // therefore never ran, on either build: measured on the outgoing one, Ctrl+Shift+B over a
    // selection produced bold there too, while `admin-shared/keys.ts` prints it as Blockquote on
    // the Help sheet. `Mod-b` alone still bolds; `Mod-I` stays, because nothing is bound at
    // `Mod-Shift-i` for it to shadow.
    'Mod-I': toggleMark('italic'),
    'Mod-i': toggleMark('italic'),
    'Mod-e': toggleMark('code'),
    'Mod-u': toggleMark('underline'),
    'Mod-Shift-s': toggleMark('strike'),
    // The pen the product is named for. A chord reaches for the DEFAULT ink; choosing a colour
    // is what the toolbar's swatches are for.
    'Mod-Shift-h': toggleMark('ink', { ink: DEFAULT_INK }),
    'Mod-Shift-o': toggleMark('ring'),
    'Mod-Shift-x': unsetAllMarks,
    'Mod-k': link,

    // ----- blocks -------------------------------------------------------------------------
    'Mod-Alt-0': setParagraph,
    'Mod-Alt-1': toggleHeading(1),
    'Mod-Alt-2': toggleHeading(2),
    'Mod-Alt-3': toggleHeading(3),
    'Mod-Alt-4': toggleHeading(4),
    'Mod-Alt-5': toggleHeading(5),
    'Mod-Alt-6': toggleHeading(6),
    'Mod-Shift-b': toggleBlockquote,
    'Mod-Alt-c': toggleCodeBlock,
    'Mod-Shift-7': toggleOrderedList,
    'Mod-Shift-8': toggleBulletList,
    'Mod-Shift-9': toggleTaskList,

    // ----- the document -------------------------------------------------------------------
    Enter: enter,
    'Shift-Enter': setHardBreak,
    // ⚠️ `Mod-Enter` IS TWO THINGS AND THE ORDER MATTERS: out of a fence when there is a fence
    // to leave, a line break otherwise. Written the other way round it becomes impossible to
    // get out of a code block with the keyboard.
    'Mod-Enter': chainCommands(exitCode as never, setHardBreak as never) as Cmd,
    Backspace: backspace,
    'Mod-Backspace': backspace,
    'Shift-Backspace': backspace,
    Delete: del,
    'Mod-Delete': del,
    'Mod-z': undo,
    'Shift-Mod-z': redo,
    'Mod-y': redo,
    // ⚠️ THE CYRILLIC `я` SITS WHERE `z` DOES on a Russian layout, and a keymap matches on the
    // CHARACTER rather than on the physical key. Without these two, undo is unreachable for
    // anyone typing in Russian — which is one of the eleven languages this admin ships in.
    'Mod-я': undo,
    'Shift-Mod-я': redo,
  }

  return [
    // Order is the precedence: the table's Tab before the list's, and the base keymap last so
    // that anything above may decline and let the ordinary behaviour happen.
    keymap(table as never),
    keymap(own as never),
    keymap(baseKeymap),
  ]
}
