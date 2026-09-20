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

/**
 * A token off the document, so a scripted move and a CSS transition read one source.
 *
 * ⚠️ READ FOR A SHAPE, NEVER FOR A DECISION. The gates zero every transition and leave
 * `--dur-*` at their values (measured), so a script that asked a duration whether to move
 * would move with the switch off. `motionOn()` above is the only thing that decides.
 */
const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** A duration token, in milliseconds. The reading site's half has had this; this one had not. */
export function dur(name: 'fast' | 'base' | 'slow'): number {
  return parseFloat(token(`--dur-${name}`)) * 1000 || 0
}

/**
 * The one curve, for a scripted move.
 *
 * Two call sites wrote a cubic-bezier by hand because this module offered nothing to read,
 * and by 2026-09-20 they had drifted apart: the rail's FLIP carried the house curve spelled
 * out — the very move the token was introduced for — and the editor's caret carried a fourth
 * curve nothing else used. `ease` only where the sheet is not loaded, which is the test DOM.
 */
export const ease = (): string => token('--ease-out') || 'ease'
