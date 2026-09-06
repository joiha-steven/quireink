// The motion engine's script half for the admin. The CSS half is the foot of admin.css; the
// reading site has the same pair in assets/js/motion.ts and web/motion.css.ts, and the
// contract for all four is docs/conventions/motion.md.
//
// Script asks the GATE, never a token: the owner's switch and the OS preference zero every
// transition and leave `--dur-*` at their values, so a script that read a duration to
// decide whether to move would move with the switch off. Four places used to decide this
// for themselves - two read only the OS preference, two read nothing - so the switch
// stopped a hover and not a smooth scroll.
//
// A `.ts` file that touches `document` is only legal under `src/admin/tsconfig.json`.

/** Whether anything may move: the owner's switch is on AND the owner has not asked for less. */
export function motionOn(): boolean {
  return document.documentElement.dataset.motion !== 'off'
    && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
}

/** The `behavior` for a programmatic scroll: smooth only where motion is on. */
export const scrollBehavior = (): ScrollBehavior => (motionOn() ? 'smooth' : 'auto')
