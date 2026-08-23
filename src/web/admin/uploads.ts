// The media library and the file/icon/font uploads.
//
// Ported from `src/app/api/{media,files}/**`. Thirteen routes, same paths, same request
// shapes, same status codes — including `unsupported_type` with a 415, which the upload
// client shows as its own message rather than a generic failure.
//
// The one shape worth noticing: several of these return the AUTHORITATIVE list after the
// write rather than an acknowledgement. That is deliberate in the frozen tree and kept
// here — the media library is a grid the owner is looking at while deleting, and handing
// back the new list means it cannot drift from what the server thinks.

import type { Context } from 'hono'
import {
  getMedia, addMediaBatch, registerMediaBatch, deleteMediaBatch, deleteMedia, debugDelete,
} from '@/media/media'
import { findUnusedMedia } from '@/media/media-usage'
import {
  getFiles, addFilesBatch, registerFilesBatch, deleteFilesBatch, deleteFile,
  getSiteIcons, isAllowedIconType, uploadIcon, isAllowedFontType, uploadFont,
} from '@/media/files'
import { collapseBlob, readBlob } from '@/media/blob'
import { mimeOf } from '@/media/mime'
import { describeUpload } from '@/media/alt-text'
import { getIntegrationKeys } from '@/store/integration-keys'
import { all } from '@/store/query'
import { checkUpload } from '@/media/limits'
import { finalizeVariants } from '@/media/finalize'
import { clearCache } from '@/server/cache'
import { logActivity } from '@/server/activity'
import { fail, json } from '@/web/api'
import { ownerRouter } from '@/web/guard'

/** What the media library accepts. Anything else is a 415, not a silent skip. */
const IMAGE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/avif',
]

/** Only rasters get display variants; SVG and GIF are left alone. */
const RASTER_RE = /\.(jpe?g|png)$/i

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []

const body = async <T>(c: Context): Promise<Partial<T>> =>
  (await c.req.json().catch(() => ({}))) as Partial<T>

/**
 * Encode display variants after the response.
 *
 * Same rule as the post save: the original renders meanwhile, and the cron sweep finalises
 * anything dropped here, so a failure costs a slower first paint rather than an upload.
 */
function encodeVariants(urls: string[]): void {
  const rasters = urls.map(collapseBlob).filter((p) => RASTER_RE.test(p))
  if (rasters.length === 0) return
  void finalizeVariants(rasters)
    .then((n) => { if (n > 0) clearCache() })
    .catch((error: unknown) => {
      console.error(`[ERROR] finalizeVariants: ${(error as Error).message}`)
    })
}

/** Files from a multipart body, under the field name the admin client uses. */
async function formFiles(c: Context): Promise<File[]> {
  const form = await c.req.formData().catch(() => null)
  return form === null ? [] : form.getAll('file').filter((f): f is File => f instanceof File)
}

/**
 * 413 when a batch is over the per-file cap or would push the store past its quota, `null`
 * to go ahead.
 *
 * Called with `File.size` BEFORE any `arrayBuffer()`, which is the difference between
 * refusing a 900 MB upload and holding 900 MB of it in memory to refuse it. The reason
 * string is what the upload client shows, in the same shape as `unsupported_type`.
 */
async function refuseOversize(c: Context, files: File[]): Promise<Response | null> {
  const refusal = await checkUpload(files.map((f) => f.size))
  return refusal === null ? null : fail(c, refusal.reason, 413)
}

