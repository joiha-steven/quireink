// Media grid. Two modes:
// - 'page'   : full library; click a thumbnail to zoom, plus copy-URL / delete.
// - 'picker' : modal for choosing an image (calls onSelect with the URL). With
//   `multi`, tiles toggle a selection (checkbox + ring) and an "Add (N)" button
//   returns them all via onSelectMany — used to build a gallery in one go.
import { useEffect, useRef, useState } from 'react'
import type { MediaItem, ApiResponse } from '@/types'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { formatBytes } from '@/utils'
import { formatDate } from '@/i18n/i18n'
import { ImageUploader } from './ImageUploader'
import { MediaToolbar, type MediaSort } from './MediaToolbar'
import { EmptyState } from './kit'
import { useAdminT, useAdminLang } from './I18nProvider'

type Props = {
  mode?: 'page' | 'picker'
  multi?: boolean
  onSelect?: (url: string) => void
  onSelectMany?: (urls: string[]) => void
  onClose?: () => void
}

const PAGE = 50 // render this many, then load more on scroll (keeps it light)

// Compact numeric date (e.g. 22/07/26) — keeps the metadata line to one tidy row.
function compactDate(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleDateString(lang, { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch {
    return ''
  }
}

export function MediaLibrary({ mode = 'page', multi = false, onSelect, onSelectMany, onClose }: Props) {
  const t = useAdminT()
  const lang = useAdminLang()
  const { notify } = useToast()
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState<MediaItem | null>(null)
  const [visible, setVisible] = useState(PAGE)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<MediaSort>('new')
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/media')
      .then((r) => r.json() as Promise<ApiResponse<MediaItem[]>>)
      .then((j) => setItems(j.data ?? []))
      .catch(() => notify(t.loadMediaFailed, 'error'))
      .finally(() => setLoading(false))
  }, [notify, t])

  // Infinite scroll: reveal another page when the sentinel comes into view.
  useEffect(() => {
    const el = sentinel.current
    if (!el || visible >= items.length) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisible((v) => v + PAGE)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [visible, items.length])

  async function handleDelete(url: string) {
    if (!confirm(t.confirmDeleteMedia)) return
    try {
      const res = await fetch(`/api/media/by?url=${encodeURIComponent(url)}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse<MediaItem[]>
      if (!json.success) throw new Error(json.error)
      // Adopt the server's authoritative post-delete list (built from the manifest
      // it just wrote — no Blob re-read), so the grid reflects true server state.
      if (json.data) {
        setItems(json.data)
        // If the URL is STILL in the returned list, the server matched nothing —
        // surface it loudly instead of leaving the image silently sitting there.
        if (json.data.some((m) => m.url === url)) {
          notify(t.deleteNoMatch, 'error')
          return
        }
      }
      setUnused((prev) => {
        if (!prev?.has(url)) return prev
        const next = new Set(prev)
        next.delete(url)
        return next
      })
      notify(t.movedToTrash)
    } catch {
      notify(t.deleteFailed, 'error')
    }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    notify(t.copiedUrl)
  }

  // Multi-select delete (page mode). Reuses the atomic batch endpoint so several
  // images go in one manifest write (no per-image race).
  function toggleSelect(url: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }
  async function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm(t.confirmDeleteSelected)) return
    try {
      const res = await fetch('/api/media/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [...selected] }),
      })
      const json = (await res.json()) as ApiResponse<MediaItem[]>
      if (!json.success || !json.data) throw new Error(json.error)
      setItems(json.data)
      setSelected(new Set())
      notify(t.movedToTrash)
    } catch {
      notify(t.deleteFailed, 'error')
    }
  }

  // Delete EVERY currently-flagged unused image in one atomic request (one
  // manifest write) — no per-image race, and far faster than clicking each.
  const [deletingAll, setDeletingAll] = useState(false)
  async function deleteAllUnused() {
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
  }

  // Non-destructive audit: flag media referenced by no post/page/setting/revision.
  // `unused` is null until a check runs, then a Set of unused URLs to badge/filter.
  const [checking, setChecking] = useState(false)
  const [unused, setUnused] = useState<Set<string> | null>(null)
  const [onlyUnused, setOnlyUnused] = useState(false)
  async function checkUnused() {
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
  }

  // Compose the visible list: unused filter → name search → sort. Total count +
  // size (below) are over the whole library, not the filtered view.
  const q = query.trim().toLowerCase()
  const view = [...(onlyUnused && unused ? items.filter((m) => unused.has(m.url)) : items)]
    .filter((m) => !q || m.filename.toLowerCase().includes(q))
    .sort((a, b) =>
      sort === 'name'
        ? a.filename.localeCompare(b.filename)
        : sort === 'size'
          ? b.size - a.size
          : +new Date(b.uploadedAt) - +new Date(a.uploadedAt),
    )
  const totalSize = items.reduce((n, m) => n + (m.size || 0), 0)
  const grid = (
    <>
      {/* Roomier than a 6-col wall so the dims · size · date caption fits without
          truncating (5 cols at desktop). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {view.slice(0, visible).map((m) => (
          <figure
            key={m.url}
            className={`group relative overflow-hidden rounded-lg border bg-white dark:bg-neutral-900 ${
              (mode === 'page' || multi) && selected.has(m.url)
                ? 'border-neutral-900 ring-2 ring-neutral-900 dark:border-white dark:ring-white'
                : 'border-neutral-200 dark:border-neutral-800'
            }`}
          >
            {/* Image region. The click target fills it; the checkbox + action bar
                sit ON the image (absolute) so they cost zero layout height. */}
            <div className="relative aspect-[3/2] w-full bg-neutral-100 dark:bg-neutral-800">
              <button
                type="button"
                // Page mode: click to zoom. Picker: click to select (toggle in multi).
                onClick={() => (mode === 'picker' ? (multi ? toggleSelect(m.url) : onSelect?.(m.url)) : setZoom(m))}
                aria-label={m.filename}
                className="absolute inset-0 block"
              >
                <img src={m.thumb ?? m.url} alt={m.filename} className="h-full w-full object-cover" />
              </button>
              {(mode === 'page' || multi) && (
                <input
                  type="checkbox"
                  checked={selected.has(m.url)}
                  onChange={() => toggleSelect(m.url)}
                  aria-label={m.filename}
                  className={`absolute left-1.5 top-1.5 z-20 h-4 w-4 accent-neutral-900 transition-opacity dark:accent-white ${
                    selected.has(m.url) ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
                  }`}
                />
              )}
              {unused?.has(m.url) && (
                <span className="absolute right-1.5 top-1.5 z-10 bg-neutral-900 px-1.5 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900">
                  {t.unusedBadge}
                </span>
              )}
              {/* Actions overlay the image bottom (always on touch, hover on desktop). */}
              {mode === 'page' && (
                <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-end gap-2.5 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-2 py-1.5 text-xs opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button type="button" onClick={() => copyUrl(m.url)} className="text-white/90 hover:text-white">
                    {t.copyUrl}
                  </button>
                  <a href={m.url} download={m.filename} className="text-white/90 hover:text-white">
                    {t.download}
                  </a>
                  <button type="button" onClick={() => handleDelete(m.url)} className="font-medium text-white">
                    {t.delete}
                  </button>
                </div>
              )}
            </div>
            <figcaption className="space-y-0.5 p-2 text-xs">
              <p className="truncate font-medium text-neutral-700 dark:text-neutral-300" title={m.filename}>
                {m.filename}
              </p>
              <p className="truncate text-neutral-400" title={`${m.width && m.height ? `${m.width}×${m.height} · ` : ''}${formatBytes(m.size)} · ${formatDate(m.uploadedAt, lang)}`}>
                {m.width && m.height ? `${m.width}×${m.height} · ` : ''}
                {formatBytes(m.size)} · {compactDate(m.uploadedAt, lang)}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
      {visible < view.length && <div ref={sentinel} className="h-10" />}
    </>
  )

  const body = (
    <div className="space-y-5">
      <ImageUploader onUploaded={(uploaded) => setItems((prev) => [...uploaded, ...prev])} />
      {mode === 'page' && items.length > 0 && (
        <MediaToolbar
          count={items.length}
          totalSize={totalSize}
          query={query}
          onQuery={(v) => {
            setQuery(v)
            setVisible(PAGE)
          }}
          sort={sort}
          onSort={setSort}
        />
      )}
      {mode === 'page' && items.length > 0 && (
        <div className="flex flex-wrap justify-end gap-4">
          {selected.size > 0 && (
            <>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              >
                {t.clearSelection}
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                className="text-sm font-medium text-neutral-800 hover:text-black dark:text-neutral-200 dark:hover:text-white"
              >
                {t.deleteSelected} ({selected.size})
              </button>
            </>
          )}
          {unused && unused.size > 0 && (
            <>
              <button
                type="button"
                onClick={() => setOnlyUnused((v) => !v)}
                className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              >
                {onlyUnused ? t.showAll : t.showUnusedOnly}
              </button>
              <button
                type="button"
                onClick={deleteAllUnused}
                disabled={deletingAll}
                className="text-sm font-medium text-neutral-800 hover:text-black disabled:opacity-50 dark:text-neutral-200 dark:hover:text-white"
              >
                {t.deleteAllUnused} ({unused.size})
              </button>
            </>
          )}
          <button
            type="button"
            onClick={checkUnused}
            disabled={checking}
            className="text-sm text-neutral-500 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-white"
          >
            {t.checkUnused}
          </button>
        </div>
      )}
      {loading ? (
        <p className="py-10 text-center text-neutral-400 dark:text-neutral-500">{t.loading}</p>
      ) : items.length === 0 ? (
        <EmptyState title={t.noMedia} />
      ) : view.length === 0 ? (
        <p className="py-10 text-center text-neutral-400 dark:text-neutral-500">{t.mediaNoMatch}</p>
      ) : (
        grid
      )}
    </div>
  )

  // Full-size zoom overlay (page mode).
  const lightbox = zoom && (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 p-4"
      onClick={() => setZoom(null)}
    >
      <img
        src={zoom.url}
        alt={zoom.filename}
        className="max-h-[85vh] max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <p className="mt-3 text-sm text-white/80">
        {zoom.filename}
        {zoom.width && zoom.height ? ` · ${zoom.width}×${zoom.height}` : ''} · {formatBytes(zoom.size)}
      </p>
    </div>
  )

  if (mode === 'page') {
    return (
      <>
        {body}
        {lightbox}
      </>
    )
  }

  // Picker modal.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-5 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{multi ? t.galleryPickTitle : t.mediaTitle}</h2>
          <div className="flex items-center gap-2">
            {multi && selected.size > 0 && (
              <Button onClick={() => onSelectMany?.([...selected])}>
                {t.galleryAdd} ({selected.size})
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              {t.close}
            </Button>
          </div>
        </div>
        {multi && (
          <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">{t.galleryPickHint}</p>
        )}
        <div className="overflow-y-auto">{body}</div>
      </div>
    </div>
  )
}
