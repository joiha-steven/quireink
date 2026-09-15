// WHAT THE TOOLBAR DOES TO A BLOCK (ADR 0054 step 7).
//
// Headings, the three lists, the quote, the fence, the rule and the table. Most of these are a
// `prosemirror-commands` or `prosemirror-schema-list` function with the node type filled in; the
// work here is the TOGGLE, which neither library has an opinion about — pressing the bullet-list
// key inside a bullet list has to take the list off again, and pressing it inside a numbered one
// has to change which kind it is rather than nest a second list inside the first.
import { setBlockType, wrapIn, lift } from 'prosemirror-commands'
import { wrapInList, liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list'
import {
  addColumnAfter, addRowAfter, deleteColumn, deleteRow, deleteTable, goToNextCell, isInTable,
} from 'prosemirror-tables'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import type { EditorState } from 'prosemirror-state'
import type { NodeType, Node as PMNode } from 'prosemirror-model'
import type { Cmd } from './run'
import { schema } from './schema'

const nodeType = (name: string): NodeType => {
  const type = schema.nodes[name]
  if (!type) throw new Error(`no node named ${name} in the schema`)
  return type
}

/** The innermost ancestor of the selection with this name, with the depth it sits at. */
function ancestor(state: EditorState, name: string): { node: PMNode; depth: number } | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name === name) return { node, depth }
  }
  return null
}

/** Whether the selection sits in a block of this kind, with these attributes if given. */
export function nodeActive(state: EditorState, name: string, attrs?: Record<string, unknown>): boolean {
  // A node selection — a picture, a video, a block formula — is the node itself rather than an
  // ancestor of a caret, and the toolbar asks about both through this one door.
  const selected = state.selection as NodeSelection
  if (selected.node) {
    return selected.node.type.name === name
      && (!attrs || Object.entries(attrs).every(([k, v]) => selected.node.attrs[k] === v))
  }
  const found = ancestor(state, name)
  if (!found) return false
  return !attrs || Object.entries(attrs).every(([k, v]) => found.node.attrs[k] === v)
}

/** A block's attributes at the selection. What the heading menu and the picture bar read. */
export function nodeAttrs(state: EditorState, name: string): Record<string, unknown> {
  const selected = state.selection as NodeSelection
  if (selected.node?.type.name === name) return { ...selected.node.attrs }
  return { ...(ancestor(state, name)?.node.attrs ?? {}) }
}

export const setParagraph: Cmd = setBlockType(nodeType('paragraph')) as Cmd

/** A heading at this level, or back to a paragraph when it is already one. */
export const toggleHeading = (level: number): Cmd => (state, dispatch, view) =>
  (nodeActive(state, 'heading', { level })
    ? setBlockType(nodeType('paragraph'))
    : setBlockType(nodeType('heading'), { level }))(state, dispatch, view)

/** The fence. Toggling out of one goes back to a paragraph, which is the only way out by key. */
export const toggleCodeBlock: Cmd = (state, dispatch, view) =>
  (nodeActive(state, 'codeBlock')
    ? setBlockType(nodeType('paragraph'))
    : setBlockType(nodeType('codeBlock')))(state, dispatch, view)

export const toggleBlockquote: Cmd = (state, dispatch, view) =>
  (ancestor(state, 'blockquote') ? lift : wrapIn(nodeType('blockquote')))(state, dispatch, view)

/**
 * The three lists, and the one behaviour neither library supplies.
 *
 * ⚠️ PRESSING THE BULLET KEY INSIDE A NUMBERED LIST MUST CHANGE THE LIST, not nest a new one
 * inside it. `wrapInList` would happily put a `bulletList` inside the `listItem` it is standing
 * in, which is a nested list nobody asked for and a Markdown file with an indent nobody typed.
 * So: already this kind, lift out of it; a different kind, rewrite the wrapper in place; neither,
 * wrap.
 */
const listKind = (state: EditorState): { name: string; depth: number } | null => {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.spec.group?.split(' ').includes('list')) return { name: node.type.name, depth }
  }
  return null
}

