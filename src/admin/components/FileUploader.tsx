// Drag-drop + click upload zone for the Files/Videos tabs. By default accepts ANY
// file type (the catch-all attachment store); `accept`/`label` narrow it for the
// Videos tab. Multi-file, with a progress bar.
import { useState } from 'react'
import type { FileItem } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { uploadAttachments } from '@/admin/upload-client'
import { Dropzone } from '@/admin/ui/Dropzone'
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
  const [progress, setProgress] = useState<number | null>(null)

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

  return <Dropzone label={label ?? t.filesDropzone} accept={accept} progress={progress} onFiles={handle} />
}
