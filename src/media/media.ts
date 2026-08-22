// Media: metadata in the SQLite `media` table, binaries on the local filesystem. Every
// raster original (jpg/png/webp/avif) is capped to 2048px on upload (capOriginal) — no
// full-size bytes stored/served. Raster (jpg/png) also keeps responsive variants
// (-1024/-1600 AVIF+WebP) + a -thumb.webp. Vector/anim (svg/gif) stored as-is; variant
// names by convention.

import type { MediaItem } from '@/types'
import {
  uploadFile, readBlob, deleteByPathname, collapseBlob, expandBlob, listBlobs,
} from '@/media/blob'
import { mimeOf } from '@/media/mime'
import { slugify } from '@/utils'
import {
  imageSize, safeSize, makeThumb, capOriginal, RASTER, PASSTHROUGH, SIZES,
} from '@/media/image'
import { all, one, run, tx } from '@/store/query'
import { liveOnly, nowMs, toIso } from '@/store/db'

// A row as stored (store-relative paths). `variants` is a 0/1 column: SQLite has no
// boolean, and the schema constrains it.
type MediaRow = {
  path: string
  filename: string
  size: number
  uploaded_at: number
  width: number | null
  height: number | null
  thumb: string | null
  variants: number
  deleted_at?: number | null
}

// Row -> client item (absolute URLs).
function rowToItem(row: MediaRow): MediaItem {
  return {
    url: expandBlob(row.path),
    filename: row.filename,
    size: Number(row.size),
    uploadedAt: toIso(row.uploaded_at),
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    thumb: row.thumb ? expandBlob(row.thumb) : undefined,
    variants: !!row.variants,
    deletedAt: row.deleted_at == null ? undefined : toIso(row.deleted_at),
  }
}

// A key list as ONE bound parameter, rather than a generated `in (?, ?, ?)` run: this
// codebase does not assemble SQL.
const keyList = (keys: string[]) => JSON.stringify(keys)

function insertRows(rows: MediaRow[]): void {
  tx(() => {
    for (const r of rows) {
      run(
        `insert into media (path, filename, size, uploaded_at, width, height, thumb, variants)
         values ($path, $filename, $size, $uploadedAt, $width, $height, $thumb, $variants)`,
        {
          path: r.path, filename: r.filename, size: r.size, uploadedAt: r.uploaded_at,
          width: r.width, height: r.height, thumb: r.thumb, variants: r.variants,
        },
      )
    }
  })
}

// Non-cached read of the whole library, newest first (mutating helpers use it to
// return authoritative current state).
async function listMedia(): Promise<MediaItem[]> {
  try {
    return all<MediaRow>(
      `select * from media where ${liveOnly('media')} order by uploaded_at desc`,
    ).map(rowToItem)
  } catch (error) {
    console.error(`[ERROR] media.listMedia: ${(error as Error).message}`)
    return []
  }
}

// Library list, newest first. Fresh every request.
export async function getMedia(): Promise<MediaItem[]> {
  return listMedia()
}

// All taken media pathnames, for collision-free naming. Unions DB rows with
// ACTUAL store contents (listBlobs) so derived thumb/variant names are covered too.
async function takenPathnames(): Promise<Set<string>> {
  const set = new Set<string>()
  for (const r of all<{ path: string; thumb: string | null }>(`select path, thumb from media`)) {
    if (/^media\//.test(r.path)) set.add(r.path)
    if (r.thumb && /^media\//.test(r.thumb)) set.add(r.thumb)
  }
  for (const b of await listBlobs()) {
    if (b.pathname.startsWith('media/')) set.add(b.pathname)
  }
  return set
}

// First free "media/{base}.{ext}", appending -2, -3... on collision. Reserves the
// returned name + its derived thumb/variant names so a later batch file can't reuse the stem.
function freePathname(base: string, ext: string, taken: Set<string>): string {
  const make = (n: number) => `media/${n === 1 ? base : `${base}-${n}`}${ext ? `.${ext}` : ''}`
  let n = 1
  while (taken.has(make(n))) n++
  const path = make(n)
  taken.add(path)
  if (/\.(jpe?g|png)$/i.test(path)) {
    const stem = path.replace(/\.[^.]+$/, '')
    taken.add(`${stem}-thumb.webp`)
    for (const w of SIZES) { taken.add(`${stem}-${w}.webp`); taken.add(`${stem}-${w}.avif`) }
  }
  return path
}

// Write the ORIGINAL under the first free name with an exclusive (O_EXCL) write, so
// two concurrent uploads racing for the same name never overwrite each other: the
// loser gets EEXIST and retries the next name (instead of a PK 500 + silent overwrite).
async function writeUniqueOriginal(
  base: string, ext: string, body: Buffer, contentType: string, taken: Set<string>,
): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const path = freePathname(base, ext, taken) // reserves the name in `taken`
    try {
      await uploadFile(path, body, contentType, { exclusive: true })
      return path
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue // claimed; next name
      throw error
    }
  }
  throw new Error(`writeUniqueOriginal: no free name for ${base}.${ext}`)
}

