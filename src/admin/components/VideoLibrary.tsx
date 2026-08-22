// Videos tab: video attachments from the shared files store, shown as a grid of
// native players. Upload (video/* only), multi-select delete, copy URL — copy a
// video's URL and paste it on its own line in the editor to embed the player.
import { useEffect, useState } from 'react'
import type { FileItem, ApiResponse } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { formatBytes } from '@/utils'
import { formatDate } from '@/i18n/i18n'
import { isVideoAttachment } from '@/render/video'
import { FileUploader } from './FileUploader'
import { useAdminT, useAdminLang } from './I18nProvider'
import { CHECK, NOTE_TEXT } from './kit'

const onlyVideos = (items: FileItem[]) => items.filter((f) => isVideoAttachment(f.filename, f.contentType))

export function VideoLibrary() {
  const t = useAdminT()
  const lang = useAdminLang()
  const { notify } = useToast()
  const [items, setItems] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/files')
      .then((r) => r.json() as Promise<ApiResponse<FileItem[]>>)
      .then((f) => setItems(onlyVideos(f.data ?? [])))
      .catch(() => notify(t.loadFilesFailed, 'error'))
      .finally(() => setLoading(false))
  }, [notify, t])

  function toggle(url: string) {
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
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [...selected] }),
      })
      const json = (await res.json()) as ApiResponse<FileItem[]>
      if (!json.success || !json.data) throw new Error(json.error)
      setItems(onlyVideos(json.data))
      setSelected(new Set())
      notify(t.movedToTrash)
    } catch {
      notify(t.deleteFailed, 'error')
    }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    notify(t.copiedUrl)
  }

  return (
    <div className="space-y-5">
      <FileUploader
        accept="video/*"
        label={t.videosDropzone}
        onUploaded={(uploaded) => setItems((prev) => [...onlyVideos(uploaded), ...prev])}
      />

      {selected.size > 0 && (
        <div className="flex items-center justify-end gap-4">
          <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
            {t.clearSelection}
          </button>
          <button type="button" onClick={deleteSelected} className="text-sm font-medium text-neutral-800 hover:text-black dark:text-neutral-200 dark:hover:text-white">
            {t.deleteSelected} ({selected.size})
          </button>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-neutral-400 dark:text-neutral-500">{t.loading}</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-neutral-400 dark:text-neutral-500">{t.noVideos}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <li key={f.url} className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              {/* preload=metadata: the browser fetches only headers/moov, not the file. */}
              <video src={f.url} controls preload="metadata" playsInline className="block aspect-video w-full bg-neutral-950 object-contain" />
              <div className="flex items-start gap-3 p-3">
                <input
                  type="checkbox"
                  checked={selected.has(f.url)}
                  onChange={() => toggle(f.url)}
                  className={`mt-1 h-4 w-4 shrink-0 ${CHECK}`}
                  aria-label={f.filename}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200" title={f.filename}>
                    {f.filename}
                  </p>
                  <p className={NOTE_TEXT}>
                    {formatBytes(f.size)} · {formatDate(f.uploadedAt, lang)}
                  </p>
                </div>
                <button onClick={() => copyUrl(f.url)} className="shrink-0 text-xs text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                  {t.copyUrl}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
