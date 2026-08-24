// The keyboard, as sound. Filtered noise, made on the spot — there are no audio files in
// this product and none are wanted: a key click is a burst of noise through a bandpass,
// which is thirty lines and nothing on the wire.
//
// Split out of `key-feedback.ts` on 2026-08-25, when the volume became a setting. The
// settings screen has to be able to PLAY a key — a volume control you cannot hear while you
// are setting it sends you to the editor and back for every nudge — and `key-feedback.ts`
// imports Tiptap. This half knows nothing about an editor, so both the writing surface and
// the slider that tunes it can hold it without dragging a document model behind them.
import type { KeyFeedback } from '@/types'

/**
 * The instrument and how loud it is, together, because they are one answer.
 *
 * Threaded as ONE prop through the four components between the settings row and the
 * keystroke (view → page → form → editor). Two would have been two, and the next thing this
 * grows would have been three: the shape of the answer belongs in a type, not in a prop
 * list that every intermediate component has to re-type without caring about either half.
 */
export type KeySound = { mode: KeyFeedback; volume: number }

/**
 * What the top of the volume slider means, as a multiplier on the per-voice gains below.
 *
 * The gains are the BALANCE between the three instruments and between a letter and a space,
 * hand-tuned; this is the one number that says how loud the whole thing is, so the balance
 * survives every move of the slider. 2.5 puts the loudest strike at about 0.3 of full scale
 * — audible across a room over speakers, and still a third of the way from clipping, which
 * matters because two transients of a tactile switch can land within twelve milliseconds of
 * each other and add.
 *
 * The taper is LINEAR on purpose. The usual argument for a curve is that loudness is
 * logarithmic and a linear slider crowds everything into the bottom third — true of a
 * sustained tone across a 60 dB range, and this is a 20 dB range on a click twenty
 * milliseconds long. Measured over that span every five-point step is a step you can hear.
 */
const FULL_SCALE = 2.5

let audio: AudioContext | null = null

/**
 * The three voices.
 *
 * `jitter` is what keeps it from sounding like a machine. A real board never makes the same
 * sound twice — the finger lands differently, the switch is a different one — and a click
 * repeated identically forty times a line stops reading as typing and starts reading as a
 * fault. Every strike moves its own filter and its own level a little.
 */
type Voice = { hz: number; q: number; secs: number; gain: number; decay: number; bump?: number }

export type Strike = 'tap' | 'back' | 'space'

const VOICES: Record<Exclude<KeyFeedback, 'off'>, Record<Strike, Voice>> = {
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

/** 0-100 from the settings row → the multiplier the gain node wants. */
export function gainFor(volume: number): number {
  if (!Number.isFinite(volume)) return 0
  return (Math.min(100, Math.max(0, volume)) / 100) * FULL_SCALE
}

function strike(context: AudioContext, voice: Voice, at: number, level: number): void {
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
  gain.gain.value = voice.gain * level * jitter
  source.connect(filter).connect(gain).connect(context.destination)
  source.start(at)
}

/**
 * One key, heard.
 *
 * Silent at volume 0 without opening an AudioContext, which is the point of checking before
 * the context and not after: a browser counts a suspended context against the tab, and a
 * writer who turned the sound off should not be paying for the machinery that would have
 * made it.
 */
export function playKey(sound: KeySound, kind: Strike): void {
  if (sound.mode === 'off') return
  const level = gainFor(sound.volume)
  if (level <= 0) return
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return
  audio ??= new AudioContextClass()
  const context = audio
  if (context.state === 'suspended') void context.resume()
  const voice = VOICES[sound.mode][kind]
  const now = context.currentTime
  // The bump first at half level, then the bottom-out: the order a finger meets them.
  if (voice.bump) strike(context, voice, now, level * 0.55)
  strike(context, voice, now + (voice.bump ?? 0), level)
}

/**
 * The same key, played by the settings screen while somebody is choosing.
 *
 * Deliberately the ordinary letter rather than a demonstration phrase: the question the
 * slider is asking is "how loud is a key", and the honest answer is one key at that volume.
 */
export function previewKey(sound: KeySound): void {
  playKey(sound, 'tap')
}
