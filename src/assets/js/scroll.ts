// The motion engine's scroll loop, on its own so `dom.ts` can re-export it for the book
// files without dragging the rest of the engine (the gate, the fade) into core.js, which
// is budgeted to the byte. Everything else about motion is in motion.ts; new code imports
// `onScrollFrame` from there.

type Sub<T> = { read: () => T; write?: (value: T) => void }
let subs: Sub<unknown>[] = []
let queued = 0
// The document the listeners were bound beside. Under test each file registers its own
// happy-dom window, so binding once per module would leave every file after the first one
// listening to a window that has already gone; keyed on the document rather than the window
// because the registrar re-uses the global object and only the document is new.
let bound: Document | null = null

const frame = () => {
  queued = 0
  // Every read before any write, so the frame forces layout at most once.
  const values = subs.map((s) => s.read())
  subs.forEach((s, i) => s.write?.(values[i]))
}
const ask = () => {
  if (!queued) queued = requestAnimationFrame(frame)
}

/**
 * Something to do on scroll and resize, once per frame and shared with every other watcher.
 *
 * `read` looks at the page (scrollY, rects) and returns what `write` needs; `write` is the
 * only half allowed to touch the DOM. Both run once on subscribe. Returns the unsubscribe.
 */
export function onScrollFrame<T>(read: () => T, write?: (value: T) => void): () => void {
  if (bound !== document) {
    bound = document
    subs = []
    // A frame queued on the old window never runs: left set, it would block every ask.
    queued = 0
    addEventListener('scroll', ask, { passive: true })
    addEventListener('resize', ask)
  }
  const sub = { read, write } as Sub<unknown>
  subs.push(sub)
  write?.(read())
  return () => {
    subs = subs.filter((s) => s !== sub)
  }
}