export const toggleList = (name: string): Cmd => (state, dispatch, view) => {
  const here = listKind(state)
  if (!here) return wrapInList(nodeType(name))(state, dispatch, view)
  if (here.name === name) return liftListItem(nodeType(itemFor(name)))(state, dispatch, view)
  // A different kind of list: the wrapper AND its items change together.
  //
  // ⚠️ NOT TWO `setNodeMarkup` CALLS, and the first attempt was. Either order produces a
  // document the schema cannot hold for the length of one step — a `taskItem` inside a
  // `bulletList`, or a `listItem` inside a `taskList` — and `setNodeMarkup` checks, so it
  // throws rather than letting the second step put it right. The whole list is replaced by a
  // rebuilt one in a single step, which is never invalid at any point.
  //
  // The caret survives without being touched: an item's content is the same either way, so
  // the replacement is exactly as long as what it replaces and every position maps to itself.
  if (dispatch) {
    const { $from } = state.selection
    const from = $from.before(here.depth)
    const to = $from.after(here.depth)
    const list = $from.node(here.depth)
    const items = nodeType(itemFor(name))
    const kids: PMNode[] = []
    list.forEach((item) => {
      kids.push(item.type === items ? item : items.create(null, item.content, item.marks))
    })
    dispatch(state.tr.replaceWith(from, to, nodeType(name).create(null, kids)))
  }
  return true
}

/** Which item a list of this kind holds. A task list holds task items and nothing else. */
const itemFor = (list: string): string => (list === 'taskList' ? 'taskItem' : 'listItem')

export const toggleBulletList: Cmd = toggleList('bulletList')
export const toggleOrderedList: Cmd = toggleList('orderedList')
export const toggleTaskList: Cmd = toggleList('taskList')

/**
 * DELETE AT THE END OF A LIST ITEM JOINS THE TWO ITEMS.
 *
 * ⚠️ `joinForward` ON ITS OWN DOES THE WRONG THING HERE, and that is what this replaces. It
 * joins the two TEXTBLOCKS, which pulls the next item's paragraph up INSIDE the current item —
 * `- one` / `- two` becomes one item holding two paragraphs, the second indented. The list has
 * lost a row and gained an indent nobody typed. Measured against the outgoing build, which
 * merged them into `- onetwo`; the package that left bound Delete in four places for this.
 *
 * `join(pos, 2)` rather than two joins: one step, one undo, and never a document that is
 * briefly the wrong shape.
 */
export const joinItemForward: Cmd = (state, dispatch) => {
  const { $from, empty } = state.selection
  if (!empty || $from.parentOffset < $from.parent.content.size) return false
  const depth = itemDepthAt($from)
  if (depth === null) return false
  // Only from the LAST block of the item: Delete in the middle of a multi-paragraph item is an
  // ordinary join and the base keymap already does it right.
  if ($from.index(depth) !== $from.node(depth).childCount - 1) return false
  const list = $from.node(depth - 1)
  if (!list.maybeChild($from.index(depth - 1) + 1)) return false
  if (dispatch) dispatch(state.tr.join($from.after(depth), 2).scrollIntoView())
  return true
}

/** The depth at which the selection sits inside a list ITEM, or null. */
function itemDepthAt($pos: import('prosemirror-model').ResolvedPos): number | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const name = $pos.node(depth).type.name
    if (name === 'listItem' || name === 'taskItem') return depth
  }
  return null
}

/**
 * TAB IN THE LAST CELL OF A TABLE ADDS A ROW.
 *
 * ⚠️ WITHOUT IT, TAB IN THE LAST CELL LEAVES THE EDITOR. `goToNextCell` answers false there, so
 * the keystroke falls through to the browser and the focus goes to whatever is next on the
 * page — in the middle of writing a table. The outgoing build added a row; so does this.
 */
export const tabOutOfTable: Cmd = (state, dispatch, view) => {
  if (!isInTable(state)) return false
  // A next cell to go to: that is the ordinary case and the whole of it.
  if (goToNextCell(1)(state, dispatch, view)) return true
  if (!addRowAfter(state)) return false
  if (dispatch) {
    // ⚠️ THE ROW AND THE CARET ARE ONE TRANSACTION, built by hand rather than by running the
    // two commands in turn: `goToNextCell` reads the state it is given, and the state that has
    // the new row in it does not exist until the first command's transaction is applied. So the
    // row is added, the resulting state is derived here, and the caret is placed in it.
    let made: import('prosemirror-state').Transaction | null = null
    addRowAfter(state, (tr) => { made = tr })
    const tr = made as import('prosemirror-state').Transaction | null
    if (!tr) return false
    goToNextCell(1)(state.apply(tr), (next) => {
      // The selection the second command wants, replayed onto the first command's transaction.
      dispatch(tr.setSelection(next.selection.map(tr.doc, tr.mapping)))
    })
    if (!tr.selectionSet) dispatch(tr)
  }
  return true
}