export function uploadRoutes() {
  const router = ownerRouter()

  // ----- the media library ----------------------------------------------------
  // Owner only, and only the admin grid consumes it. Public pages get their image URLs
  // from the rendered markdown, never from this.

  router.get('/api/media', async () => json(await getMedia()))

  router.post('/api/media/upload', async (c) => {
    const files = await formFiles(c)
    if (files.length === 0) return fail(c, 'No files provided', 400)
    const oversize = await refuseOversize(c, files)
    if (oversize) return oversize

    const inputs: { filename: string; body: ArrayBuffer; contentType: string }[] = []
    for (const file of files) {
      const contentType = file.type || ''
      // The WHOLE batch is refused on one bad type, matching the frozen tree. A partial
      // upload would leave the owner reconciling which of twenty images landed.
      if (!IMAGE_TYPES.includes(contentType)) return fail(c, 'unsupported_type', 415)
      inputs.push({ filename: file.name, body: await file.arrayBuffer(), contentType })
    }

    const uploaded = await addMediaBatch(inputs)
    encodeVariants(uploaded.map((m) => m.url))
    void logActivity('media.upload', `${uploaded.length} image(s)`)
    return json(uploaded, 201)
  })

  // Register an upload that went straight to storage without passing through here.
  router.post('/api/media/register', async (c) => {
    const input = await body<{ items: unknown }>(c)
    const items = (Array.isArray(input.items) ? input.items : []).filter(
      (i): i is { url: string; filename: string } =>
        !!i && typeof i.url === 'string' && typeof i.filename === 'string',
    )
    if (items.length === 0) return fail(c, 'No items provided', 400)

    const uploaded = await registerMediaBatch(items)
    encodeVariants(uploaded.map((m) => m.url))
    void logActivity('media.upload', `${uploaded.length} image(s)`)
    return json(uploaded, 201)
  })

  router.post('/api/media/delete', async (c) => {
    const urls = strings((await body<{ urls: unknown }>(c)).urls)
    if (urls.length === 0) return fail(c, 'No urls provided', 400)
    const items = await deleteMediaBatch(urls)
    clearCache()
    void logActivity('media.delete', `${urls.length} image(s)`)
    return json(items)
  })

  // The single-image delete. The URL is a query parameter rather than a path segment
  // because it contains slashes, and the frozen tree's path was `/api/media/[filename]`
  // with the real target in `?url=` for exactly that reason.
  router.delete('/api/media/:filename', async (c) => {
    const url = c.req.query('url')
    if (!url) return fail(c, 'Missing url', 400)
    const items = await deleteMedia(url)
    // A deleted image may be sitting in a cached page.
    clearCache()
    void logActivity('media.delete', url.split('/').pop() || url)
    return json(items)
  })

  // Non-destructive: returns what nothing references so the owner can review. It never
  // deletes, which is the whole difference from the destructive sweeper it replaced.
  router.get('/api/media/unused', async () => json(await findUnusedMedia()))

  // Describe every image that has never been described (alt IS NULL — a cleared '' is a
  // decision and stays cleared). Answers immediately with the queue size and works in the
  // background: a five-hundred-image backfill is a coffee, not a spinner. One at a time,
  // deliberately — this is a batch job on the owner's paid API, not a stampede.
  router.post('/api/media/describe-missing', async (c) => {
    const keys = await getIntegrationKeys()
    if (!keys.aiProvider || !keys.aiApiKey) return fail(c, 'ai_not_configured', 400)
    const rows = all<{ path: string }>(
      `select path from media where alt is null and deleted_at is null order by uploaded_at desc`,
    )
    const images = rows.filter((r) => /\.(jpe?g|png|webp|gif)$/i.test(r.path))
    void (async () => {
      let done = 0
      for (const r of images) {
        try {
          const buf = await readBlob(r.path)
          await describeUpload(r.path, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, mimeOf(r.path))
          done++
        } catch { /* one bad file must not stop the batch */ }
      }
      void logActivity('media.upload', `alt backfill: ${done}/${images.length}`)
    })()
    return json({ queued: images.length })
  })

  router.get('/api/media/debug', async (c) => {
    const url = c.req.query('url') ?? ''
    return json({ url, ...(await debugDelete(url)) })
  })

  // ----- files, icons and fonts -----------------------------------------------

  router.get('/api/files', async () => json(await getFiles()))

  // Site icons live under `files/` in storage but are not `files` rows, so the Files tab
  // lists them separately and read-only.
  router.get('/api/files/icons', async () => json(await getSiteIcons()))

  router.post('/api/files/attach', async (c) => {
    const files = await formFiles(c)
    if (files.length === 0) return fail(c, 'No files provided', 400)
    const oversize = await refuseOversize(c, files)
    if (oversize) return oversize
    const uploaded = await addFilesBatch(await Promise.all(files.map(async (f) => ({
      filename: f.name,
      body: await f.arrayBuffer(),
      // Attachments are deliberately unrestricted by type; the media library is the
      // surface with an allow-list, because those get rendered into pages.
      contentType: f.type || 'application/octet-stream',
    }))))
    void logActivity('file.add', `${uploaded.length} file(s)`)
    return json(uploaded, 201)
  })

  router.post('/api/files/register', async (c) => {
    const input = await body<{ items: unknown }>(c)
    const items = (Array.isArray(input.items) ? input.items : []).filter(
      (i): i is { url: string; filename: string; size: number; contentType: string } =>
        !!i && typeof i.url === 'string' && typeof i.filename === 'string'
        && typeof i.size === 'number' && typeof i.contentType === 'string',
    )
    if (items.length === 0) return fail(c, 'No items provided', 400)
    const uploaded = await registerFilesBatch(items)
    void logActivity('file.add', `${uploaded.length} file(s)`)
    return json(uploaded, 201)
  })

  router.post('/api/files/delete', async (c) => {
    const urls = strings((await body<{ urls: unknown }>(c)).urls)
    if (urls.length === 0) return fail(c, 'No urls provided', 400)
    const items = await deleteFilesBatch(urls)
    void logActivity('file.delete', `${urls.length} file(s)`)
    return json(items)
  })

  router.delete('/api/files/by', async (c) => {
    const url = c.req.query('url')
    if (!url) return fail(c, 'Missing url', 400)
    const items = await deleteFile(url)
    void logActivity('file.delete', url.split('/').pop() || url)
    return json(items)
  })

  router.post('/api/files/upload', async (c) => {
    const form = await c.req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return fail(c, 'No file provided', 400)

    const kindRaw = String(form?.get('kind') ?? 'icon')
    const kind = kindRaw === 'favicon' || kindRaw === 'app-icon' ? kindRaw : 'icon'

    // Trust the browser's MIME, but fall back to the extension when it sends nothing —
    // which is common for `.ico`, the one format this route most exists to accept.
    let contentType = file.type || ''
    if (!isAllowedIconType(contentType) && /\.ico$/i.test(file.name)) contentType = 'image/x-icon'
    if (!isAllowedIconType(contentType)) return fail(c, 'unsupported_type', 415)
    const oversize = await refuseOversize(c, [file])
    if (oversize) return oversize

    const url = await uploadIcon(kind, await file.arrayBuffer(), contentType)
    clearCache()
    void logActivity('icon.upload', kind)
    return json({ url }, 201)
  })

  router.post('/api/files/font', async (c) => {
    const form = await c.req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return fail(c, 'No file provided', 400)
    if (!isAllowedFontType(file.name)) return fail(c, 'unsupported_type', 415)
    const oversize = await refuseOversize(c, [file])
    if (oversize) return oversize

    // Only the four weights the typography settings offer. Anything else becomes 400,
    // rather than storing a weight no stylesheet will ever ask for.
    const weightRaw = Number(form?.get('weight'))
    const weight = [400, 500, 600, 700].includes(weightRaw) ? weightRaw : 400

    const result = await uploadFont(file.name, weight, await file.arrayBuffer(), file.type || '')
    clearCache()
    void logActivity('font.upload', result.family)
    return json(result, 201)
  })

  return router
}
