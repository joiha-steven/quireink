// Drag-drop + click upload zone with a progress bar. Multi-file.
import { useState } from 'react'
import type { MediaItem } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { uploadImages } from '@/admin/upload-client'
import { Dropzone } from '@/admin/ui/Dropzone'
import { useAdminT } from './I18nProvider'

export function ImageUploader({ onUploaded }: { onUploaded: (items: MediaItem[]) => void }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [progress, setProgress] = useState<number | null>(null)

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
    <Dropzone
      label={t.dropzone}
      accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml,image/gif"
      progress={progress}
      onFiles={handle}
    />
  )
}
