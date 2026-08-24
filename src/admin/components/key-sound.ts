// Playing a keystroke: the cache, the limiter, and how loud.
//
// The three instruments are DATA (`key-voices.ts`) and the samples are ARITHMETIC
// (`key-render.ts`). What is left here is the part that needs a browser — an AudioContext, a
// buffer, and the one number the owner sets.
//
// Split three ways on 2026-08-25 for a reason that turned out to matter: the owner said the
// three sounds were indistinguishable, and answering that meant MEASURING them rather than
// arguing about them. A generator tangled into an audio graph cannot be measured; a pure
// function returning samples can, and `key-render.test.ts` now holds the three apart by
// their spectra.
import { render } from './key-render'
import { VOICES, type Instrument, type Strike } from './key-voices'
import type { KeyFeedback } from '@/types'

export type { Strike } from './key-voices'

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
 * What the top of the slider means: the gain applied to an instrument at `LEVEL` 1.
 *
 * Raised from an effective 0.11 to 0.23 on 2026-08-25 — *"âm lượng lớn hơn đi"*. Measured
 * A-weighted against the generator it replaces, a letter at the top of the slider is about
 * SEVEN TIMES the amplitude of the old one at ITS top, and the old default was half of that
 * again. A ceiling only twice as loud as a level somebody calls too quiet is the wrong
 * ceiling.
 *
 * The taper is LINEAR on purpose. The usual argument for a curve is that loudness is
 * logarithmic and a linear slider crowds everything into the bottom third — true of a
 * sustained tone across a 60 dB range, and this is a click on a 25 dB range. Measured over
 * that span every five-point step is a step you can hear.
 */
const FULL_SCALE = 0.3

/**
 * One number per instrument, so the three are equally loud to a person, measured rather than
 * guessed. They are not close to each other and they must not be made close.
 *
 * Derived twice and averaged, because the two models disagree and both are right about
 * something:
 *
 *  - **The ear.** A-weighting (IEC 61672) is the standard answer to how much a human cares
 *    about energy at a given frequency. It says a 2.2 kHz crack lands in the most sensitive
 *    octave there is, and a 220 Hz thock lands where the ear gives away a great deal:
 *    1.00 / 2.53 / 0.58.
 *  - **The speaker.** The owner writes on a laptop, whose driver is a sealed 20mm cone that
 *    is down hard below its resonance. Modelled as a second-order high-pass at 250 Hz on top
 *    of the ear, the answer moves a long way: 1.00 / 1.89 / 0.79 — the typewriter loses low
 *    end too, so the crack needs less lift and the thock needs more.
 *
 * The geometric mean of the two is what ships. Matching the three on PEAK AMPLITUDE instead,
 * which is what looks reasonable in code, is how the thock ends up inaudible and the crack
 * ends up painful. Re-measure with the same method if a voice is retuned; do not nudge these
 * by eye.
 */
export const LEVEL: Record<Instrument, number> = {
  woody: 1.0,
  crisp: 2.2,
  deep: 0.68,
}

/**
 * Three renderings of every key, and one is picked at random per strike.
 *
 * A single sample replayed forty times a line stops reading as typing and starts reading as
 * a fault, and pitch jitter alone does not fix it — the noise is identical underneath. Three
 * seeds give three genuinely different sets of contact noise; `playbackRate` then moves each
 * one a few percent, which is a slightly different switch under a slightly different finger.
 */
const VARIANTS = 3
const cache = new Map<string, AudioBuffer[]>()

let audio: AudioContext | null = null
let limiter: WaveShaperNode | null = null

/** 0-100 from the settings row → the multiplier the gain node wants. */
export function gainFor(volume: number): number {
  if (!Number.isFinite(volume)) return 0
  return (Math.min(100, Math.max(0, volume)) / 100) * FULL_SCALE
}

/**
 * A soft ceiling, once, in front of the destination.
 *
 * Not decoration. The three instruments have very different crest factors — a tactile strike
 * peaks about seven times higher above its own loudness than a linear one does — so any
 * level that makes the thock audible puts the crack near full scale, and two of them landing
 * inside twenty milliseconds of each other add. Below 0.7 this is exactly unity, so nothing
 * is coloured until something would otherwise clip; a compressor would have been the reflex
 * and it would pump the whole keyboard down after every loud key.
 */
function ceiling(context: AudioContext): WaveShaperNode {
  if (limiter) return limiter
  const knee = 0.7
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1
    const m = Math.abs(x)
    curve[i] = Math.sign(x) * (m <= knee ? m : knee + (1 - knee) * Math.tanh((m - knee) / (1 - knee)))
  }
  limiter = context.createWaveShaper()
  limiter.curve = curve
  limiter.oversample = '2x'
  limiter.connect(context.destination)
  return limiter
}

