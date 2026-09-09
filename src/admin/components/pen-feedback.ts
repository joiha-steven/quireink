// What the editor does when the pen lands (ADR 0049): the mark just applied draws itself
// across the words, and the felt tip squeaks.
//
// The same seam as `key-feedback.ts`, and it matters for the same reason: everything here
// stays OUTSIDE ProseMirror's document. A transaction that adds a pen mark is noticed after
// the fact, the DOM elements it produced get a class for a beat, and the class is what the
// stylesheet animates. No attribute in the document, nothing serialised, nothing that a
// later transaction has to know about — and if ProseMirror redraws the node before the beat
// is over, the class goes with it and nothing is the worse.
//
// Only a mark being APPLIED. Opening a document full of marks, typing inside one, moving
// the caret through one: none of those add a mark step, so none of them sweep. The rule the
// key feedback lives by holds here too — the words never move; only the ink under them is
// arriving.

import type { Editor as TiptapEditor } from '@tiptap/react'
import type { Transaction } from '@tiptap/pm/state'
import { AddMarkStep } from '@tiptap/pm/transform'
import { motionOn } from '@/admin/motion'
import { playSqueak, type Gesture } from './pen-sound'
import type { KeySound } from './key-sound'

/** How long the class stays: the longest of the three animations, and a little. */
const FRESH_MS = 320

const GESTURE: Record<string, Gesture> = { ink: 'hl', underline: 'u', ring: 'o' }

/** The pen marks a transaction applied: gesture and range, one per step. */
export function penStepsOf(tr: Transaction): { kind: Gesture; from: number; to: number }[] {
  const out: { kind: Gesture; from: number; to: number }[] = []
  for (const step of tr.steps) {
    if (!(step instanceof AddMarkStep)) continue
    const kind = GESTURE[step.mark.type.name]
    if (kind) out.push({ kind, from: step.from, to: step.to })
  }
  return out
}

/** The mark elements under a range, once the view has drawn them. */
function elementsIn(view: TiptapEditor['view'], from: number, to: number): HTMLElement[] {
  const found = new Set<HTMLElement>()
  view.state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return
    let dom: Node | null = null
    try { dom = view.domAtPos(Math.max(from, pos) + 1).node } catch { return }
    const el = (dom instanceof Element ? dom : dom?.parentElement)?.closest('mark, u')
    if (el instanceof HTMLElement && view.dom.contains(el)) found.add(el)
  })
  return [...found]
}

export function penStrokes(view: TiptapEditor['view'], tr: Transaction, sound: KeySound): void {
  const steps = penStepsOf(tr)
  if (steps.length === 0) return
  // One squeak per gesture per transaction: a mark across three text nodes is one stroke.
  const heard = new Set<Gesture>()
  for (const { kind } of steps) {
    if (heard.has(kind)) continue
    heard.add(kind)
    playSqueak(sound, kind)
  }
  if (!motionOn()) return
  requestAnimationFrame(() => {
    const fresh = steps.flatMap(({ from, to }) => elementsIn(view, from, to))
    for (const el of fresh) el.classList.add('pen-fresh')
    window.setTimeout(() => { for (const el of fresh) el.classList.remove('pen-fresh') }, FRESH_MS)
  })
}
