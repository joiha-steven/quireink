// FOCUS MODE: one switch that takes everything off the writing screen except the writing.
//
// Two readers who are not on one branch of anything — the write COLUMN beside the paper, and
// the sheet's own action line — so the switch is a fact in storage and a window event, rather
// than a value threaded from one to the other.
//
// It lives in `localStorage` and not in Settings because it is a fact about this person at this
// desk this afternoon rather than a fact about the blog: the same reasoning as the rail's icon
// switch. And it must never be the reason an editor fails to open, which is why every access
// is in a `try` — a private window throws on read as readily as on write.
const KEY = 'quireink-admin-focus'
const EVENT = 'quireink:focus'

export function focusOn(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setFocus(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    // See above. The switch still works for this page; what is lost is only its memory.
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Hear every change, including the ones this page made. Returns the way to stop hearing. */
export function onFocusChange(run: () => void): () => void {
  window.addEventListener(EVENT, run)
  return () => window.removeEventListener(EVENT, run)
}
