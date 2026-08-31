// The Library's three HOUSEKEEPING sweeps, split out of `MediaLibrary.tsx` on 2026-08-31 when
// that file crossed its 400-line ceiling for the second time.
//
// The seam is the one the file already had: everything here answers a question about the
// library AS A WHOLE — which pictures nothing links to, delete all of those, describe the
// ones with no alt text — while what stays behind is about looking at pictures and picking
// them. None of this knows about the grid, the search, the sort or the selection; all of it
// wants the same two things, a way to say something went wrong and a way to hand back a new
// list of items when the server writes one.
import { useCallback, useState } from 'react'
import type { MediaItem, ApiResponse } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'

export function useMediaSweeps(setItems: (items: MediaItem[]) => void) {
  const t = useAdminT()
  const { notify } = useToast()
  const [checking, setChecking] = useState(false)
  /** Null until a check has run; then the set of urls nothing references. */
  const [unused, setUnused] = useState<Set<string> | null>(null)
  const [onlyUnused, setOnlyUnused] = useState(false)
  const [describing, setDescribing] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  /** Non-destructive audit: flag media referenced by no post, page, setting or revision. */
  const checkUnused = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/media/unused')
      const json = (await res.json()) as ApiResponse<string[]>
      if (!json.success || !json.data) throw new Error(json.error)
      const set = new Set(json.data)
      setUnused(set)
      setOnlyUnused(set.size > 0)
      notify(set.size > 0 ? `${t.unusedFound}: ${set.size}` : t.unusedNone)
    } catch {
      notify(t.checkUnusedFailed, 'error')
    } finally {
      setChecking(false)
    }
  }, [notify, t])

  // Delete EVERY currently-flagged unused image in one atomic request (one manifest write)
  // — no per-image race, and far faster than clicking each.
  const deleteAllUnused = useCallback(async () => {
    if (!unused || unused.size === 0) return
    if (!confirm(t.confirmDeleteUnused)) return
    setDeletingAll(true)
    try {
      const res = await fetch('/api/media/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [...unused] }),
      })
      const json = (await res.json()) as ApiResponse<MediaItem[]>
      if (!json.success || !json.data) throw new Error(json.error)
      setItems(json.data)
      // Keep only the urls that genuinely survived (defensive — normally none).
      const surviving = new Set(json.data.map((m) => m.url))
      const left = [...unused].filter((u) => surviving.has(u))
      setUnused(left.length ? new Set(left) : null)
      if (left.length === 0) setOnlyUnused(false)
      notify(t.movedToTrash)
    } catch {
      notify(t.deleteFailed, 'error')
    } finally {
      setDeletingAll(false)
    }
  }, [unused, setItems, notify, t])

  const describeMissing = useCallback(async () => {
    setDescribing(true)
    try {
      const res = await fetch('/api/media/describe-missing', { method: 'POST' })
      const json = (await res.json()) as ApiResponse<{ queued: number }>
      if (!json.success || !json.data) throw new Error(json.error)
      notify(`${t.aiDescribeAllStarted}: ${json.data.queued}`)
    } catch (error) {
      // "No model yet" and "this model has no eyes" are different problems with different
      // fixes, and the second one is reached with everything apparently configured.
      const why = error instanceof Error && error.message === 'ai_cannot_see_images'
        ? t.aiCannotSeeImages
        : t.aiNotConfigured
      notify(why, 'error')
    } finally {
      setDescribing(false)
    }
  }, [notify, t])

  /** One image deleted on its own is no longer unused — it is no longer anything. */
  const dropFromUnused = useCallback((url: string) => {
    setUnused((prev) => {
      if (!prev?.has(url)) return prev
      const next = new Set(prev)
      next.delete(url)
      return next
    })
  }, [])

  return {
    checking, unused, onlyUnused, setOnlyUnused, describing, deletingAll,
    checkUnused, deleteAllUnused, describeMissing, dropFromUnused,
  }
}
