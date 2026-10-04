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
import type { Editor } from '@/admin/editor/editor'
import { playKey, warmKeys, type KeySound } from './key-sound'
import type { Strike } from './key-voices'
import { KeyBurst } from './key-burst'
import { motionOn, dur, ease } from '@/admin/motion'

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

/** Carets with a placement already waiting for the next frame. */
const queued = new WeakSet<HTMLElement>()

/**
 * Put the drawn caret where the selection is, once per frame however often it is asked.
 *
 * ⚠️ ONE FRAME, ONE MEASUREMENT. A keystroke asks three times — its `beforeinput`, the
 * selection update its transaction makes, and its `keyup` — and an input method's rewrite asks
 * once per event inside it. Each answer was its own animation frame calling `coordsAtPos` and
 * `getBoundingClientRect`, so a single key read the layout up to three times over. The caret
 * can only be in one place when the frame is drawn; it is measured once, there.
 */
export function placeCaret(view: Editor['view'], caret: HTMLElement | null): void {
  if (!caret || queued.has(caret)) return
  queued.add(caret)
  requestAnimationFrame(() => {
    queued.delete(caret)
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
 * THE INPUT TYPES THAT ARE A FINGER ON A KEY, and nothing else makes a sound.
 *
 * The test used to be "starts with insert or delete", which let in every way text arrives
 * without a key: `insertFromPaste` and `insertFromDrop` struck a key for a whole article,
 * `deleteByCut` struck a delete, and `insertReplacementText` — the spelling checker, or the
 * Mac's autocorrect swapping a word as the space goes in — struck a second key on top of the
 * space that caused it. The documentation promised paste was silent; it never was.
 */
const KEYED = new Set([
  'insertText', 'insertCompositionText', 'insertParagraph', 'insertLineBreak', 'insertTranspose',
  'deleteContentBackward', 'deleteContentForward', 'deleteWordBackward', 'deleteWordForward',
  'deleteSoftLineBackward', 'deleteSoftLineForward', 'deleteHardLineBackward',
  'deleteHardLineForward', 'deleteEntireSoftLine',
])

/**
 * Which key this was, as far as any of the three instruments is concerned.
 *
 * A return is its own answer and not a loud space, because on a typewriter it is not even
 * the same mechanism: the space bar lets the carriage step once, and the return throws it
 * all the way back across the machine and into the stop.
 */
function strikeOf(inputType: string, data: string | null): Strike {
  if (inputType.startsWith('delete')) return 'back'
  if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') return 'return'
  // The LAST character, because an input method that rewrites a word and its space in one
  // insert (`ếng `) is carrying the space the writer pressed.
  return data && data.endsWith(' ') ? 'space' : 'tap'
}

/** What the writing surface hands over: the key behind an edit, the edit, and the IME's edges. */
export type KeyFeedback = {
  /** Every `keydown`: when the key was made, and whether it is a held key repeating. */
  key: (event: KeyboardEvent) => void
  /** Every `beforeinput`. */
  input: (view: Editor['view'], event: InputEvent) => void
  /** `compositionstart` and `compositionend`: a word an input method is building begins or ends. */
  composition: () => void
}

/**
 * The editor's answer to the hand, built once per writing surface.
 *
 * ⚠️ TIMED BY THE KEY, NOT BY THE EVENT. `beforeinput` is stamped when the page gets round to
 * it; `keydown` is stamped when the key was made. On a long post with the page busy for a
 * moment, three keys typed 90 ms apart reach `beforeinput` back to back — and timed by that,
 * three real keys would be taken for one input-method burst and two of them silenced. The
 * keydown's stamp is the one a busy page cannot move, so it is the one `KeyBurst` is fed.
 * An insert with no keydown before it (an input method that posts text directly) falls back
 * to its own stamp, which is the best there is.
 */
export function keyFeedback(
  caret: () => HTMLElement | null,
  sound: KeySound,
  // The player, handed in so `key-feedback.test.ts` can count strikes and read their kinds
  // without an audio engine. Nothing else passes it.
  play: (sound: KeySound, kind: Strike) => void = playKey,
): KeyFeedback {
  /** The last keydown, until the edit it caused has been heard. */
  let pressed: { at: number; repeat: boolean; seen: number } | null = null
  /** What the input method is showing for the word it is building, so its echo is known. */
  let composed = ''

  const burst = new KeyBurst((kind) => {
    play(sound, kind)
    // The carriage step, once per KEY: an input method's four events were four twitches.
    const drawn = caret()
    if (sound.mode !== 'woody' || !drawn || !motionOn()) return
    // Compositor-only, on the caret and nothing else. `transform` and `opacity` on one 2px
    // element cost a composite; the version this replaced repainted a whole paragraph.
    drawn.animate(
      kind === 'back'
        ? [{ transform: 'translateX(-2px) scaleY(0.86)' }, { transform: 'translateX(0) scaleY(1)' }]
        : [{ transform: 'translateY(1px) scaleY(0.9)' }, { transform: 'translateY(0) scaleY(1)' }],
      // ⚠️ THE ENGINE'S FAST, not a fourth curve and a fourth number. This was 110ms on
      // cubic-bezier(.2,.8,.2,1), which nothing else in the product used; the settle is 40ms
      // longer now and on the one curve everything else settles on.
      { duration: dur('fast'), easing: ease() },
    )
  })

  return {
    key: (event) => {
      if (sound.mode === 'off') return
      pressed = { at: event.timeStamp, repeat: event.repeat, seen: performance.now() }
      // The first key of a session is the one that would pay for the audio machinery: build
      // it now, while this key is still on its way to the page (`warmKeys`, key-sound.ts).
      warmKeys(sound)
    },
    composition: () => { composed = '' },
    input: (view, event) => {
      if (sound.mode === 'off') return
      const type = event.inputType
      if (!KEYED.has(type)) return
      // The keydown that caused this, if one did and it has not been spent. Fifty ms is far
      // longer than a keydown and its edit are ever apart, and short enough that a navigation
      // key nobody typed text with cannot lend its time to some later insert.
      const key = pressed && performance.now() - pressed.seen < 50 ? pressed : null
      pressed = null
      placeCaret(view, caret())
      holdBlink(caret())

      // A HELD KEY IS SILENT after its first strike, which is the machine telling the truth:
      // a switch held down does not click again, and a typewriter key held down does not
      // strike again. Before this, holding Backspace was thirty deletes a second, every one
      // of them heard.
      if (key?.repeat) return

      let kind: Strike
      if (type === 'insertCompositionText') {
        const data = event.data ?? ''
        // ⚠️ THE COMMIT'S ECHO. Chrome commits a composed word by inserting it once more, with
        // the same text, and THEN the space or return that committed it arrives as its own
        // edit. Heard, every word ended on two strikes — measured, 57 for 49 keys. A
        // composition update that changes nothing on screen was not a key.
        if (data === composed) return
        // Backspace inside a composition shortens it rather than deleting anything.
        kind = data.length < composed.length && composed.startsWith(data) ? 'back' : 'tap'
        composed = data
      } else {
        // Anything else that is composing is the input method's bookkeeping, not a key.
        if (event.isComposing) return
        kind = strikeOf(type, event.data)
      }
      burst.feed(kind, key ? key.at : event.timeStamp, key !== null)
    },
  }
}
