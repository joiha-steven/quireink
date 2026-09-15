// THE COMMAND TABLE: every name the chrome can ask for, in one place (ADR 0054 step 7).
//
// Each entry takes the caller's arguments and returns a `Cmd`. Nothing here does any work — the
// work is in `commands-marks.ts`, `commands-blocks.ts` and `commands-doc.ts` — and that is the
// point: this is the VOCABULARY, and a name that is not on it cannot be called.
//
// ⚠️ THE NAMES ARE NOT THIS FILE'S TO CHOOSE. Thirty-one call sites across the toolbar, the "/"
// menu, the bubble bar and the sheet already say `toggleBold`, `setImage`, `insertContentAt`.
// They are the product's own words for what its buttons do, and keeping them is what let the
// layer underneath be replaced without touching a single one of those sites.
import type { Cmd } from './run'
import * as marks from './commands-marks'
import * as blocks from './commands-blocks'
import * as doc from './commands-doc'
import { DEFAULT_INK } from '@/pen/grammar'

/** A command as the chrome asks for it: arguments in, a `Cmd` out. */
export type Maker = (...args: never[]) => Cmd

export const COMMANDS = {
  // ----- marks ------------------------------------------------------------------------------
  toggleBold: () => marks.toggleMark('bold'),
  toggleItalic: () => marks.toggleMark('italic'),
  toggleStrike: () => marks.toggleMark('strike'),
  toggleCode: () => marks.toggleMark('code'),
  toggleUnderline: () => marks.toggleMark('underline'),
  /**
   * Switching colour on an already-highlighted phrase RECOLOURS it rather than clearing it.
   * Only asking for the ink already there lifts the pen.
   */
  toggleInk: (ink: string = DEFAULT_INK) => ((state, dispatch, view) => {
    const chosen = ink || DEFAULT_INK
    if (marks.markActive(state, 'ink') && marks.markAttrs(state, 'ink').ink !== chosen) {
      return marks.updateMarkAttrs('ink', { ink: chosen })(state, dispatch, view)
    }
    return marks.toggleMark('ink', { ink: chosen })(state, dispatch, view)
  }) as Cmd,
  toggleRing: (ink = '') => ((state, dispatch, view) => {
    if (ink && marks.markActive(state, 'ring') && marks.markAttrs(state, 'ring').ink !== ink) {
      return marks.updateMarkAttrs('ring', { ink })(state, dispatch, view)
    }
    return marks.toggleMark('ring', { ink })(state, dispatch, view)
  }) as Cmd,
  setLink: (link: string | { href: string }) =>
    marks.setLink(typeof link === 'string' ? link : link.href),
  unsetLink: () => marks.unsetMark('link'),
  unsetMark: (name: string) => marks.unsetMark(name),
  unsetAllMarks: () => marks.unsetAllMarks,
  extendMarkRange: (name: string, attrs?: Record<string, unknown>) => marks.extendMarkRange(name, attrs),
  updateMarkAttributes: (name: string, attrs: Record<string, unknown>) => marks.updateMarkAttrs(name, attrs),

  // ----- blocks -----------------------------------------------------------------------------
  setParagraph: () => blocks.setParagraph,
  toggleHeading: (opts: { level: number }) => blocks.toggleHeading(opts.level),
  toggleBlockquote: () => blocks.toggleBlockquote,
  toggleCodeBlock: () => blocks.toggleCodeBlock,
  toggleBulletList: () => blocks.toggleBulletList,
  toggleOrderedList: () => blocks.toggleOrderedList,
  toggleTaskList: () => blocks.toggleTaskList,
  setHorizontalRule: () => blocks.setHorizontalRule,
  splitListItem: () => blocks.splitItem,
  liftListItem: () => blocks.liftItem,
  sinkListItem: () => blocks.sinkItem,

  // ----- the nodes that are not text --------------------------------------------------------
  setImage: (attrs: Record<string, unknown>) => blocks.setImage(attrs),
  setVideo: (src: string) => blocks.setVideo(src),
  // `setMath(true)` for a block and `setMath(false)` for an inline one, which is how the
  // toolbar and the "/" menu have always said it.
  setMath: (display: boolean | { display?: boolean; tex?: string } = false) =>
    (typeof display === 'boolean'
      ? blocks.setMath(display, '')
      : blocks.setMath(Boolean(display.display), display.tex ?? '')),
  updateAttributes: (name: string, attrs: Record<string, unknown>) => doc.updateNodeAttrs(name, attrs),

  // ----- tables -----------------------------------------------------------------------------
  insertTable: (opts?: { rows?: number; cols?: number; withHeaderRow?: boolean }) =>
    blocks.insertTable(opts?.rows ?? 3, opts?.cols ?? 3, opts?.withHeaderRow ?? true),
  addColumnAfter: () => blocks.tableAddColumnAfter,
  addRowAfter: () => blocks.tableAddRowAfter,
  deleteColumn: () => blocks.tableDeleteColumn,
  deleteRow: () => blocks.tableDeleteRow,
  deleteTable: () => blocks.tableDelete,

  // ----- the document -----------------------------------------------------------------------
  setContent: (content: unknown) => doc.setContent(content),
  insertContent: (content: unknown) => doc.insertContent(content),
  insertContentAt: (range: { from: number; to: number } | number, content: unknown) =>
    doc.insertContentAt(typeof range === 'number' ? { from: range, to: range } : range, content),
  setTextSelection: (at: number | { from: number; to: number }) => doc.setTextSelection(at),
  setNodeSelection: (pos: number) => doc.setNodeSelection(pos),
  selectAll: () => doc.selectEverything,
  clearNodes: () => doc.clearNodes,
  setHardBreak: () => doc.setHardBreak,
  exitCode: () => doc.exitCode,
  undo: () => doc.undo,
  redo: () => doc.redo,
  undoInputRule: () => doc.undoInputRule,
  /** An escape hatch for a caller that has a `Cmd` of its own. Used by the find strip. */
  command: (fn: Cmd) => fn,
} satisfies Record<string, Maker>

export type CommandName = keyof typeof COMMANDS