/**
 * The three takes of one key, level-matched to the first of them.
 *
 * The matching is not tidiness. Noise is noise: measured across three seeds the peak of one
 * rendering of a tactile letter ranged from 1.08 to 1.69, which at the top of the slider is
 * the difference between sitting under the ceiling and being flattened by it. Two takes of
 * the same key should differ in grain, not in how hard somebody hit it.
 *
 * Exported so the test can measure what actually plays rather than a re-implementation of
 * it — the last time this file kept its levels to itself, nothing could tell the owner the
 * three instruments had converged.
 */
export function takes(mode: Instrument, kind: Strike, sampleRate: number): Float32Array[] {
  const out: Float32Array[] = []
  let reference = 0
  for (let v = 0; v < VARIANTS; v += 1) {
    // The seed is the only thing that differs between takes, so a take is reproducible and
    // a test can say which one it is looking at.
    const samples = render(VOICES[mode][kind], sampleRate, 0x9e37 + v * 7919)
    let sum = 0
    for (const x of samples) sum += x * x
    const rms = Math.sqrt(sum / samples.length)
    if (v === 0) reference = rms
    else if (rms > 0) for (let i = 0; i < samples.length; i += 1) samples[i]! *= reference / rms
    out.push(samples)
  }
  return out
}

function buffers(context: AudioContext, mode: Instrument, kind: Strike): AudioBuffer[] {
  const key = `${mode}:${kind}:${context.sampleRate}`
  const held = cache.get(key)
  if (held) return held
  const made = takes(mode, kind, context.sampleRate).map((samples) => {
    const buffer = context.createBuffer(1, samples.length, context.sampleRate)
    buffer.getChannelData(0).set(samples)
    return buffer
  })
  cache.set(key, made)
  return made
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
  strike(sound, [kind])
}

/**
 * A few keys in a row, so somebody can actually judge the thing they are setting.
 *
 * Added 2026-08-25 after the owner reported that dragging the slider produced no sound.
 * Measured in a real browser on the deployed build, it produced 0.61 of full scale at the
 * destination — the audio was there. What was not there was anything to NOTICE: one 40ms
 * tick, once per 110ms of dragging, is a sound you have to already be expecting. Four keys
 * and a space is a sound you cannot miss, and it is also the only way to hear the thing that
 * distinguishes these three, which is what a RUN of them sounds like.
 */
export function playPhrase(sound: KeySound): void {
  strike(sound, ['tap', 'tap', 'tap', 'space', 'tap', 'tap'])
}

/**
 * The same key, played by the settings screen while somebody is dragging.
 *
 * Deliberately the ordinary letter rather than a phrase: while the slider is moving, the
 * question is "how loud is a key", and forty overlapping phrases is not an answer.
 */
export function previewKey(sound: KeySound): void {
  strike(sound, ['tap'])
}

/** Gap between keys in a phrase, seconds. A shade under an ordinary typing speed. */
const PHRASE_GAP = 0.135

function strike(sound: KeySound, kinds: Strike[]): void {
  if (sound.mode === 'off') return
  const level = gainFor(sound.volume)
  if (level <= 0) return
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return
  audio ??= new AudioContextClass()
  const context = audio
  // A context that has not been unlocked yet cannot be handed a source and told to start
  // NOW: its clock is not moving, so the scheduled moment is already in the past by the time
  // the resume lands, and the sound is dropped without an error. Chrome unlocks a context
  // built inside a gesture; Safari does not, and the very first key a writer presses is
  // exactly the one that would go missing.
  if (context.state === 'suspended') {
    void context.resume().then(() => fire(context, sound, kinds)).catch(() => {})
    return
  }
  fire(context, sound, kinds)
}

function fire(context: AudioContext, sound: KeySound, kinds: Strike[]): void {
  if (sound.mode === 'off') return
  const level = gainFor(sound.volume) * LEVEL[sound.mode]
  const start = context.currentTime
  kinds.forEach((kind, i) => {
    const pool = buffers(context, sound.mode as Instrument, kind)
    const source = context.createBufferSource()
    source.buffer = pool[Math.floor(Math.random() * pool.length)] ?? pool[0]!
    // Pitch and length together, which is what a different switch under a different finger
    // actually changes — moving a filter frequency instead leaves the transient identical.
    source.playbackRate.value = 0.96 + Math.random() * 0.09
    const gain = context.createGain()
    gain.gain.value = level * (0.92 + Math.random() * 0.16)
    source.connect(gain).connect(ceiling(context))
    source.start(start + i * PHRASE_GAP)
  })
}
