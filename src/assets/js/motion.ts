// The motion engine's script half. Its CSS half is src/web/motion.css.ts; the contract is
// docs/conventions/motion.md.
//
// Three things, and they are the only three an island may do about motion:
//   - ASK the gate (`motionOn`, `scrollBehavior`) rather than a token: the owner's switch and
//     the OS preference zero every transition but leave `--dur-*` at their values, so a
//     script that read a duration to decide whether to move would move with the switch off;
//   - WATCH the scroll through one frame (`onScrollFrame`, in scroll.ts and re-exported
//     here): four islands used to run four requestAnimationFrame loops on a post, and the
//     second one's layout reads landed after the first one's class writes, which is a forced
//     layout every frame. One loop, reads first, then writes;
//   - MOVE something (`glide`) on the Web Animations API, so the move reads the token and
//     honours the gate itself. A CSS transition plus a timer cannot: with the switch off the
//     transition is gone and the timer still waits, which is a blank frame for as long as
//     the timer says.

/** Whether anything may move: the owner's switch is on AND the reader has not asked for less. */
export function motionOn(): boolean {
  return document.documentElement.dataset.motion !== 'off'
    && !matchMedia('(prefers-reduced-motion:reduce)').matches
}

/** The `behavior` for a programmatic scroll: smooth only where motion is on. */
export const scrollBehavior = (): ScrollBehavior => (motionOn() ? 'smooth' : 'auto')

/** A token off the document, so a scripted move and a CSS transition read one source. */
const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** A duration token, in milliseconds. */
export function dur(name: 'fast' | 'base' | 'slow'): number {
  return parseFloat(token(`--dur-${name}`)) * 1000 || 0
}

/**
 * Move an element to a new transform, over the engine's own duration.
 *
 * ⚠️ THIS REPLACED A CROSS-FADE, and the difference is what a page turn feels like. Book
 * mode used to fade the spread to nothing, jump the flow, and fade it back — 150ms down and
 * 150ms up, measured on the published page — which is a blink whatever it is called. The
 * pages are already laid out side by side behind a window that clips them, and the spine is
 * drawn on the window rather than on the flow, so sliding the flow under it is the motion
 * the object already implies: the pages move and the gutter stays.
 *
 * THE DESTINATION IS SET FIRST, then animated FROM where the element was. That order is the
 * whole trick: a Web Animations keyframe with no `fill` hands the element back to its base
 * value the instant it ends, so animating TO a value the base does not carry paints one
 * frame of the old position on the way out. Setting the style first makes the base the
 * destination, and the animation is only the ramp.
 *
 * A turn asked for mid-turn starts from where the flow actually IS — a held arrow key is
 * the common case — so the running animation is cancelled rather than left to fight.
 *
 * Instant where motion is off, and where the engine has no `animate` at all: the spread
 * still lands on the right page, which is the part that is not decoration. The curve falls
 * back to `ease` only where the token sheet is not loaded, which is the test DOM.
 */
export function glide(el: HTMLElement, transform: string): void {
  // `'animate' in el`, because the test DOM has no Web Animations and the types say every
  // element does.
  const ms = motionOn() && 'animate' in el ? dur('base') : 0
  const from = ms ? getComputedStyle(el).transform : ''
  // Before the style is written, so `from` is where the flow actually is. Cancelled even
  // with motion off, because the switch can be thrown mid-turn.
  el.getAnimations?.().forEach((running) => running.cancel())
  el.style.transform = transform
  if (ms) el.animate([{ transform: from }, { transform }], { duration: ms, easing: token('--ease-out') || 'ease' })
}

export { onScrollFrame } from './scroll'
