// The three instruments, described as the machines they are.
//
// ⚠️ WHY THIS FILE EXISTS AT ALL. Until 2026-08-25 the three "instruments" were ONE
// generator — a burst of white noise through one bandpass — with three centre frequencies.
// That is not three keyboards, it is one sound with three EQ settings, and the owner heard
// it immediately: *"3 loại tiếng ko khác gì nhau"*. A tactile switch and a typewriter do not
// differ by a filter frequency. They differ by what physically happens, how many times, and
// how far apart, so that is what is written down here.
//
// A strike is a SEQUENCE OF EVENTS. Each event is some filtered noise (contact, air, the
// scrape of one part against another) and/or some decaying sinusoids (a body that was struck
// and is now ringing). Timing carries most of the character: the ear reads two transients
// 14ms apart as one crisp event and two 55ms apart as two.

/** A struck body ringing: one mode of it, decaying exponentially. */
export type Tone = { hz: number; gain: number; secs: number }

/** Contact noise through a bandpass. `attack` blunts the onset; leave it out for a click. */
export type Hiss = { hz: number; q: number; gain: number; secs: number; attack?: number }

/** One physical event inside a keystroke, at `at` seconds from the start of it. */
export type Part = { at: number; hiss?: Hiss[]; tones?: Tone[] }

export type Voice = { secs: number; parts: Part[] }

export type Strike = 'tap' | 'back' | 'space' | 'return'

export type Instrument = 'woody' | 'crisp' | 'deep'

/**
 * The carriage thrown back across the machine: it accelerates, so the escapement ticks come
 * FASTER as it goes, and then it hits the stop. Written as a function because eight
 * hand-typed offsets is eight chances to typo a rhythm.
 */
const carriage = (): Part[] => {
  const parts: Part[] = []
  let at = 0
  let gap = 0.021
  for (let i = 0; i < 8; i += 1) {
    parts.push({ at, hiss: [{ hz: 2600, q: 3, gain: 1.5, secs: 0.005 }] })
    at += gap
    gap *= 0.86
  }
  return parts
}