/** Enter inside a list item. Both item kinds, chosen by where the caret is. */
export const splitItem: Cmd = (state, dispatch, view) => {
  const here = listKind(state)
  if (!here) return false
  return splitListItem(nodeType(itemFor(here.name)))(state, dispatch, view)
}
export const liftItem: Cmd = (state, dispatch, view) => {
  const here = listKind(state)
  if (!here) return false
  return liftListItem(nodeType(itemFor(here.name)))(state, dispatch, view)
}
export const sinkItem: Cmd = (state, dispatch, view) => {
  const here = listKind(state)
  if (!here) return false
  return sinkListItem(nodeType(itemFor(here.name)))(state, dispatch, view)
}

/**
 * ENTER ON A LINE THAT IS ONLY A FENCE OPENER MAKES THE FENCE.
 *
 * ⚠️ THE TYPING RULE CANNOT DO THIS, and the first cut assumed it could. `^```([a-z]+)?[\s\n]$`
 * fires on a typed WHITESPACE character, and Enter is not one — it is a key. So typing
 * ```` ```js ```` and pressing Enter left three backticks as text, which the save then escaped:
 * the writer got `\`\`\`js` in their post. The outgoing editor bound Enter for exactly this.
 *
 * The space still works through the rule; this is the other way in.
 */
export const fenceFromOpener: Cmd = (state, dispatch) => {
  const { $from, empty } = state.selection
  if (!empty || $from.parent.type !== nodeType('paragraph')) return false
  const opener = /^(?:```|~~~)([\w+#.-]*)$/.exec($from.parent.textContent)
  if (!opener) return false
  if (dispatch) {
    const from = $from.before()
    const block = nodeType('codeBlock').createAndFill({ language: opener[1] || null })
    if (!block) return false
    const tr = state.tr.replaceWith(from, $from.after(), block)
    dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(from + 1))).scrollIntoView())
  }
  return true
}

/** A node inserted at the caret, replacing whatever is selected. */
export const insertNode = (name: string, attrs?: Record<string, unknown>): Cmd => (state, dispatch) => {
  const type = nodeType(name)
  if (dispatch) {
    const node = type.createAndFill(attrs)
    if (!node) return false
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView())
  }
  return true
}

export const setHorizontalRule: Cmd = insertNode('horizontalRule')
export const setImage = (attrs: Record<string, unknown>): Cmd => insertNode('image', attrs)
export const setVideo = (src: string): Cmd => insertNode('video', { src })

/** A formula, inline or block, at the caret. */
export const setMath = (display: boolean, tex = ''): Cmd =>
  insertNode(display ? 'mathBlock' : 'mathInline', { tex, display })

/**
 * A table, with a header row, made of empty paragraphs.
 *
 * `prosemirror-tables` has no "insert a table" — its commands all start from a caret already
 * inside one — so the node is built here. Three by three with a header is what the toolbar
 * button has always made.
 */
export const insertTable = (rows = 3, cols = 3, withHeader = true): Cmd => (state, dispatch) => {
  if (dispatch) {
    const cell = (header: boolean): PMNode =>
      nodeType(header ? 'tableHeader' : 'tableCell').createAndFill()!
    const row = (header: boolean): PMNode =>
      nodeType('tableRow').create(null, Array.from({ length: cols }, () => cell(header)))
    const body = Array.from({ length: Math.max(1, rows - (withHeader ? 1 : 0)) }, () => row(false))
    const table = nodeType('table').create(null, withHeader ? [row(true), ...body] : body)
    dispatch(state.tr.replaceSelectionWith(table).scrollIntoView())
  }
  return true
}

/** The five table edits the toolbar offers, each refusing outside a table. */
const inTable = (fn: Cmd): Cmd => (state, dispatch, view) =>
  (isInTable(state) ? fn(state, dispatch, view) : false)
export const tableAddColumnAfter = inTable(addColumnAfter as Cmd)
export const tableAddRowAfter = inTable(addRowAfter as Cmd)
export const tableDeleteColumn = inTable(deleteColumn as Cmd)
export const tableDeleteRow = inTable(deleteRow as Cmd)
export const tableDelete = inTable(deleteTable as Cmd)
