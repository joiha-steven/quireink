// One strike per key a person pressed, however many events an input method sent for it.
//
// The clock is the test's: `KeyBurst` is told when each key was made and asks for a timer, so
// every case below is a list of numbers and a list of strikes, with no browser and no waiting.
import { describe, expect, it } from 'bun:test'
import { BURST_MS, KeyBurst, type Timers } from './key-burst'
import type { Strike } from './key-voices'

/** A burst with a hand-wound clock: `run(ms)` fires whatever timers fall due. */
function rig(): { burst: KeyBurst; struck: Strike[]; run: (until: number) => void } {
  const struck: Strike[] = []
  let now = 0
  let jobs: { at: number; fn: () => void; id: number }[] = []
  let ids = 0
  const timers: Timers = {
    set: (fn, ms) => { const id = ++ids; jobs.push({ at: now + ms, fn, id }); return id },
    clear: (id) => { jobs = jobs.filter((j) => j.id !== id) },
  }
  const burst = new KeyBurst((k) => struck.push(k), timers)
  const run = (until: number): void => {
    for (;;) {
      const due = jobs.filter((j) => j.at <= until).sort((a, b) => a.at - b.at)[0]
      if (!due) break
      jobs = jobs.filter((j) => j !== due)
      now = due.at
      due.fn()
    }
    now = until
  }
  return { burst, struck, run }
}

describe('a person typing', () => {
  it('strikes every letter at once, with nothing held back', () => {
    const { burst, struck } = rig()
    burst.feed('tap', 0)
    expect(struck).toEqual(['tap'])
    burst.feed('tap', 90)
    burst.feed('space', 180)
    expect(struck).toEqual(['tap', 'tap', 'space'])
  })

  it('hears a real Backspace as a delete, once the quiet after it says nothing followed', () => {
    const { burst, struck, run } = rig()
    burst.feed('back', 0)
    expect(struck).toEqual([])
    run(BURST_MS + 1)
    expect(struck).toEqual(['back'])
  })

  it('hears a fast typist\'s rollover as two keys', () => {
    const { burst, struck } = rig()
    burst.feed('tap', 0)
    burst.feed('tap', 30)
    expect(struck).toEqual(['tap', 'tap'])
  })

  it('keeps keys made 90 ms apart apart, even when the page handles them back to back', () => {
    // The stamps are when the keys were MADE; a busy page hands them over together, and the
    // caller feeds the keydown's stamp precisely so that this still reads as three keys.
    const { burst, struck, run } = rig()
    burst.feed('back', 0)
    burst.feed('back', 90)
    burst.feed('tap', 180)
    run(400)
    expect(struck).toEqual(['back', 'back', 'tap'])
  })
})

describe('an input method rewriting a word (EVKey, OpenKey, Unikey)', () => {
  it('is one tap for `tiêng` + s: three Backspaces and `ếng` inside a few ms', () => {
    const { burst, struck, run } = rig()
    burst.feed('back', 0)
    burst.feed('back', 1)
    burst.feed('back', 2)
    burst.feed('tap', 3)
    burst.feed('tap', 4)
    burst.feed('tap', 5)
    expect(struck).toEqual([])
    run(40)
    expect(struck).toEqual(['tap'])
  })

  it('keeps the space that committed the word, when the rewrite carries it', () => {
    const { burst, struck, run } = rig()
    burst.feed('back', 0)
    burst.feed('tap', 2)
    burst.feed('space', 3)
    run(40)
    expect(struck).toEqual(['space'])
  })

  it('does not let a stray delete after the insert turn the key back into a Backspace', () => {
    const { burst, struck, run } = rig()
    burst.feed('back', 0)
    burst.feed('tap', 2)
    burst.feed('back', 3)
    run(40)
    expect(struck).toEqual(['tap'])
  })

  it('is silent after a letter that struck at once, for the rest of its burst', () => {
    const { burst, struck, run } = rig()
    burst.feed('tap', 0)
    burst.feed('tap', 1)
    burst.feed('tap', 2)
    run(40)
    expect(struck).toEqual(['tap'])
  })

  it('takes a waiting decision when the next key comes before its timer could fire', () => {
    const { burst, struck } = rig()
    burst.feed('back', 0)
    burst.feed('tap', 1)
    // No time has run: the page was busy. The next key is a key, and the last one still counts.
    burst.feed('tap', 95)
    expect(struck).toEqual(['tap', 'tap'])
  })

  it('joins an insert with no keydown to a burst still deciding, however late the page got to it', () => {
    const { burst, struck, run } = rig()
    burst.feed('back', 0)
    burst.feed('tap', 40, false)
    run(100)
    expect(struck).toEqual(['tap'])
  })

  it('does not join a keyed key to a deciding burst on that ground', () => {
    const { burst, struck, run } = rig()
    burst.feed('back', 0)
    burst.feed('tap', 40)
    run(100)
    expect(struck).toEqual(['back', 'tap'])
  })
})
