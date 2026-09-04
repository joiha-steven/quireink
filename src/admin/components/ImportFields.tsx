// Content import (Admin → Settings → System). One file input, four platforms: a
// WordPress .xml goes to /api/import/wordpress, a Ghost .json to /api/import/ghost, and
// a Substack or Medium .zip to /api/import/archive, where the server tells the two apart
// by structure. Everything converts to Markdown and is ADDED (slug collisions get a
// numeric suffix; nothing is overwritten). After the words, the pictures: the client
// loops /api/import/images in small batches until every remote image is stored locally,
// so the pace shows in the button and no single request runs long.
import { useRef, useState } from 'react'
import { useRouter } from '@/admin/router'
import type { ApiResponse } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { Button } from '@/admin/ui/Button'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT } from './kit'

type ImportResult = { posts: number; pages: number; skipped: number }
type ImagesReport = { found: number; moved: number; remaining: number; failed: { url: string; reason: string }[] }

export function ImportFields() {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  // Batch by batch until nothing remote remains — or a batch moves nothing, which means
  // what is left only fails and asking again buys the same errors.
  async function fetchImages() {
    let moved = 0
    for (;;) {
      const res = await fetch('/api/import/images', { method: 'POST' })
      const json = (await res.json()) as ApiResponse<ImagesReport>
      if (!json.success || !json.data) return
      const r = json.data
      moved += r.moved
      setProgress(`${t.importImages}… ${moved}/${moved + r.remaining}`)
      if (r.remaining === 0 || r.moved === 0) {
        notify(r.failed.length > 0
          ? `${t.importImagesDone}: ${moved} · ${r.failed.length} ${t.importImagesFailed}`
          : `${t.importImagesDone}: ${moved}`)
        return
      }
    }
  }

  async function run() {
    if (!file) return
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const name = file.name.toLowerCase()
      const endpoint = name.endsWith('.json') ? '/api/import/ghost'
        : name.endsWith('.zip') ? '/api/import/archive'
        : '/api/import/wordpress'
      const res = await fetch(endpoint, { method: 'POST', body })
      const json = (await res.json()) as ApiResponse<ImportResult>
      if (!json.success || !json.data) throw new Error(json.error)
      const d = json.data
      notify(`${t.importDone}: ${d.posts} + ${d.pages}`)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      router.refresh() // surface the new posts/pages in the admin lists at once
      await fetchImages()
    } catch {
      notify(t.deleteFailed, 'error')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <div className="space-y-4">
      <p className={NOTE_TEXT}>{t.importHelp}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".xml,.json,.zip,text/xml,application/xml,application/json,application/zip"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-4 dark:border-neutral-700 dark:bg-neutral-900/50">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            {t.importChoose}
          </Button>
          {file && <span className="min-w-0 truncate text-sm text-neutral-600 dark:text-neutral-300">{file.name}</span>}
        </div>
      </div>
      <Button type="button" onClick={run} disabled={busy || !file}>
        {busy ? progress || `${t.importRun}…` : t.importRun}
      </Button>
    </div>
  )
}