export const VOICES: Record<Instrument, Record<Strike, Voice>> = {
  /**
   * A manual typewriter, which is the one of the three that is not a keyboard at all.
   *
   * Pressing a letter runs a lever, throws a typebar at the platen through an inked ribbon,
   * and lets the carriage step one space. That is THREE events across about 60ms, and the
   * middle one is a piece of metal hitting a rubber roller inside a wooden box — a low
   * thump with a metal ring on top. "Mộc hơn, cơ khí hơn", which is what it is.
   *
   * The two ring frequencies are 1 : 1.64, deliberately not a small whole-number ratio: a
   * struck bar has inharmonic modes, and partials in tune with each other read as a musical
   * note rather than as metal.
   */
  woody: {
    tap: {
      secs: 0.17,
      parts: [
        // The key lever and its spring, under the finger. Blunt onset — nothing has hit
        // anything yet.
        { at: 0, hiss: [{ hz: 620, q: 0.7, gain: 0.5, secs: 0.018, attack: 0.002 }] },
        // The typebar arrives. This is the loud one.
        {
          at: 0.008,
          hiss: [{ hz: 1700, q: 0.8, gain: 2.0, secs: 0.014 }],
          tones: [
            { hz: 214, gain: 0.42, secs: 0.07 }, // platen and the body around it
            { hz: 470, gain: 0.34, secs: 0.06 }, // its second mode
            { hz: 2380, gain: 0.62, secs: 0.065 }, // the typebar itself, ringing
            { hz: 3910, gain: 0.40, secs: 0.045 }, // and its inharmonic partner
          ],
        },
        // The escapement releases and the carriage steps one place. Small, bright, LATE —
        // this is the tick you hear after the thump, and it is most of what makes the sound
        // read as a typewriter rather than as a drum.
        { at: 0.055, hiss: [{ hz: 3100, q: 2.4, gain: 3.4, secs: 0.008 }] },
      ],
    },
    // Backspace moves the carriage the other way. No typebar, so no ring and no platen: a
    // lever and a heavier clunk.
    back: {
      secs: 0.12,
      parts: [
        { at: 0, hiss: [{ hz: 520, q: 0.7, gain: 0.7, secs: 0.02, attack: 0.002 }] },
        {
          at: 0.014,
          hiss: [{ hz: 1150, q: 1.1, gain: 2.3, secs: 0.012 }],
          tones: [{ hz: 262, gain: 0.4, secs: 0.055 }, { hz: 690, gain: 0.62, secs: 0.045 }],
        },
        // Backspace runs the escapement BACKWARDS, so it ticks too — a shade lower than the
        // one a letter makes, because the pawl is engaging the other side of the rack.
        { at: 0.030, hiss: [{ hz: 2700, q: 2.4, gain: 2.4, secs: 0.007 }] },
      ],
    },
    // The space bar is the biggest lever on the machine and it strikes NOTHING: it only lets
    // the carriage step. A dull wooden knock, then the escapement. Genuinely a different
    // sound from a letter, which is why the space bar is worth its own entry.
    space: {
      secs: 0.15,
      parts: [
        {
          at: 0,
          hiss: [{ hz: 430, q: 0.6, gain: 2.0, secs: 0.026, attack: 0.003 }],
          tones: [{ hz: 168, gain: 0.5, secs: 0.045 }, { hz: 404, gain: 0.42, secs: 0.035 }],
        },
        { at: 0.038, hiss: [{ hz: 2900, q: 2.2, gain: 3.6, secs: 0.008 }] },
      ],
    },
    // Return: the lever throws the carriage all the way back and it hits the stop.
    return: {
      secs: 0.32,
      parts: [
        ...carriage(),
        {
          at: 0.108,
          hiss: [{ hz: 900, q: 0.7, gain: 1.2, secs: 0.02 }],
          tones: [{ hz: 152, gain: 0.4, secs: 0.12 }, { hz: 336, gain: 0.24, secs: 0.08 }],
        },
      ],
    },
  },

  /**
   * A tactile mechanical switch — "đanh".
   *
   * Crispness is not loudness and it is not a high filter frequency. It is a FAST ONSET, a
   * lot of energy above 2 kHz, and a very short life: the whole thing is over in 40ms. Two
   * events, 14ms apart — the leaf snapping past the stem's ramp, then the stem hitting the
   * housing floor. Neither one has a blunted attack, because plastic hitting plastic does
   * not have one.
   */
  crisp: {
    tap: {
      secs: 0.075,
      parts: [
        // The bump. Tiny, very bright, essentially no body at all.
        { at: 0, hiss: [{ hz: 4400, q: 3.2, gain: 1.5, secs: 0.005 }] },
        // Bottom-out. The crack is the point: two noise bands high up, and only enough low
        // ring to say there is a case around it.
        {
          at: 0.014,
          hiss: [{ hz: 2700, q: 0.9, gain: 2.6, secs: 0.011 }],
        },
        { at: 0.0152, hiss: [{ hz: 6200, q: 1.4, gain: 1.7, secs: 0.005 }] },
        {
          at: 0.0146,
          tones: [{ hz: 335, gain: 0.13, secs: 0.028 }, { hz: 1520, gain: 0.22, secs: 0.022 }],
        },
      ],
    },
    back: {
      secs: 0.07,
      parts: [
        { at: 0, hiss: [{ hz: 3900, q: 3.2, gain: 1.3, secs: 0.005 }] },
        {
          at: 0.013,
          hiss: [{ hz: 2300, q: 0.9, gain: 2.4, secs: 0.010 }],
        },
        { at: 0.0142, hiss: [{ hz: 5400, q: 1.4, gain: 1.4, secs: 0.004 }] },
        {
          at: 0.0136,
          tones: [{ hz: 300, gain: 0.12, secs: 0.026 }, { hz: 1330, gain: 0.20, secs: 0.02 }],
        },
      ],
    },
    // A stabilised key: the bar under it rattles, which is the third tick at +24ms and the
    // reason a space bar never sounds like a letter on any board anyone has owned.
    space: {
      secs: 0.095,
      parts: [
        { at: 0, hiss: [{ hz: 3800, q: 3.0, gain: 1.0, secs: 0.005 }] },
        {
          at: 0.016,
          hiss: [{ hz: 2100, q: 0.9, gain: 2.7, secs: 0.013 }],
          tones: [{ hz: 236, gain: 0.17, secs: 0.036 }, { hz: 980, gain: 0.20, secs: 0.026 }],
        },
        { at: 0.024, hiss: [{ hz: 5200, q: 4.0, gain: 1.7, secs: 0.004 }] },
      ],
    },
    return: {
      secs: 0.1,
      parts: [
        { at: 0, hiss: [{ hz: 3600, q: 3.0, gain: 1.0, secs: 0.005 }] },
        {
          at: 0.017,
          hiss: [{ hz: 1900, q: 0.9, gain: 2.7, secs: 0.014 }],
          tones: [{ hz: 212, gain: 0.18, secs: 0.042 }, { hz: 880, gain: 0.20, secs: 0.028 }],
        },
        { at: 0.026, hiss: [{ hz: 4900, q: 4.0, gain: 1.6, secs: 0.004 }] },
      ],
    },
  },

  /**
   * A linear switch — "thock".
   *
   * Nothing snaps on the way down, so there is exactly one event going in, and its onset is
   * BLUNT: the noise gets a 1.8ms attack, which is the audible difference between a crack
   * and a knock. What is left is the case ringing low and letting go slowly.
   *
   * The second event is the key coming back UP and meeting the top housing, 62ms later. It
   * is quiet and higher, and it is most of why a real linear board does not sound like a
   * drum machine.
   *
   * ⚠️ The fundamental is 208 Hz and its upper modes carry real weight, which is NOT how a
   * thock is usually drawn. It is where it is because of the speaker rather than the ear: a
   * laptop is down something like 15 dB by 200 Hz, so a voice that puts everything at 150
   * measures correctly, matches on loudness, and is inaudible on the machine the owner
   * actually writes on. Deep here means "the darkest of the three", not "the lowest
   * frequency a formula allows".
   */
  deep: {
    tap: {
      secs: 0.17,
      parts: [
        {
          at: 0,
          hiss: [{ hz: 860, q: 1.3, gain: 0.78, secs: 0.012, attack: 0.0018 }],
          tones: [
            { hz: 208, gain: 0.62, secs: 0.13 },
            { hz: 486, gain: 0.42, secs: 0.075 },
            { hz: 1180, gain: 0.20, secs: 0.035 },
          ],
        },
        { at: 0.062, hiss: [{ hz: 1750, q: 1.6, gain: 0.15, secs: 0.006 }] },
      ],
    },
    back: {
      secs: 0.14,
      parts: [
        {
          at: 0,
          hiss: [{ hz: 790, q: 1.3, gain: 0.72, secs: 0.011, attack: 0.0018 }],
          tones: [{ hz: 190, gain: 0.58, secs: 0.11 }, { hz: 440, gain: 0.40, secs: 0.065 }],
        },
        { at: 0.056, hiss: [{ hz: 1600, q: 1.6, gain: 0.13, secs: 0.006 }] },
      ],
    },
    space: {
      secs: 0.2,
      parts: [
        {
          at: 0,
          hiss: [{ hz: 640, q: 1.2, gain: 0.82, secs: 0.014, attack: 0.0022 }],
          tones: [
            { hz: 172, gain: 0.66, secs: 0.16 },
            { hz: 400, gain: 0.44, secs: 0.085 },
            { hz: 940, gain: 0.20, secs: 0.035 },
          ],
        },
        { at: 0.07, hiss: [{ hz: 1500, q: 1.6, gain: 0.14, secs: 0.007 }] },
      ],
    },
    return: {
      secs: 0.2,
      parts: [
        {
          at: 0,
          hiss: [{ hz: 600, q: 1.2, gain: 0.82, secs: 0.015, attack: 0.0022 }],
          tones: [{ hz: 160, gain: 0.66, secs: 0.17 }, { hz: 370, gain: 0.44, secs: 0.09 }],
        },
        { at: 0.074, hiss: [{ hz: 1420, q: 1.6, gain: 0.14, secs: 0.007 }] },
      ],
    },
  },
}
