// A tooltip that arrives when somebody has stopped, and not before.
//
// `title=` was doing this job on a bar of twenty-five glyph buttons, and it has two faults that
// only matter there. It waits about a second — long enough that a writer hunting for the
// underline key clicks to find out — and it is drawn by the operating system, so the one piece
// of chrome that explains this product is the one piece not set in its type.
//
// 400ms is the number: fast enough to answer a deliberate hover, slow enough that sweeping the
// pointer across a row of buttons on the way somewhere lights up none of them.
//
// ⚠️ `title` IS STILL SET by the caller, for the accessibility tree and for touch, where there
// is no hover at all. What this replaces is the sighted-pointer experience only.
//
// The plain-TypeScript twin of `ui/Tip.tsx`, for the editor's own chrome. ADR 0054 keeps the
// editor a client-side application rather than a page, so its furniture is built here instead
// of being rendered by the server like the rest of the admin.
import { el } from './node-dom'

const DELAY_MS = 400

const className = {
  hold: 'relative inline-flex',
  // 4px, one step tighter than a control's radius, and deliberately not the button's:
  // `check:admin-kit` owns that pair of classes for `Button`, and it is right to — a tooltip
  // wearing a key's silhouette is one somebody tries to click.
  bubble: 'pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2'
    + ' rounded whitespace-nowrap bg-neutral-900 px-2 py-1 text-xs font-medium text-white'
    + ' shadow-lg dark:bg-neutral-700',
}

/**
 * Wrap a control so that hovering it explains it.
 *
 * Returns the wrapper, which is what goes into the row: the control is inside it, and the
 * label is a sibling that appears and disappears.
 */
export function withTip(control: HTMLElement, label: string): HTMLElement {
  const hold = el('span', { className: className.hold })
  // `aria-hidden`: the button already carries this string as its accessible name, and a
  // tooltip that repeats it makes a screen reader say everything twice.
  const bubble = el('span', { className: className.bubble, 'aria-hidden': 'true' })
  bubble.textContent = label
  bubble.hidden = true
  hold.append(control, bubble)

  let timer: ReturnType<typeof setTimeout> | null = null
  const cancel = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
    bubble.hidden = true
  }
  hold.addEventListener('pointerenter', () => {
    cancel()
    timer = setTimeout(() => { bubble.hidden = false }, DELAY_MS)
  })
  hold.addEventListener('pointerleave', cancel)
  // Focus shows it AT ONCE. A keyboard user has already committed to this control by tabbing
  // to it, so there is no sweep to protect them from.
  hold.addEventListener('focusin', () => { if (timer) clearTimeout(timer); bubble.hidden = false })
  hold.addEventListener('focusout', cancel)
  return hold
}
