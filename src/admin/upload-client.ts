// Browser-side upload helpers. Binaries are POSTed as multipart to a server route
// that writes them to disk (STORAGE_LOCAL_DIR) and registers them in one shot — there
// is no client-direct-to-store, and a Node host has no 4.5MB body cap so large files
// are fine. Shared by the library uploaders AND the editor's inline paste/drop, so
// there is one upload path per resource. Client-only; import from client components.
import type { MediaItem, FileItem, ApiResponse } from '@/types'

type Progress = (pct: number) => void

// POST files as multipart to a server route, reporting overall upload progress via
// XHR (fetch can't surface upload progress). Resolves the parsed API rows.
function postFiles<T>(url: string, files: File[], onProgress?: Progress): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const fd = new FormData()
    for (const f of files) fd.append('file', f)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText) as ApiResponse<T[]>
        if (!json.success || !json.data) reject(new Error(json.error ?? 'upload failed'))
        else resolve(json.data)
      } catch {
        reject(new Error(`upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('upload failed'))
    xhr.send(fd)
  })
}

// Upload images, then register them; returns the new media rows (newest data).
export async function uploadImages(files: File[], onProgress?: Progress): Promise<MediaItem[]> {
  return postFiles<MediaItem>('/api/media/upload', files, onProgress)
}

// Upload arbitrary attachments, then register them; returns the new file rows.
export async function uploadAttachments(files: File[], onProgress?: Progress): Promise<FileItem[]> {
  return postFiles<FileItem>('/api/files/attach', files, onProgress)
}
