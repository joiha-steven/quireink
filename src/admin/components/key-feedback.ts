// What the editor does when a key lands: an overlay caret, and a click made on the spot.
//
// Was `typewriter.ts`, split from Editor.tsx at the 400-line cap. Renamed on 2026-08-24 when
// the one switch became a choice of instrument — typewriter, tactile, linear, off — because
// a file called `typewriter` cannot honestly hold a linear switch. The seam is unchanged and
// still clean: everything here stays OUTSIDE ProseMirror's document, so there are no
// character wrappers, no document mutations and no selection changes.
//
// ⚠️ WHAT IS NOT HERE ANY MORE, and it is the important part. Every keystroke used to
// animate the whole BLOCK — `opacity: 0.9 → 1` and a 0.6px nudge on the paragraph being
// typed into. At sixty words a minute that is a paragraph strobing five times a second
// under the reader's eyes, and the owner's word for it was "nháy". Nothing that moves the
// TEXT survives: the sound carries the keystroke, the caret carries the position, and the
// words hold still. On a real machine the paper moves and the words do not.
import { type Editor as TiptapEditor } from '@tiptap/react'
import { playKey, type KeySound } from './key-sound'

/**
 * How long the caret holds still after the last keystroke before it starts blinking again.
 *
 * The second half of the same complaint: a caret blinking through a burst of typing is a
 * second flicker competing with the first. Every editor worth using stops it while the
 * hands are moving — the blink says "the cursor is here and nothing is happening", and
 * something IS happening. 700ms is about a beat and a half of ordinary typing, so a fast
 * writer never sees it blink at all and a pause of any length does.
 */
const SETTLE_MS = 700
let settleTimer = 0

export function placeCaret(view: TiptapEditor['view'], caret: HTMLElement | null): void {
  if (!caret) return
  requestAnimationFrame(() => {
    const stage = caret.parentElement
    const visible = view.hasFocus() && view.state.selection.empty
    if (!stage || !visible) {
      stage?.classList.remove('has-typewriter-caret')
      return
    }
    const cursor = view.coordsAtPos(view.state.selection.head)
    const stageRect = stage.getBoundingClientRect()
    caret.style.left = `${cursor.left - stageRect.left}px`
    caret.style.top = `${cursor.top - stageRect.top}px`
    caret.style.height = `${Math.max(16, cursor.bottom - cursor.top)}px`
    stage.classList.add('has-typewriter-caret')
  })
}

/** Hold the blink for the length of a burst of typing, then let it resume. */
function holdBlink(caret: HTMLElement | null): void {
  if (!caret) return
  caret.classList.add('is-typing')
  window.clearTimeout(settleTimer)
  settleTimer = window.setTimeout(() => caret.classList.remove('is-typing'), SETTLE_MS)
}

/**
 * One keystroke's worth of feedback.
 *
 * The caret moves and, in `typewriter` alone, takes a small step as it goes — that is the
 * carriage, and it is the one motion left in this file. A keyboard does not move the page,
 * so the two mechanical voices leave it alone.
 */
export function pulseInput(
  view: TiptapEditor['view'],
  event: InputEvent,
  caret: HTMLElement | null,
  sound: KeySound,
): void {
  if (sound.mode === 'off') return
  const inputType = event.inputType
  const deleting = inputType.startsWith('delete')
  if (!deleting && !inputType.startsWith('insert')) return

  if (!event.isComposing) {
    // A space and a return come off the two biggest keys on the board and sound like it.
    const wide = event.data === ' ' || inputType === 'insertParagraph' || inputType === 'insertLineBreak'
    playKey(sound, deleting ? 'back' : wide ? 'space' : 'tap')
  }
  placeCaret(view, caret)
  holdBlink(caret)

  if (
    sound.mode !== 'typewriter' ||
    !caret ||
    document.documentElement.dataset.motion === 'off' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) return

  // Compositor-only, on the caret and nothing else. `transform` and `opacity` on one 2px
  // element cost a composite; the version this replaced repainted a whole paragraph.
  caret.animate(
    deleting
      ? [{ transform: 'translateX(-2px) scaleY(0.86)' }, { transform: 'translateX(0) scaleY(1)' }]
      : [{ transform: 'translateY(1px) scaleY(0.9)' }, { transform: 'translateY(0) scaleY(1)' }],
    { duration: 110, easing: 'cubic-bezier(.2,.8,.2,1)' },
  )
}
