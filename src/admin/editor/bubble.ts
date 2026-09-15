// THE BAR THAT FOLLOWS THE SELECTION (ADR 0054 step 7).
//
// Select a phrase and a small strip appears above it with the emphasis keys on it. This was
// `@tiptap/extension-bubble-menu`, which is a wrapper around `floating-ui` — a general
// positioning engine with middleware, collision detection against arbitrary boundaries, and an
// autoUpdate loop. What this product asks of it is: above the selection, centred, flipped below
// when the top of the sheet is in the way.
//
// ⚠️ `coordsAtPos` IS THE WHOLE OF IT. ProseMirror answers where a document position is on the
// screen, in viewport coordinates, and the bar is `position: fixed`, so there is no offset
// parent to compensate for and no scroll to subtract. Everything below is arithmetic on two
// rectangles.
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

export type BubbleOptions = {
  /** The strip itself. Positioned, shown and hidden; never re-parented. */
  element: HTMLElement
  /** Whether the bar belongs on screen for this state. */
  shouldShow: (args: { state: EditorState; from: number; to: number }) => boolean
  /** How much room to leave at the top of the window before flipping below. Read fresh. */
  avoidTop: () => number
  /** The gap between the selection and the bar. */
  offset?: number
}

export const BUBBLE_KEY = new PluginKey('quireBubbleBar')

/**
 * Where the bar goes for the current selection, or null when it does not belong on screen.
 *
 * Exported so it can be reasoned about without a browser: it takes numbers and returns numbers.
 */
export function placeBar(
  sel: { left: number; right: number; top: number; bottom: number },
  bar: { width: number; height: number },
  room: { width: number; height: number },
  opts: { offset: number; avoidTop: number },
): { left: number; top: number; flipped: boolean } {
  const middle = (sel.left + sel.right) / 2
  // Centred on the selection, then pushed back inside the window. 8px of margin either side so
  // the bar never sits flush against the edge.
  const left = Math.max(8, Math.min(middle - bar.width / 2, room.width - bar.width - 8))
  const above = sel.top - bar.height - opts.offset
  // ⚠️ `avoidTop` IS THE STICKY CHROME, not the window. The action line and the button strip are
  // fixed at the top of the sheet, so "there is room above" has to mean "above the strip" — a
  // bar that measured against the window alone would be placed under the toolbar, which is
  // exactly as invisible as being off screen.
  const flipped = above < opts.avoidTop
  const below = sel.bottom + opts.offset
  const top = flipped
    ? Math.min(below, room.height - bar.height - 8)
    : above
  return { left, top, flipped }
}

export function bubblePlugin(opts: BubbleOptions): Plugin {
  const offset = opts.offset ?? 8
  const bar = opts.element
  bar.style.position = 'fixed'
  bar.hidden = true

  const place = (view: EditorView): void => {
    const { state } = view
    const { from, to } = state.selection
    if (!opts.shouldShow({ state, from, to })) { bar.hidden = true; return }

    // Shown BEFORE it is measured: a hidden element has no size, and a bar placed from a zero
    // rectangle lands at the left edge for one frame, which reads as a flicker every time a
    // word is selected.
    bar.hidden = false
    const start = view.coordsAtPos(from)
    const end = view.coordsAtPos(to)
    const sel = {
      left: Math.min(start.left, end.left),
      right: Math.max(start.right, end.right),
      top: Math.min(start.top, end.top),
      bottom: Math.max(start.bottom, end.bottom),
    }
    const box = bar.getBoundingClientRect()
    const at = placeBar(
      sel,
      { width: box.width, height: box.height },
      { width: window.innerWidth, height: window.innerHeight },
      { offset, avoidTop: opts.avoidTop() },
    )
    bar.style.left = `${Math.round(at.left)}px`
    bar.style.top = `${Math.round(at.top)}px`
    bar.dataset.placement = at.flipped ? 'bottom' : 'top'
  }

  return new Plugin({
    key: BUBBLE_KEY,
    view: (view) => {
      // ⚠️ THE BAR IS PUT IN THE DOCUMENT HERE, and forgetting it is what a tour flow caught:
      // the caller BUILDS the strip, and the package that used to take it also appended it.
      //
      // ⚠️ AND IT GOES BESIDE THE WRITING SURFACE, NOT ON `<body>`. `z-40` on this bar means
      // "above the sticky toolbar's z-10", and a z-index is only a comparison WITHIN a stacking
      // context — on the body it is being compared with the sheet's card instead, which then
      // takes the click. The tour caught that too, in the same flow, one attempt later.
      if (bar.parentElement === null) (view.dom.parentElement ?? document.body).appendChild(bar)
      // The window's own two: a scroll moves the selection under a bar that is fixed, and a
      // resize changes what "there is room above" means.
      const again = (): void => place(view)
      window.addEventListener('scroll', again, true)
      window.addEventListener('resize', again)
      place(view)
      return {
        update: () => place(view),
        destroy: () => {
          window.removeEventListener('scroll', again, true)
          window.removeEventListener('resize', again)
          bar.hidden = true
          bar.remove()
        },
      }
    },
  })
}