const PASS_EXT: Record<string, string> = { 'image/svg+xml': 'svg', 'image/gif': 'gif', 'image/avif': 'avif' }

// Process one file: upload its blob(s) and return the row to insert (DB write is the
// caller's batch). Dimensions + thumb are BEST-EFFORT — a valid original must never
// fail the upload because thumb/metadata hiccuped (it still renders; cron re-thumbs).
async function processFile(
  filename: string, body: ArrayBuffer, contentType: string, taken: Set<string>,
): Promise<MediaRow> {
  const dot = filename.lastIndexOf('.')
  const base = slugify(dot >= 0 ? filename.slice(0, dot) : filename) || 'file'
  const uploaded_at = nowMs()

  if (RASTER.test(contentType)) {
    const original = await capOriginal(body, contentType) // never store a >2048px original
    const path = await writeUniqueOriginal(base, contentType === 'image/png' ? 'png' : 'jpg', original, contentType, taken)
    const stem = path.replace(/\.[^.]+$/, '')
    const { width, height } = await safeSize(original) // never throws
    let thumb = path // fall back to the original as its own thumb if webp encoding fails
    try {
      await uploadFile(`${stem}-thumb.webp`, await makeThumb(original), 'image/webp')
      thumb = `${stem}-thumb.webp`
    } catch (error) {
      console.error(`[ERROR] media.processFile thumb(${path}): ${(error as Error).message}`)
    }
    return { path, filename: path.replace(/^media\//, ''), size: original.byteLength, uploaded_at, width: width ?? null, height: height ?? null, thumb, variants: 0 }
  }

  if (PASSTHROUGH.test(contentType)) {
    const buf = await capOriginal(body, contentType) // webp/avif capped to 2048; svg/gif untouched
    const path = await writeUniqueOriginal(base, PASS_EXT[contentType] ?? 'webp', buf, contentType, taken)
    const { width, height } = await safeSize(buf)
    return { path, filename: path.replace(/^media\//, ''), size: buf.byteLength, uploaded_at, width: width ?? null, height: height ?? null, thumb: path, variants: 0 }
  }

  throw new Error(`Unsupported file type: ${contentType}`)
}

// Upload one or more files: write the binaries to the store, then insert all rows in a
// single transaction. Unsupported types throw before any DB write (route -> 415).
export async function addMediaBatch(
  files: { filename: string; body: ArrayBuffer; contentType: string }[],
): Promise<MediaItem[]> {
  const taken = await takenPathnames()
  const rows: MediaRow[] = []
  for (const f of files) {
    rows.push(await processFile(f.filename, f.body, f.contentType, taken))
  }
  insertRows(rows)
  return rows.map(rowToItem)
}

// Upload a single file (kept for convenience; delegates to the batch path).
export async function addMedia(
  filename: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<MediaItem> {
  const [item] = await addMediaBatch([{ filename, body, contentType }])
  return item!
}

// Register images already written to the store, addressed by URL: fetch each back only
// to read dims + make the thumb, then insert the row. Variants stay deferred.
export async function registerMediaBatch(items: { url: string; filename: string }[]): Promise<MediaItem[]> {
  const rows: MediaRow[] = []
  for (const it of items) {
    const path = collapseBlob(it.url)
    if (!/^media\//.test(path)) continue
    const buf = await readBlob(path) // direct store read — see readOriginal
    const contentType = mimeOf(path)
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
  return rows.map(rowToItem)
}

// Extract the store-relative `media/...` pathname from any URL form (host-independent,
// so a host mismatch can never make a delete silently no-op).
function mediaKey(s: string): string | null {
  return s.match(/media\/[^?#"')\s]+/)?.[0] ?? null
}

const mediaKeys = (urls: string[]): string[] =>
  [...new Set(urls.map(mediaKey).filter((k): k is string => k !== null))]

// Soft-delete media (set deleted_at) — KEEPS every blob, so a published post
// linking these images keeps rendering until an explicit Trash purge.
export async function deleteMediaBatch(urls: string[]): Promise<MediaItem[]> {
  const keys = mediaKeys(urls)
  if (keys.length === 0) return listMedia()
  run(
    `update media set deleted_at = ? where path in (select value from json_each(?))`,
    nowMs(), keyList(keys),
  )
  return listMedia()
}

// Soft-delete a single media item (delegates to the batch path).
export async function deleteMedia(url: string): Promise<MediaItem[]> {
  return deleteMediaBatch([url])
}

// Restore trashed media back to the live library (clear deleted_at). Returns the
// authoritative live list.
export async function restoreMediaBatch(urls: string[]): Promise<MediaItem[]> {
  const keys = mediaKeys(urls)
  if (keys.length === 0) return listMedia()
  run(`update media set deleted_at = null where path in (select value from json_each(?))`, keyList(keys))
  return listMedia()
}

// Hard delete (irreversible, Trash UI only): remove DB rows first (source of
// truth), then best-effort delete blobs.
export async function purgeMediaBatch(urls: string[]): Promise<void> {
  const keys = mediaKeys(urls)
  if (keys.length === 0) return

  // Need thumb + variants for blob cleanup.
  const removed = all<MediaRow>(
    `select * from media where path in (select value from json_each(?))`, keyList(keys),
  )
  if (removed.length === 0) return

  run(`delete from media where path in (select value from json_each(?))`, keyList(keys))

  // Clean up EVERY blob (original + thumb + all variants). Variant paths attempted
  // for any raster regardless of the flag — deletes are idempotent, so nothing orphans.
  const paths = new Set<string>()
  for (const row of removed) {
    paths.add(row.path)
    if (row.thumb && row.thumb !== row.path) paths.add(row.thumb)
    if (/\.(jpe?g|png)$/i.test(row.path)) {
      const stem = row.path.replace(/\.[^.]+$/, '')
      paths.add(`${stem}-thumb.webp`)
      for (const w of SIZES) { paths.add(`${stem}-${w}.webp`); paths.add(`${stem}-${w}.avif`) }
    }
  }
  await Promise.all([...paths].map((p) => deleteByPathname(p).catch(() => {})))
}

// Trashed media (most-recently-deleted first) for the Trash view.
export async function getTrashedMedia(): Promise<MediaItem[]> {
  try {
    return all<MediaRow>(
      `select * from media where deleted_at is not null order by deleted_at desc`,
    ).map(rowToItem)
  } catch (error) {
    console.error(`[ERROR] media.getTrashedMedia: ${(error as Error).message}`)
    return []
  }
}

// Permanently remove EVERY trashed media item (empty the media Trash). Returns the count.
export async function emptyMediaTrash(): Promise<number> {
  const trashed = await getTrashedMedia()
  if (trashed.length === 0) return 0
  await purgeMediaBatch(trashed.map((m) => m.url))
  return trashed.length
}

// Owner-only diagnostic: report what a delete of `url` would match in the DB.
export async function debugDelete(url: string): Promise<{
  manifestCount: number
  targetKey: string | null
  matched: number
  sampleStored: string[]
}> {
  const targetKey = mediaKey(url)
  return {
    manifestCount: one<{ n: number }>(`select count(*) n from media`)?.n ?? 0,
    targetKey,
    matched: targetKey
      ? (one<{ n: number }>(`select count(*) n from media where path = ?`, targetKey)?.n ?? 0)
      : 0,
    sampleStored: all<{ path: string }>(`select path from media limit 8`).map((m) => m.path),
  }
}
