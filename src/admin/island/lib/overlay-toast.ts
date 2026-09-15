// THE ADMIN'S ONLY RUNNING COMMENTARY: what just happened, in the corner, for a few seconds.
//
// It was three lines of React state and a `setTimeout`, and every one of the things below was
// missing on 2026-09-07:
//
//   · A FAILURE LEFT AT THE SAME SPEED AS A SUCCESS. Three seconds is enough for "Saved" and
//     nowhere near enough for a sentence naming what went wrong — which is the one message a
//     person has to finish reading, and the one they were least likely to be looking at.
//   · NOTHING COULD DISMISS ONE, so a stack sat over the corner until it aged out.
//   · THE CLOCK RAN WHILE YOU READ. Pointing at a toast — which is what you do while reading
//     it, or while reaching for the undo inside it — did not stop it leaving.
//   · THEY STACKED WITHOUT LIMIT. Ten uploads printed ten toasts up the side of the window.
//   · THEY VANISHED. Arriving on a curve and then disappearing on a frame reads as a glitch.
//
// ⚠️ THE ANNOUNCEMENT IS NOT THE TOAST. The two live regions are in the page from the first
// byte and empty until there is something to say; the visible toast is a picture of what was
// already announced, and carries no role of its own — a second announcement would say
// everything twice.
import { motionOn } from '@/admin/motion'
import { el } from '@/admin/components/node-dom'

type Kind = 'success' | 'error'
/** A toast may carry ONE action, and it exists for exactly one thing: undo. */
type Action = { label: string; run: () => void }

/**
 * How long each kind stays, and the numbers are the argument.
 *
 * A success is a receipt: it confirms what the hand just did, and the eye has moved on. An
 * action needs long enough to notice a sentence, read it, decide it was a mistake and reach
 * the word — six seconds is a slow count of six, not a guess. A failure has no timer at all,
 * because the only person who can decide it has been read is the one reading it.
 */
const LIFE = { plain: 3200, action: 6000 } as const
/** Long enough for the exit to finish, short enough that it is never noticed as a delay. */
const EXIT_MS = 150
/** Three. A fourth pushes the first off the top rather than growing the stack up the window. */
const MAX = 3

const className = {
  toast: 'admin-toast flex items-center gap-2 rounded-lg border border-neutral-200 bg-white'
    + ' px-4 py-2.5 text-sm font-medium text-neutral-900 shadow-lg dark:border-neutral-700'
    + ' dark:bg-neutral-900 dark:text-neutral-100',
  // ONE neutral sheet, told apart by a pilot lamp AND a glyph. The two kinds were once
  // inverted black and white — a difference that vanished for anyone who did not already know
  // which way round it was. The lamp wears the hues the version dot established: green is good
  // and done, amber is something that needs you. The glyph stays because a dot alone asks
  // colour to carry the whole message.
  lampGood: 'h-2 w-2 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-500',
  lampBad: 'h-2 w-2 shrink-0 rounded-full bg-amber-500',
  undo: 'ml-1 shrink-0 font-semibold underline underline-offset-2 hover:no-underline',
  shut: '-mr-1.5 ml-1 shrink-0 rounded px-1 text-neutral-400 transition hover:text-neutral-900'
    + ' dark:hover:text-neutral-100',
}

export function wireToast(closeLabel: string): () => void {
  const stack = document.querySelector<HTMLElement>('[data-toast-stack]')
  const polite = document.querySelector<HTMLElement>('[data-say-polite]')
  const urgent = document.querySelector<HTMLElement>('[data-say-urgent]')
  if (!stack) return () => {}

  // A timer is not state: it is kept beside the node rather than on it, so nothing re-reads
  // the stack because a countdown exists.
  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>()

  const drop = (node: HTMLElement): void => {
    clearTimeout(timers.get(node))
    timers.delete(node)
    // Marked LEAVING first and removed a frame later: the CSS transition needs the element to
    // still be there to animate out of. With motion off there is nothing to wait for.
    node.dataset.leaving = ''
    setTimeout(() => node.remove(), motionOn() ? EXIT_MS : 0)
  }

  const arm = (node: HTMLElement, ms: number): void => {
    clearTimeout(timers.get(node))
    timers.set(node, setTimeout(() => drop(node), ms))
  }

  const say = (message: string, kind: Kind, action?: Action): void => {
    const region = kind === 'error' ? urgent : polite
    if (region) region.textContent = message

    const node = el('div', { className: className.toast })
    node.append(
      el('span', {
        className: kind === 'error' ? className.lampBad : className.lampGood,
        'aria-hidden': 'true',
      }),
    )
    const glyph = el('span', { 'aria-hidden': 'true' })
    glyph.textContent = kind === 'error' ? '!' : '✓'
    node.append(glyph, document.createTextNode(message))

    if (action) {
      const key = el('button', { className: className.undo, type: 'button' })
      key.textContent = action.label
      key.addEventListener('click', () => { action.run(); drop(node) })
      node.appendChild(key)
    }
    const shut = el('button', { className: className.shut, type: 'button', 'aria-label': closeLabel })
    shut.textContent = '✕'
    shut.addEventListener('click', () => drop(node))
    node.appendChild(shut)

    // Pointing at a toast is what you do while reading it. Either way the clock has no
    // business running.
    const hold = (): void => { clearTimeout(timers.get(node)); timers.delete(node) }
    const release = (): void => {
      if (kind !== 'error' && node.dataset.leaving === undefined) {
        arm(node, action ? LIFE.action : LIFE.plain)
      }
    }
    node.addEventListener('pointerenter', hold)
    node.addEventListener('pointerleave', release)
    node.addEventListener('focusin', hold)
    node.addEventListener('focusout', release)

    stack.appendChild(node)
    // Over the cap, the OLDEST goes — it has been read, or it never will be.
    for (const old of [...stack.children].slice(0, Math.max(0, stack.children.length - MAX))) {
      clearTimeout(timers.get(old as HTMLElement))
      timers.delete(old as HTMLElement)
      old.remove()
    }
    // ⚠️ A FAILURE IS NEVER ARMED. It leaves when somebody closes it, and not before.
    if (kind !== 'error') arm(node, action ? LIFE.action : LIFE.plain)
  }

  const onSay = (e: Event): void => {
    const said = (e as CustomEvent<{ message?: string; kind?: Kind; action?: Action }>).detail
    if (typeof said?.message !== 'string') return
    const act = said.action
    const usable = act && typeof act.label === 'string' && typeof act.run === 'function'
    say(said.message, said.kind === 'error' ? 'error' : 'success', usable ? act : undefined)
  }
  window.addEventListener('quire:toast', onSay)

  return () => {
    window.removeEventListener('quire:toast', onSay)
    for (const timer of timers.values()) clearTimeout(timer)
  }
}
