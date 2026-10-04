// One key a writer pressed, out of the several events an input method sends for it.
//
// ⚠️ MOST VIETNAMESE WRITERS DO NOT COMPOSE. EVKey, OpenKey, Unikey and GoTiengViet turn
// `tieng` + `s` into `tiếng` by sending Backspace three times and then `ếng`, as ordinary key
// events, inside a few milliseconds. The editor heard each of them: three deletes and a tap,
// four strikes and four caret twitches for the one key the hand pressed. Measured in Chrome on
// "Tiếng Việt có dấu, gõ nhanh không lỗi." typed that way: 49 keys pressed, 65 strikes, the
// extra sixteen arriving 1-4 ms after the key before them. A typewriter that stutters on every
// accented word.
//
// So the events are grouped by WHEN THE KEYS WERE MADE. A person cannot press two keys inside
// `BURST_MS` — ordinary typing is 80 ms and more between keys, and even a fast typist's
// rollover rarely gets under 30 — while an input method's rewrite lands inside 5. Everything
// inside the window is one key, and it strikes once.
//
// WHAT THE ONE STRIKE IS. A burst that opens with an insert is the writer's own letter and
// strikes at once, so ordinary typing has no added delay at all. A burst that opens with a
// delete might be a real Backspace or the front of a rewrite, and only the next few
// milliseconds can say: it waits for `BURST_MS` of quiet and then strikes as whatever the
// burst ENDED on — a tap after a rewrite, a space or a return if the rewrite carried one (the
// space that commits a word is the writer's space), and a delete when nothing followed, which
// is a real Backspace. The one price is 16 ms on a real Backspace, under the latency of the
// audio output it goes to.
//
// Pure: no DOM, no clock of its own. The caller says when each key was made and gets told
// when to strike, so `key-burst.test.ts` can drive it with numbers instead of a browser.
import type { Strike } from './key-voices'

/**
 * The longest gap between two events of one input-method rewrite, in milliseconds.
 *
 * Measured, both sides of it. In Chrome a rewrite's events reached the page 1-4 ms apart, and a
 * writer's keys at a brisk 90 ms never came closer than 90. With the CPU throttled four times on
 * a 15,000-word post the page got round to a rewrite's events as much as 16 ms apart — which is
 * why the time fed in is the keydown's stamp, made when the key was, not when the page reached
 * it. Sixteen sits clear of both, and under the 30 ms a fast typist's two-key rollover takes.
 */
export const BURST_MS = 16

/** The scheduler, handed in so a test can run the clock itself. */
export type Timers = {
  set: (fn: () => void, ms: number) => unknown
  clear: (handle: unknown) => void
}

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export class KeyBurst {
  /** When the previous event's key was made. */
  private last = Number.NEGATIVE_INFINITY
  /** The burst under way has already struck: everything else in it is silent. */
  private struck = false
  /** A burst that opened with a delete, still deciding what it was. */
  private pending: Strike | null = null
  private timer: unknown = null

  constructor(
    private readonly strike: (kind: Strike) => void,
    private readonly timers: Timers = realTimers,
  ) {}

  /**
   * One event, and the time (ms, any monotonic clock) the key behind it was made.
   *
   * `keyed` says whether that time is a key's own stamp. An edit with no keydown before it —
   * text an input method injected directly — only has the time the page got round to it, which
   * a busy page pushes later: measured with the CPU throttled four times on a 15,000-word post,
   * the insert of a rewrite reached the page 12-22 ms after the Backspace in front of it, and
   * timed that way eleven of sixteen rewrites split back into a delete and a tap. Such an edit
   * joins a burst that is still DECIDING — its settle timer has not had a free moment to fire,
   * so nothing has happened on the page since the delete — and that is safe because a
   * keydown-less edit cannot be a person's next key: every key a person presses has a keydown.
   */
  feed(kind: Strike, at: number, keyed = true): void {
    // Either side of the last one, because the two clocks can cross: a key's stamp is earlier
    // than the dispatch time of a keydown-less edit the page handled just before it.
    const joined = Math.abs(at - this.last) <= BURST_MS || (!keyed && this.pending !== null)
    this.last = at
    if (!joined) {
      // A new key. A decision still waiting from the last one is taken now rather than lost:
      // its timer can be late when the page is busy, and the key it belongs to was real.
      this.settle()
      this.struck = false
    }
    if (this.struck) return
    if (this.pending !== null || kind === 'back') {
      // An insert overrides what the burst is; a delete after an insert does not take it back.
      this.pending = kind === 'back' ? (this.pending ?? 'back') : kind
      this.timers.clear(this.timer)
      this.timer = this.timers.set(() => this.settle(), BURST_MS + 1)
      return
    }
    this.struck = true
    this.strike(kind)
  }

  /** Strike a burst that was waiting, now. */
  private settle(): void {
    this.timers.clear(this.timer)
    this.timer = null
    if (this.pending === null) return
    const kind = this.pending
    this.pending = null
    this.struck = true
    this.strike(kind)
  }
}
