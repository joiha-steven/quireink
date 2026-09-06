// The three states a server component never had to render.
//
// Every page shell fetches now, so every page shell can be loading or broken. Giving them
// one shared pair means no page invents its own — and, more to the point, that none of
// them quietly render their component tree with empty props, which is how a client port
// ends up showing an empty table where the server showed a list.

import type { ReactNode } from 'react'
import type { ViewState } from '@/admin/useView'
import { Button } from '@/admin/ui/Button'
import { useAdminT } from '@/admin/components/I18nProvider'
import { Skeleton, type SkeletonShape } from '@/admin/components/Skeleton'
import { SHEET } from '@/admin/components/sheet'
import { HEADER_GAP } from '@/admin/components/scale'

/**
 * Waiting, in the shape of what is coming.
 *
 * The ellipsis it replaces said only "something is happening somewhere". A skeleton says
 * where — so the eye is already at the right place when the content lands, and the page does
 * not jump under it. `shape` is the shell's to choose, because the shell knows what it asked
 * the server for. It falls back to the ellipsis when a caller names none, which is what the
 * editor shells want: their paper is drawn by the sheet around them.
 */
export function Loading({ shape }: { shape?: SkeletonShape }) {
  if (!shape) return <div className="py-16 text-center text-sm text-neutral-500 dark:text-neutral-400">…</div>
  // ⚠️ INSIDE THE SHEET, and with the title's own space above it. `View` stands where the
  // whole page will be, so a bare skeleton drew grey bars straight onto the canvas with no
  // paper under them and no title over them — and the sheet then appeared around the content
  // a moment later, moving everything down by the height of a page header. A skeleton whose
  // job is to stop the layout jumping has to be the shape of the page, not of its list.
  return (
    <div>
      <div className={HEADER_GAP}>
        <div className="h-[1.375rem] w-40 animate-pulse rounded bg-neutral-200/70 dark:bg-neutral-800" aria-hidden />
      </div>
      <div className={SHEET}><Skeleton shape={shape} /></div>
    </div>
  )
}

/**
 * Broken, with the way out.
 *
 * ⚠️ IT TAKES A RETRY, and that is the point of this pass. A failed fetch used to be a
 * sentence and a dead end: the only way to ask again was to reload the whole admin, which
 * throws away every other page's state to re-ask one question. `reload` on `ViewState` was
 * already there and nothing called it.
 */
export function Failed({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const t = useAdminT()
  // Monochrome like every other feedback surface (docs/admin-design.md): the strong border
  // and the leading "!" carry "broken" without spending a colour the admin does not have.
  return (
    <div className="rounded-[10px] border border-neutral-900 bg-white p-4 text-sm text-neutral-900 dark:border-white dark:bg-neutral-900 dark:text-white">
      <p>
        <span aria-hidden="true" className="mr-2 font-semibold">!</span>
        {error}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>{t.retry}</Button>
      )}
    </div>
  )
}

/** Render `children(data)` only once there IS data. */
export function View<T>({ state, shape, children }: {
  state: ViewState<T>
  /** What the wait should look like. Omit for the ellipsis. */
  shape?: SkeletonShape
  children: (data: T) => ReactNode
}) {
  if (state.error) return <Failed error={state.error} onRetry={state.reload} />
  if (!state.data) return <Loading shape={shape} />
  return <>{children(state.data)}</>
}
