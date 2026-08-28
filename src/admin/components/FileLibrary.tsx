// Files tab: non-image attachments (PDF, zip, docx, audio…). Upload, multi-select
// delete, copy URL, download. Below them, a read-only list of the site icons
// (favicon / app icon) uploaded in Settings — shown for visibility, managed there.
import { useEffect, useState } from 'react'
import type { FileItem, ApiResponse } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { formatBytes } from '@/utils'
import { formatDate } from '@/i18n/i18n'
import { isVideoAttachment } from '@/render/video'
import { FileUploader } from './FileUploader'
import { useAdminT, useAdminLang } from './I18nProvider'
import { CHECK, NOTE_TEXT, TAP } from './kit'

// Short uppercase tag from the filename extension (or the MIME subtype).
function ext(item: FileItem): string {
  const dot = item.filename.lastIndexOf('.')
  if (dot >= 0 && dot < item.filename.length - 1) return item.filename.slice(dot + 1).toUpperCase()
  const sub = item.contentType.split('/')[1]
  return (sub || 'FILE').toUpperCase().slice(0, 5)
}

export function FileLibrary() {
  const t = useAdminT()
  const lang = useAdminLang()
  const { notify } = useToast()
  const [items, setItems] = useState<FileItem[]>([])
  const [icons, setIcons] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      fetch('/api/files').then((r) => r.json() as Promise<ApiResponse<FileItem[]>>),
      fetch('/api/files/icons').then((r) => r.json() as Promise<ApiResponse<FileItem[]>>),
    ])
      .then(([f, i]) => {
        // Videos share the store but live in their own tab (VideoLibrary).
        setItems((f.data ?? []).filter((x) => !isVideoAttachment(x.filename, x.contentType)))
        setIcons(i.data ?? [])
      })
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
      setItems(json.data.filter((x) => !isVideoAttachment(x.filename, x.contentType)))
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

  const row = (f: FileItem, managed: boolean) => (
    <li key={f.url} className="flex items-center gap-3 bg-white p-3 dark:bg-neutral-900">
      {!managed && (
        <input
          type="checkbox"
          checked={selected.has(f.url)}
          onChange={() => toggle(f.url)}
          className={`h-4 w-4 shrink-0 ${CHECK}`}
          aria-label={f.filename}
        />
      )}
      <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-xs font-bold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        {ext(f)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200" title={f.filename}>
          {f.filename}
        </p>
        <p className={NOTE_TEXT}>
          {formatBytes(f.size)} · {formatDate(f.uploadedAt, lang)}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs">
        {managed ? (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {t.iconsManaged}
          </span>
        ) : (
          <>
            <button onClick={() => copyUrl(f.url)} className={`${TAP} text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white`}>
              {t.copyUrl}
            </button>
            <a href={f.url} download={f.filename} className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
              {t.download}
            </a>
          </>
        )}
      </div>
    </li>
  )

  return (
    <div className="space-y-5">
      <FileUploader onUploaded={(uploaded) => setItems((prev) => [...uploaded, ...prev])} />

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
        <p className="py-10 text-center text-neutral-500 dark:text-neutral-400">{t.loading}</p>
      ) : items.length === 0 && icons.length === 0 ? (
        <p className="py-10 text-center text-neutral-500 dark:text-neutral-400">{t.noFiles}</p>
      ) : (
        <div className="space-y-6">
          {items.length > 0 && (
            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {items.map((f) => row(f, false))}
            </ul>
          )}
          {icons.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{t.iconsGroupTitle}</h3>
              <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {icons.map((f) => row(f, true))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
