// The same three states `useView` gives a page shell, for a component that fetches its own
// endpoint.
//
// `useView` is typed by VIEW NAME through the server's `ViewPayloads` contract, which is
// exactly right for a page shell and no use at all to the five components that load a plain
// admin endpoint of their own — the subscriber list, the redirect table, and the three
// libraries. Every one of them had written the same effect, and every one of them had lost
// the failure somewhere in it:
//
//   · `NewsletterSubscribers` answered a refused request with `setSubs([])`, so a server
//     that was down printed the empty state — "no subscribers yet" to somebody who has 25.
//   · `RedirectsManager` caught the error and did nothing at all, leaving an empty table.
//   · `MediaLibrary` toasted and then drew an empty grid, which is the same lie four seconds
//     later.
//
// An empty answer and a broken question are not the same fact, and a screen that renders
// them identically has told you something false rather than nothing.
import { useCallback, useEffect, useState } from 'react'
import type { ApiResponse } from '@/types'
import type { ViewState } from '@/admin/useView'
import { useRefreshEpoch } from '@/admin/router'

/**
 * @param url an admin endpoint answering the `ApiResponse` envelope
 * @param fallbackError what to say when the failure carried no sentence of its own
 *
 * Refetches when `router.refresh()` bumps the epoch, the same as `useView`, so an existing
 * `router.refresh()` after a save keeps working.
 */
export function useFetched<T>(url: string, fallbackError: string): ViewState<T> {
  const epoch = useRefreshEpoch()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    fetch(url)
      .then(async (r) => (await r.json()) as ApiResponse<T>)
      .then((json) => {
        if (!live) return
        // `success` with no `data` is a malformed answer, not an empty one: rendering it as
        // empty is the failure this hook exists to stop.
        if (json.success && json.data !== undefined) setData(json.data)
        else setError((json.success ? '' : json.error) || fallbackError)
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : fallbackError)
      })
      .finally(() => { if (live) setLoading(false) })
    // A component the reader has already navigated away from must not write its result into
    // state: the next screen is mounted by then.
    return () => { live = false }
  }, [url, fallbackError, epoch, tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { data, error, loading, reload }
}
