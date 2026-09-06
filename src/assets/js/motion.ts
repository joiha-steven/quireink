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
//   - CROSS-FADE a change (`fadeSwap`) on the Web Animations API, so the fade reads the
//     token and honours the gate itself. A CSS transition plus a timer cannot: with the
//     switch off the transition is gone and the timer still waits, which is a blank frame
//     for as long as the timer says.

/** Whether anything may move: the owner's switch is on AND the reader has not asked for less. */
export function motionOn(): boolean {
  return document.documentElement.dataset.motion !== 'off'
    && !matchMedia('(prefers-reduced-motion:reduce)').matches
}

/** The `behavior` for a programmatic scroll: smooth only where motion is on. */
export const scrollBehavior = (): ScrollBehavior => (motionOn() ? 'smooth' : 'auto')

/** A duration token, in milliseconds, read off the document so there is one source. */
export function dur(name: 'fast' | 'base' | 'slow'): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--dur-${name}`)) * 1000 || 0
}

/**
 * Fade an element out, apply a change, fade it back in - a page turn, a swap of content.
 * Instant where motion is off, and where the engine has no `animate` at all.
 */
export function fadeSwap(el: HTMLElement, change: () => void): void {
  // `'animate' in el`, because the test DOM has no Web Animations and the types say every
  // element does.
  const ms = motionOn() && 'animate' in el ? dur('fast') : 0
  if (!ms) return change()
  const frames = [{ opacity: 1 }, { opacity: 0 }]
  el.animate(frames, { duration: ms, easing: 'ease' }).onfinish = () => {
    change()
    el.animate(frames.slice().reverse(), { duration: ms, easing: 'ease' })
  }
}

export { onScrollFrame } from './scroll'
