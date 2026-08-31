// Media grid. Two modes:
// - 'page'   : full library; click a thumbnail to zoom, plus copy-URL / delete.
// - 'picker' : modal for choosing an image (calls onSelect with the URL). With
//   `multi`, tiles toggle a selection (checkbox + ring) and an "Add (N)" button
//   returns them all via onSelectMany — used to build a gallery in one go.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MediaItem, ApiResponse } from '@/types'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { formatBytes } from '@/utils'
import { ImageUploader } from './ImageUploader'
import { MediaToolbar, type MediaSort } from './MediaToolbar'
import {EmptyState } from './kit'
import { useAdminT, useAdminLang } from './I18nProvider'
import { OVERLAY, SHEET_TOOL, SHEET_TOOL_DANGER } from './sheet'
import { MediaCard } from './MediaCard'
import { useMediaSweeps } from './useMediaSweeps'

type Props = {
  mode?: 'page' | 'picker'
  /**
   * Where the tool band goes, when the page wants it on the SHEET'S OWN FIRST ROW beside
   * the kind tabs instead of on a second row under them.
   *
   * The Library was two chrome rows deep before anything of its own appeared: tabs, then a
   * band holding a count, a search and a sort — and the tab row was otherwise empty, so the
   * second row existed only because the count lives in THIS component's state and the tabs
   * live in its parent's. A portal is the honest fix: the band stays owned by the state it
   * reads, and lands where it belongs on the page. React context follows the React tree, not
   * the DOM, so translations and toasts still reach it.
   */
  toolsSlot?: HTMLElement | null
  multi?: boolean
  onSelect?: (url: string, alt?: string) => void
  onSelectMany?: (urls: string[]) => void
  onClose?: () => void
}

const PAGE = 50 // render this many, then load more on scroll (keeps it light)

