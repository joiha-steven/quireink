// Drag-drop + click upload zone for the Files/Videos tabs. By default accepts ANY
// file type (the catch-all attachment store); `accept`/`label` narrow it for the
// Videos tab. Multi-file, with a progress bar.
import { useRef, useState } from 'react'
import type { FileItem } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { uploadAttachments } from '@/admin/upload-client'
import { useAdminT } from './I18nProvider'

export function FileUploader({
  onUploaded,
  accept,
  label,
}: {
  onUploaded: (items: FileItem[]) => void
  accept?: string // e.g. 'video/*' for the Videos tab; unset = any file
  label?: string // dropzone copy override (defaults to the Files copy)
}) {
  const t = useAdminT()
  const { notify } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  async function handle(files: File[]) {
    if (files.length === 0) return
    setProgress(0)
    try {
      const items = await uploadAttachments(files, setProgress)
      onUploaded(items)
      notify(t.uploaded)
    } catch {
      notify(t.uploadFailed, 'error')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handle(Array.from(e.dataTransfer.files))
        }}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center text-sm transition-colors ${
          dragging ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-300 text-neutral-500'
        }`}
      >
        {label ?? t.filesDropzone}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => {
            handle(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
      </div>
      {progress !== null && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full bg-neutral-900 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}
