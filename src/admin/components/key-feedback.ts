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
import type { KeyFeedback } from '@/types'

const OVERALL_VOLUME = 0.45
let audio: AudioContext | null = null

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
 * The three voices, as filtered noise. No audio files anywhere in this product, and none
 * are wanted: a click is a burst of noise through a filter, which is fifteen lines and no
 * bytes on the wire.
 *
 * `jitter` is what keeps it from sounding like a machine. A real board never makes the same
 * sound twice — the finger lands differently, the switch is a different one — and a click
 * repeated identically forty times a line stops reading as typing and starts reading as a
 * fault. Every strike moves its own filter and its own level a little.
 */
type Voice = { hz: number; q: number; secs: number; gain: number; decay: number; bump?: number }

const VOICES: Record<Exclude<KeyFeedback, 'off'>, { tap: Voice; back: Voice; space: Voice }> = {
  // The machine that strikes: bright, hard, short. A backspace on a typewriter is the
  // carriage moving rather than a typebar hitting, so it is lower and a touch longer.
  typewriter: {
    tap: { hz: 1450, q: 1.1, secs: 0.024, gain: 0.11, decay: 0.18 },
    back: { hz: 620, q: 0.7, secs: 0.032, gain: 0.11, decay: 0.18 },
    space: { hz: 900, q: 0.9, secs: 0.030, gain: 0.12, decay: 0.2 },
  },
  // A bump partway down, then the bottom-out: `bump` schedules the second transient. The
  // gap is what the finger feels as tactility, so it is the whole character of this one.
  tactile: {
    tap: { hz: 980, q: 1.4, secs: 0.020, gain: 0.085, decay: 0.14, bump: 0.012 },
    back: { hz: 780, q: 1.2, secs: 0.024, gain: 0.085, decay: 0.16, bump: 0.012 },
    space: { hz: 520, q: 0.9, secs: 0.034, gain: 0.1, decay: 0.22, bump: 0.014 },
  },
  // No bump at all: one soft, low thock with a slower decay. Nothing about a linear switch
  // is sharp, so neither is this.
  linear: {
    tap: { hz: 620, q: 0.8, secs: 0.030, gain: 0.075, decay: 0.26 },
    back: { hz: 540, q: 0.7, secs: 0.034, gain: 0.075, decay: 0.28 },
    space: { hz: 420, q: 0.7, secs: 0.042, gain: 0.09, decay: 0.32 },
  },
}

function strike(context: AudioContext, voice: Voice, at: number, level = 1): void {
  const jitter = 0.9 + Math.random() * 0.2
  const length = Math.ceil(context.sampleRate * voice.secs)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) {
    samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * voice.decay))
  }
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  source.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.value = voice.hz * jitter
  filter.Q.value = voice.q
  gain.gain.value = voice.gain * OVERALL_VOLUME * level * jitter
  source.connect(filter).connect(gain).connect(context.destination)
  source.start(at)
}

function play(mode: Exclude<KeyFeedback, 'off'>, kind: 'tap' | 'back' | 'space'): void {
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return
  audio ??= new AudioContextClass()
  const context = audio
  if (context.state === 'suspended') void context.resume()
  const voice = VOICES[mode][kind]
  const now = context.currentTime
  // The bump first at half level, then the bottom-out: the order a finger meets them.
  if (voice.bump) strike(context, voice, now, 0.55)
  strike(context, voice, now + (voice.bump ?? 0))
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
  mode: KeyFeedback,
): void {
  if (mode === 'off') return
  const inputType = event.inputType
  const deleting = inputType.startsWith('delete')
  if (!deleting && !inputType.startsWith('insert')) return

  if (!event.isComposing) {
    // A space and a return come off the two biggest keys on the board and sound like it.
    const wide = event.data === ' ' || inputType === 'insertParagraph' || inputType === 'insertLineBreak'
    play(mode, deleting ? 'back' : wide ? 'space' : 'tap')
  }
  placeCaret(view, caret)
  holdBlink(caret)

  if (
    mode !== 'typewriter' ||
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