export function MediaLibrary({ mode = 'page', multi = false, onSelect, onSelectMany, onClose, toolsSlot }: Props) {
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
  /** The anchor a shift-click measures its run from: the last box ticked on its own. */
  const anchor = useRef<number | null>(null)
  const {
    checking, unused, onlyUnused, setOnlyUnused, describing, deletingAll,
    checkUnused, deleteAllUnused, describeMissing, dropFromUnused,
  } = useMediaSweeps(setItems)

  // Compose the visible list: unused filter → name search → sort. Total count + size are
  // over the whole library, not the filtered view.
  //
  // MEMOISED and lifted above the handlers, both for the same reason: `toggleSelect` reads
  // this list to work out what a shift-click's run covers, so it has to exist before that
  // callback is declared — and a fresh array on every render would make that callback fresh
  // too, which is exactly what the memo on the card is there to avoid.
  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...(onlyUnused && unused ? items.filter((m) => unused.has(m.url)) : items)]
      .filter((m) => !q || m.filename.toLowerCase().includes(q))
      .sort((a, b) =>
        sort === 'name'
          ? a.filename.localeCompare(b.filename)
          : sort === 'size'
            ? b.size - a.size
            : +new Date(b.uploadedAt) - +new Date(a.uploadedAt),
      )
  }, [items, query, sort, onlyUnused, unused])
  const totalSize = useMemo(() => items.reduce((n, m) => n + (m.size || 0), 0), [items])

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

  const handleDelete = useCallback(async (url: string) => {
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
      dropFromUnused(url)
      notify(t.movedToTrash)
    } catch {
      notify(t.deleteFailed, 'error')
    }
  }, [dropFromUnused, notify, t])

  // `useCallback` on the four handlers a card is given, because `MediaCard` is memoised and
  // a new function every render would defeat it: the whole grid re-rendered on every tick.
  const copyUrl = useCallback(async (url: string) => {
    await navigator.clipboard.writeText(url)
    notify(t.copiedUrl)
  }, [notify, t])

  // Multi-select delete (page mode). Reuses the atomic batch endpoint so several
  // images go in one manifest write (no per-image race).
  /**
   * Tick one box, or — with shift — the whole run between the last one and this one.
   *
   * A run always turns ON rather than mirroring the clicked box: shift-click is reached for
   * to take a batch, and a modifier that sometimes clears is a modifier nobody trusts. To
   * drop something from a run, click its own box.
   */
  const toggleSelect = useCallback((url: string, shift = false) => {
    const i = view.findIndex((m) => m.url === url)
    const from = anchor.current
    setSelected((prev) => {
      const next = new Set(prev)
      if (shift && from !== null && i >= 0) {
        const [a, b] = from < i ? [from, i] : [i, from]
        for (let k = a; k <= b; k++) {
          const it = view[k]
          if (it) next.add(it.url)
        }
        return next
      }
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
    // A shift-click does not move the anchor, so a run can be re-measured wider or narrower
    // from the same starting box without going back to tick it again.
    if (!shift && i >= 0) anchor.current = i
  }, [view])

  /** One handler for every tile, so the memo on the card holds: clicking a picture zooms it
      on the Library page and chooses it in the picker. */
  const openItem = useCallback((m: MediaItem) => {
    if (mode !== 'picker') return setZoom(m)
    if (multi) return toggleSelect(m.url, false)
    onSelect?.(m.url, m.alt)
  }, [mode, multi, onSelect, toggleSelect])
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

  // Backfill alt text for every never-described image (Settings → AI must hold a key).
  // The server answers with the queue size and works on; results land in the rows as
  // they arrive, so a reload shows progress and the activity log shows the total.
  const grid = (
    <>
      {/* Five at desktop, six on a wide screen. The old limit was the caption: three facts
          on one line needed a wide tile or they truncated. The caption is the NAME now, so
          the column count answers to the pictures instead. The gaps are uneven on purpose —
          the caption sits under its own tile, so the vertical gap has a line of type in it
          that the horizontal one does not. */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {view.slice(0, visible).map((m) => (
          <MediaCard
            key={m.url}
            m={m}
            mode={mode}
            multi={multi}
            selected={selected.has(m.url)}
            lang={lang}
            unused={unused?.has(m.url) ?? false}
            onOpen={openItem}
            onToggle={toggleSelect}
            onCopy={copyUrl}
            onDelete={handleDelete}
          />
        ))}
      </div>
      {visible < view.length && <div ref={sentinel} className="h-10" />}
    </>
  )

  const toolBand = mode === 'page' && items.length > 0 && (
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
      // In the sheet's first row it is already inside SheetTop's rule and padding, so it
      // brings neither. Standing alone it draws its own closing rule, as it always did.
      // `contents` in the slot: the count and the search/sort group become direct children
      // of the sheet's first row, so the row lays them out and `ml-auto` still holds the
      // right edge. A wrapper of its own would have been a flex box inside a flex box, each
      // with its own idea of what wraps first.
      className={toolsSlot ? 'contents' : undefined}
    />
  )

  const body = (
    <div className="space-y-5">
      {toolsSlot ? createPortal(toolBand, toolsSlot) : toolBand}
      <ImageUploader onUploaded={(uploaded) => setItems((prev) => [...uploaded, ...prev])} />
      {mode === 'page' && items.length > 0 && (
        <div className="flex flex-wrap justify-end gap-4">
          {selected.size > 0 && (
            <>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className={SHEET_TOOL}
              >
                {t.clearSelection}
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                className={SHEET_TOOL_DANGER}
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
                className={SHEET_TOOL}
              >
                {onlyUnused ? t.showAll : t.showUnusedOnly}
              </button>
              <button
                type="button"
                onClick={deleteAllUnused}
                disabled={deletingAll}
                className={SHEET_TOOL_DANGER}
              >
                {t.deleteAllUnused} ({unused.size})
              </button>
            </>
          )}
          <button
            type="button"
            onClick={checkUnused}
            disabled={checking}
            className={SHEET_TOOL}
          >
            {t.checkUnused}
          </button>
          <button
            type="button"
            onClick={describeMissing}
            disabled={describing}
            className={SHEET_TOOL}
          >
            {t.aiDescribeAll}
          </button>
        </div>
      )}
      {loading ? (
        <p className="py-10 text-center text-neutral-500 dark:text-neutral-400">{t.loading}</p>
      ) : items.length === 0 ? (
        <EmptyState title={t.noMedia} />
      ) : view.length === 0 ? (
        <p className="py-10 text-center text-neutral-500 dark:text-neutral-400">{t.mediaNoMatch}</p>
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
      <div className={`flex max-h-[85vh] w-full max-w-3xl flex-col p-5 ${OVERLAY}`}>
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
          <p className="mb-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400">{t.galleryPickHint}</p>
        )}
        <div className="overflow-y-auto">{body}</div>
      </div>
    </div>
  )
}
