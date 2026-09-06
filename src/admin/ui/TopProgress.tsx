// The thin bar across the top of the admin, shown while a page is being fetched.
//
// It exists because navigation stopped replacing the screen. The old page now stays put
// until the new one is ready, which is the right behaviour and also removes the only signal
// the admin had that a click did anything at all. The bar is that signal.
//
// It is deliberately NOT a percentage. Nothing here knows how far along a fetch is, and a
// bar that claims 60% and then sits there is worse than one that visibly keeps moving: the
// animation eases toward the right edge and never arrives, then snaps to full and fades the
// moment the work finishes.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getInFlight, subscribeInFlight } from '@/admin/pending'
import { useRouter } from '@/admin/router'

/** How long the finished bar stays on screen. Matches the fade in `admin.css`. */
const EXIT_MS = 320

/**
 * How long `busy` may drop before the bar believes it.
 *
 * A navigation is two halves with a SEAM between them: React finishes resolving the route's
 * chunk, and only after that commit does the new page's effect ask for its data. For those
 * few frames nothing is in flight, and the bar took that literally. Measured before this
 * existed, at 4x CPU throttle: the bar appeared at 39ms, was REPLACED at 102ms and marked
 * done at 103ms. A replaced element is a new key, and a new key replays the animation from
 * the left edge, so one click drew the bar twice. Long enough to cover the seam, short
 * enough that a genuinely finished request still ends promptly.
 *
 * This value covers an in-app navigation and nothing else, which is what it was measured
 * against. `BOOT_SEAM_MS` is the other case.
 */
export const SEAM_MS = 120

/**
 * The same thing for the FIRST run of a page's life, where the seam is structurally wider.
 *
 * A cold load is not one navigation, it is two requests that cannot overlap: `Shell` renders
 * a blank placeholder until the shell view answers with the site's language, and only the
 * commit AFTER that mounts a page which then asks for its own data. An in-app navigation has
 * no such gap — the router's transition holds `pending` true across it — which is why the
 * bar behaved on every click and misbehaved on every page open, and why the owner reported
 * it as happening "sometimes".
 *
 * Measured at 6x CPU throttle with 150ms of added latency, the gap between the shell's
 * answer and the page's first request was 179 / 180 / 180 / 206ms across four screens, with
 * SEAM_MS at 120 — so the bar marked itself done inside every one of them. This is that
 * worst case with room for a slower phone, and it applies only until a run has completed:
 * paying it once at boot is not the same as paying it on every click.
 */
export const BOOT_SEAM_MS = 400

export function TopProgress() {
  const { pending } = useRouter()
  const inFlight = useSyncExternalStore(subscribeInFlight, getInFlight, () => 0)
  const busy = pending || inFlight > 0

  const [visible, setVisible] = useState(false)
  const [done, setDone] = useState(false)
  /**
   * Work that arrives while the finished bar is still fading out. The bar used to answer it
   * by un-marking `done`, and `[data-done] { animation: none }` taken away replays the
   * keyframes from the left edge — the same element, swept twice, for ONE click. It happens
   * whenever a page's second request starts inside the 320ms exit: a save followed by the
   * refresh it triggers, the write pane's list and then its post. Measured on the owner's
   * own clicks, 2026-09-06. So the bar now HOLDS instead: full width, fully visible, until
   * the new work ends, and only then fades. One click, one sweep, however many requests.
   */
  const [hold, setHold] = useState(false)
  // `run` keys the element, and keying it is what replays the animation. It may therefore
  // only change when the bar was NOT already on screen: while it is up, the two halves of a
  // navigation are one piece of work and get one sweep.
  const [run, setRun] = useState(0)
  // A ref, not `visible`, because this is read inside the effect that sets it. Depending on
  // the state would re-run the effect and restart the very timer it just scheduled.
  const shown = useRef(false)
  // Whether a run has ever finished. Only the first one straddles the boot seam.
  const booted = useRef(false)
  // Read at the END of an exit, to know whether the work that held it is still running.
  const busyRef = useRef(busy)
  busyRef.current = busy

  useEffect(() => {
    if (busy) {
      // A finished bar is never un-finished: that replays the sweep. It holds.
      if (done) {
        setHold(true)
        return undefined
      }
      if (!shown.current) {
        shown.current = true
        setRun((n) => n + 1)
      }
      setVisible(true)
      return undefined
    }
    if (done) {
      // The held work has ended; releasing the hold lets the exit below run.
      setHold(false)
      return undefined
    }
    // Nothing on screen and nothing in flight: nothing to settle. Without this the exit's
    // own `setDone(false)` would schedule a settle that marks an invisible bar done again.
    if (!shown.current) return undefined
    const settle = setTimeout(() => setDone(true), booted.current ? SEAM_MS : BOOT_SEAM_MS)
    return () => clearTimeout(settle)
  }, [busy, done])

  useEffect(() => {
    if (!done) return undefined
    if (hold) return undefined
    const timer = setTimeout(() => {
      shown.current = false
      booted.current = true
      setVisible(false)
      setDone(false)
      // Work that began in the last frames of the exit and is still running is NEW work,
      // and gets a sweep of its own.
      if (busyRef.current) {
        shown.current = true
        setRun((n) => n + 1)
        setVisible(true)
      }
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [done, hold])

  if (!visible) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden" aria-hidden="true">
      <div
        key={run}
        data-done={done ? 'true' : undefined}
        data-hold={hold ? 'true' : undefined}
        className="quireink-progress-bar h-full w-full bg-neutral-900 dark:bg-neutral-100"
      />
    </div>
  )
}
