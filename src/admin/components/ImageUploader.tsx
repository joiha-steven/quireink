// Drag-drop + click upload zone with a progress bar. Multi-file.
import { useRef, useState } from 'react'
import type { MediaItem } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { uploadImages } from '@/admin/upload-client'
import { useAdminT } from './I18nProvider'

export function ImageUploader({ onUploaded }: { onUploaded: (items: MediaItem[]) => void }) {
  const t = useAdminT()
  const { notify } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  async function handle(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) return
    setProgress(0)
    try {
      const items = await uploadImages(images, setProgress)
      onUploaded(items)
      notify(t.uploaded)
    } catch (err) {
      const msg = err instanceof Error && err.message === 'unsupported_type' ? t.unsupportedType : t.uploadFailed
      notify(msg, 'error')
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
        className={`cursor-pointer rounded-[10px] border border-dashed bg-white p-8 text-center text-sm transition-colors dark:bg-neutral-900 ${
          dragging ? 'border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-800' : 'border-neutral-300 text-neutral-500 dark:text-neutral-400 dark:border-neutral-700'
        }`}
      >
        {t.dropzone}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml,image/gif"
          multiple
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
