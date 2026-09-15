// A SENTENCE CARRIED ACROSS A NAVIGATION, and the way back out of what it reports.
//
// ⚠️ A TOAST DIES WITH THE PAGE, and under ADR 0054 leaving a screen is a real navigation. The
// editor's Trash key is where that matters: the delete is soft and asks nothing BECAUSE the
// undo is in the toast — and then the piece is gone, so the editor has to leave, and the toast
// it just raised goes with it. The argument for asking nothing collapses the moment the way
// back does.
//
// So the sentence and its undo travel in `sessionStorage`: per tab, cleared with the tab, read
// exactly once on the other side. What travels is the RESTORE's ingredients, never a function —
// nothing can be serialised across a page load except data.
import { say } from './media-bridge'

const SLOT = 'quire:say-next'

export type Carried = {
  message: string
  /** What Restore would put back: the trash API's own three arguments. */
  undo?: { label: string; kind: string; ids: string[] }
}

/** Leave the sentence for the page being navigated TO. */
export function sayAcross(carried: Carried): void {
  try {
    sessionStorage.setItem(SLOT, JSON.stringify(carried))
  } catch {
    // A private window, or storage switched off. The navigation still happens; what is lost is
    // the undo, and the Trash screen is still the durable way back.
  }
}

/** Raise anything left for this page, once. Called by the screens a departure lands on. */
export function saySettled(): void {
  let carried: Carried | null = null
  try {
    const raw = sessionStorage.getItem(SLOT)
    // READ AND CLEARED IN THE SAME BREATH: a sentence still in the slot would be said again on
    // the next visit to this screen, reporting a deletion that happened an hour ago.
    sessionStorage.removeItem(SLOT)
    carried = raw ? (JSON.parse(raw) as Carried) : null
  } catch {
    carried = null
  }
  if (!carried?.message) return
  const undo = carried.undo
  say(carried.message, undefined, undo
    ? {
      label: undo.label,
      run: () => {
        void fetch('/api/trash', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: undo.kind, action: 'restore', ids: undo.ids }),
        }).then(() => location.reload())
      },
    }
    : undefined)
}
