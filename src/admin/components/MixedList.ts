// A list that is part bullets and part checkboxes, on its way INTO the editor.
//
// In Markdown this is one list:
//
//     - một
//     - hai
//     - [x] ba
//
// GFM says item three carries a checkbox, and `markdown-it-task-lists` agrees: it tags THAT
// `<li>` with `task-list-item` and the surrounding `<ul>` with `contains-task-list`.
// `tiptap-markdown` then reads the list-level class and sets `data-type="taskList"` on the
// whole thing — all three items — which is where the document starts coming apart, because
// this schema has two different nodes and a `taskList` may only hold `taskItem`s.
//
// ProseMirror repairs the mismatch the only way it can. The two plain items do not match
// `taskItem`, so they are lifted out into a list of their own; the `taskList` is then empty and
// its content rule demands at least one item, so an EMPTY one is inserted. The post gains a
// blank checkbox it never had:
//
//     - [ ]                         <- was not written by anybody
//
//     - một
//     - hai
//
//     - [x] ba
//
// and it does not stop there. That stray line parses on the NEXT open as a task item with no
// text, which serializes to `- \[ \]`, which parses as an escaped bracket, which... Each save
// leaves more behind than the last, which is the definition of the failure this repo's
// round-trip suites exist to catch — and the one shape none of them held, because nobody
// writes a fixture that mixes two kinds of list.
//
// THE FIX IS A SPLIT, done before ProseMirror ever sees the HTML: a run of checkbox items
// becomes a `taskList`, a run of plain items becomes a plain list, in the order they were
// written. Nothing is invented and nothing is dropped. The Markdown that comes back out is the
// Markdown that went in, and it is a fixed point: `- một\n- hai\n\n- [x] ba` parses to the same
// two lists again, and splits to the same two nodes again.
//
// WHY AN EXTENSION OF ITS OWN, rather than an override on `TaskList`: the markdown spec of a
// node is looked up BY NODE NAME and merged whole, so supplying `parse` on `taskList` would
// also replace the `setup` that installs `markdown-it-task-lists` and take checkboxes away
// entirely. The parser calls `parse.updateDOM` for EVERY extension that has one, so a nameless
// helper can add a step without taking one over.
import { Extension } from '@tiptap/core'

/** A `<li>` that markdown-it-task-lists marked as carrying a checkbox. */
const isTask = (item: Element): boolean => item.classList.contains('task-list-item')

/**
 * Split one mixed `<ul>` into consecutive runs of the same kind.
 *
 * The new lists are inserted before the original and the original is removed, so a nested list
 * inside an item travels with its item — the items themselves are MOVED, never rebuilt.
 */
function splitMixedList(list: Element): void {
  const items = [...list.children].filter((el) => el.tagName === 'LI')
  if (items.length === 0) return
  const kinds = items.map(isTask)
  // Nothing to do for a list that is all one kind — which is nearly every list ever written.
  if (kinds.every((k) => k === kinds[0])) return

  const parent = list.parentElement
  if (!parent) return
  const doc = list.ownerDocument

  let run: Element | null = null
  let runIsTask: boolean | null = null
  for (const item of items) {
    const task = isTask(item)
    if (run === null || task !== runIsTask) {
      run = doc.createElement(list.tagName)
      // The original's attributes come along: `class="tight"` and `data-tight` are how
      // `tiptap-markdown` remembers a list was written without blank lines between its items,
      // and a run built without them saves the SECOND time as a loose list. `start` on an `<ol>`
      // travels the same way. Measured: dropping them cost one blank line per item, on save two.
      for (const attr of list.getAttributeNames()) {
        const value = list.getAttribute(attr)
        if (value !== null) run.setAttribute(attr, value)
      }
      if (task) {
        run.setAttribute('data-type', 'taskList')
        run.classList.add('contains-task-list')
      } else {
        // And the checkbox marks must NOT come along to a run of plain bullets, or the
        // library's own `updateDOM` — which reads exactly these two — hands it straight back.
        run.removeAttribute('data-type')
        run.classList.remove('contains-task-list')
      }
      parent.insertBefore(run, list)
      runIsTask = task
    }
    run.appendChild(item)
  }
  list.remove()
}

export const MixedList = Extension.create({
  name: 'mixedList',
  addStorage() {
    return {
      markdown: {
        parse: {
          updateDOM(element: HTMLElement) {
            // Deepest first: an inner list must be split before the outer one moves its items,
            // or the split runs against a node that has already been re-parented.
            const lists = [...element.querySelectorAll('ul, ol')].reverse()
            for (const list of lists) splitMixedList(list)
          },
        },
      },
    }
  },
})
