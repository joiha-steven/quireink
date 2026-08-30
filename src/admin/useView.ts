// The data hook every admin page shell uses.
//
// It stands in for what a Next server component did for free: fetch this page's props
// before rendering it. The three states it exposes — loading, error, data — are the three
// a server component never had to think about, and skipping any of them is how a client
// port ends up showing an empty table where the server showed a list.
//
// It refetches when `router.refresh()` bumps the epoch, so the ported components' existing
// `router.refresh()` calls after a save keep working unchanged.

import { useCallback, useEffect, useRef, useState } from 'react'
// TYPE-ONLY, and load-bearing: `views.ts` is server code, and the word `type` on this line
// is what keeps `bun:sqlite` out of the browser bundle. `check:bundle` reads the built
// output to prove it held.
import type { ViewPayloads } from '@/web/admin/views'
import { view } from '@/admin/api'
import { beginRequest, endRequest } from '@/admin/pending'
import { useRefreshEpoch } from '@/admin/router'

export type ViewName = keyof ViewPayloads

export type ViewState<T> = {
  data: T | null
  error: string | null
  loading: boolean
  /** Refetch without going through the router, for a component that owns its own reload. */
  reload: () => void
}

/**
 * Typed by view NAME, through the `ViewPayloads` contract the server exports. Callers
 * used to supply their own generic (`useView<Props>('dashboard')`), which meant thirteen
 * screens each asserting what the server "probably" returns — rename one field in
 * `views.ts` and every assertion stayed green while the screen rendered blank. Now the
 * name resolves the type, and drift on either side is a compile error.
 */
/**
 * The last answer each view gave, so a remount can draw something before the round trip.
 *
 * WHY: every page shell fetches on mount and starts at `null`, and `View` renders a centred
 * ellipsis until it has data. On the write screen that meant clicking a row in the left column
 * threw the column away and rebuilt it — the list is drawn by the page, and the page was
 * waiting. It read as a full reload, and it lost the scroll position with it.
 *
 * ⚠️ IT IS KEYED BY EPOCH, and that is not an optimisation. `router.refresh()` exists to say
 * "what you have is no longer true" — after a delete, after a settings save — and a cache that
 * ignored it would hand back the row somebody just binned. An entry from an older epoch is
 * skipped, so a refresh always costs a real fetch.
 *
 * Every seeded render revalidates immediately behind it, so the stale answer is on screen for
 * one round trip and never longer.
 */
const lastSeen = new Map<string, { epoch: number; data: unknown }>()

export function useView<N extends ViewName>(name: N, query = ''): ViewState<ViewPayloads[N]> {
  type T = ViewPayloads[N]
  const epoch = useRefreshEpoch()
  const [data, setData] = useState<T | null>(() => {
    const seen = lastSeen.get(`${name}${query}`)
    return seen && seen.epoch === epoch ? (seen.data as T) : null
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  // WHEN THE KEY CHANGES, THE OLD ANSWER STOPS BEING AN ANSWER. `data` used to survive a
  // query change untouched, so clicking post B in the write pane rendered post A's editor
  // until the fetch landed — and anything typed in that window went into A's document and
  // was thrown away when the remount came. Either the cache has B already (instant) or the
  // sheet says it is loading; showing A is the one option that is never right.
  //
  // Assigning during render is React's own pattern for state derived from props, and it is
  // why this is not an effect: an effect would paint the wrong post once first.
  const key = `${name}${query}`
  const shown = useRef(key)
  if (shown.current !== key) {
    shown.current = key
    const seen = lastSeen.get(key)
    setData(seen && seen.epoch === epoch ? (seen.data as T) : null)
    setError(null)
  }

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    // The top progress bar reads this counter. Reported here rather than from `loading`,
    // because `loading` belongs to one page's state and a navigation has two of them
    // mounted for a moment.
    beginRequest()
    view<T>(name, query)
      .then((d) => {
        lastSeen.set(`${name}${query}`, { epoch, data: d })
        if (live) setData(d)
      })
      .catch((e: Error) => { if (live) setError(e.message) })
      .finally(() => {
        endRequest()
        if (live) setLoading(false)
      })
    // A page the reader has already navigated away from must not write its result into
    // state: the next page is mounted by then and would flash the previous one's data.
    return () => { live = false }
  }, [name, query, epoch, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}
