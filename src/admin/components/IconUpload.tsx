// Dedicated icon uploader for the favicon / app icon. Uploads straight to the
// `files/` store via POST /api/files/upload (NOT the media library, so site icons
// don't clutter the post-image grid). Accepts .ico in addition to png/svg/etc.
import { useRef, useState } from 'react'
import type { ApiResponse } from '@/types'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'

type Props = {
  kind: 'favicon' | 'app-icon'
  value: string
  onChange: (url: string) => void
  // Tailwind size + shape for the preview box (favicon is small/square, app icon larger/rounded).
  previewClassName: string
}

export function IconUpload({ kind, value, onChange, previewClassName }: Props) {
  const t = useAdminT()
  const { notify } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function upload(file: File) {
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('kind', kind)
      const res = await fetch('/api/files/upload', { method: 'POST', body })
      const json = (await res.json()) as ApiResponse<{ url: string }>
      if (!json.success || !json.data) throw new Error(json.error)
      onChange(json.data.url)
      notify(t.uploaded)
    } catch {
      notify(t.uploadFailed, 'error')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <img src={value} alt="" className={`bg-neutral-100 object-contain p-1 ${previewClassName}`} />
      ) : (
        <span className="text-xs text-neutral-400 dark:text-neutral-500">{t.noImageSelected}</span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp,image/x-icon,.ico"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) upload(f)
        }}
      />
      <Button variant="secondary" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? t.loading : t.chooseImage}
      </Button>
      {value && !busy && (
        <Button variant="ghost" type="button" onClick={() => onChange('')}>{t.removeSelection}</Button>
      )}
    </div>
  )
}
