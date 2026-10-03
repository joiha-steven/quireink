// Register images already written to the store, addressed by URL: read each back only to
// learn its size and make the thumb, then insert the rows. Variants stay deferred.
//
// Split out of `media.ts` on 2026-10-03, when that file reached its 400-line cap carrying the
// upload path's changes; it is the one half of the library that starts from the store rather than
// from a request body.

import type { MediaItem } from '@/types'
import { describeUpload } from '@/media/alt-text'
import { uploadFile, readBlob, collapseBlob } from '@/media/blob'
import { mimeOf } from '@/media/mime'
import { imageSize, safeSize, makeThumb, RASTER } from '@/media/image'
import { insertRows, rowToItem, type MediaRow } from '@/media/media'
import { nowMs } from '@/store/db'

/**
 * `keep`, when given, receives each raster original by path, for `finalizeVariants` to make its
 * variants from without reading the store a second time.
 */
export async function registerMediaBatch(
  items: { url: string; filename: string }[],
  keep?: Map<string, Buffer>,
): Promise<MediaItem[]> {
  const rows: MediaRow[] = []
  const bytes = new Map<string, { buf: Buffer; contentType: string }>()
  for (const it of items) {
    const path = collapseBlob(it.url)
    if (!/^media\//.test(path)) continue
    const buf = await readBlob(path) // direct store read — see readOriginal
    const contentType = mimeOf(path)
    bytes.set(path, { buf, contentType })
    const stem = path.replace(/\.[^.]+$/, '')
    const isRaster = RASTER.test(contentType) || /\.(jpe?g|png)$/i.test(path)
    let width: number | null = null
    let height: number | null = null
    let thumb = path // passthrough (svg/gif/webp): the original is its own thumb
    if (isRaster) {
      const sz = await imageSize(buf)
      width = sz.width || null
      height = sz.height || null
      thumb = `${stem}-thumb.webp`
      await uploadFile(thumb, await makeThumb(buf), 'image/webp')
      keep?.set(path, buf)
    } else {
      const sz = await safeSize(buf)
      width = sz.width ?? null
      height = sz.height ?? null
    }
    rows.push({
      path,
      filename: it.filename || path.replace(/^media\//, ''),
      size: buf.byteLength,
      uploaded_at: nowMs(),
      width,
      height,
      thumb,
      variants: 0,
    })
  }
  if (rows.length === 0) return []
  insertRows(rows)
  // The buffer itself, not `buf.buffer.slice(…)`: the slice was a full copy of every picture,
  // made before the describer had even checked whether the owner had switched it on.
  for (const r of rows) {
    const b = bytes.get(r.path)
    if (b) void describeUpload(r.path, b.buf, b.contentType)
  }
  return rows.map(rowToItem)
}
