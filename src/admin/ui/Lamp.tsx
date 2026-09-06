// The pilot lamp: a small round mark that says whether a thing is working.
//
// It already existed twice — as the version dot on the dashboard (amber for an update, green
// for current, nothing at all for "we could not ask") and inside the toast — and both were
// written out by hand at their call sites. This is that one idea named, so a third use is a
// component rather than a fourth pair of colour classes.
//
// ⚠️ COLOUR NEVER CARRIES THE MESSAGE ALONE. `docs/admin-design.md` allows this one status
// colour precisely because the toast pairs it with a glyph, and the same bargain applies
// here: anything that depends on the answer prints the answer in words next to it — the
// remote error under the card, "Saved at 14:02" beside the key. The lamp is what lets the eye
// find WHICH card needs attention on a tab of six; it is never the only place the state is
// stated. `title` gives the pointer and the accessibility tree that same sentence.
//
// Hues from the version dot (`DashboardWidgets`), which took them from the toast: emerald for
// good, amber for needs-you, the neutral scale for off. The red ballpoint is deliberately NOT
// here — red means something was DESTROYED, and a connection that did not answer has
// destroyed nothing.

/**
 * `good` — stored, and the far end answered.
 * `attention` — changed and not yet tried, or tried and refused.
 * `off` — the feature is not turned on, so there is nothing to be right or wrong.
 *
 * There is no "unknown": a lamp that cannot say anything draws nothing at all, which is the
 * rule the version dot already follows — not knowing is not the same as being current.
 */
export type LampState = 'good' | 'attention' | 'off'

const HUES: Record<LampState, string> = {
  good: 'bg-emerald-600 dark:bg-emerald-500',
  attention: 'bg-amber-500',
  off: 'bg-neutral-300 dark:bg-neutral-600',
}

export function Lamp({ state, title }: { state: LampState; title?: string }) {
  return (
    <span
      // A role and a name, not `aria-hidden`: unlike the toast's dot, this lamp is sometimes
      // the first notice that a card needs attention, and a reader who cannot see the colour
      // still has to get the sentence. `title` is the sentence.
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      title={title}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${HUES[state]}`}
    />
  )
}
