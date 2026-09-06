// The shape of a page that has not arrived yet.
//
// Every shell showed the same thing while it waited: a centred ellipsis on an otherwise empty
// canvas (`pages/state.tsx`). Three other things were ALSO used for waiting somewhere in this
// admin on 2026-09-07 — the word "Loading", a pulsing grey block, and nothing at all — so a
// person moving between screens met four different answers to one question.
//
// A skeleton rather than a spinner, and the argument is not fashion. A spinner says "wait";
// a skeleton says "wait, and here is where the thing you asked for will be" — so the eye is
// already at the right place when the content lands, and the page does not jump under it. It
// also stops the layout shifting: the four shapes below are drawn at the heights the real
// content occupies.
//
// ⚠️ IT DOES NOT PULSE UNDER `data-motion=off`. The gate at the foot of `admin.css` zeroes
// every animation, so this needs no opt-out of its own — but it must still be LEGIBLE when
// still, which is why the bars carry a real fill rather than being drawn by the animation.
import { CARD } from './kit'

/** One grey bar. `aria-hidden` throughout: a skeleton is furniture, not content. */
function Bar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-200/70 dark:bg-neutral-800 ${className}`} aria-hidden />
}

export type SkeletonShape = 'list' | 'grid' | 'stats' | 'form'

/**
 * @param shape what the page is about to draw — a list of rows, a grid of tiles, a band of
 *   numbers, or a stack of cards. Picked by the SHELL, which knows what it fetched.
 */
export function Skeleton({ shape }: { shape: SkeletonShape }) {
  if (shape === 'grid') {
    return (
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4" role="status" aria-busy="true">
        {Array.from({ length: 12 }, (_, i) => <Bar key={i} className="aspect-square" />)}
      </div>
    )
  }
  if (shape === 'stats') {
    return (
      <div className="flex flex-wrap border-b border-neutral-100 dark:border-neutral-800" role="status" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="min-w-32 flex-1 border-r border-neutral-100 px-5 py-4 last:border-r-0 dark:border-neutral-800">
            <Bar className="h-7 w-20" />
            <Bar className="mt-2 h-3 w-14" />
          </div>
        ))}
      </div>
    )
  }
  if (shape === 'form') {
    return (
      <div className="grid items-start gap-5 p-5 xl:grid-cols-2" role="status" aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={`${CARD} p-4`}>
            <Bar className="h-4 w-32" />
            <Bar className="mt-4 h-9 w-full" />
            <Bar className="mt-3 h-9 w-2/3" />
          </div>
        ))}
      </div>
    )
  }
  // `list`, the default: six rows at the height a real row takes, so nothing moves when the
  // rows arrive.
  return (
    <div role="status" aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="border-b border-neutral-100 px-5 py-3.5 dark:border-neutral-800">
          {/* Varied widths, because six identical bars read as a table rule rather than as text. */}
          <Bar className={i % 3 === 0 ? 'h-4 w-3/4' : i % 3 === 1 ? 'h-4 w-5/6' : 'h-4 w-2/3'} />
          <Bar className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}
