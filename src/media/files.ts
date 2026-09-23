// THE OWNER'S ATTACHMENT LIBRARY: any file that is not a picture and not a video -- a PDF, a
// zip, a spreadsheet. Listed from the `files` table, stored verbatim with no thumbnails and no
// variants, and served by `web/uploads.ts` like any other blob.
//
// The site's OWN files -- its icons, its rendered logo, its uploaded typeface -- share the
// `files/` storage prefix and are not rows here, which is why they never appear in the Files
// tab. They live in `media/site-files.ts` and are re-exported below; see that file's header for
// the seam.

import type { FileItem } from '@/types'
import {
  uploadFile, expandBlob, collapseBlob, deleteByPathname, listBlobs,
} from '@/media/blob'
import { slugify } from '@/utils'
import { all, run, tx } from '@/store/query'
import { liveOnly, nowMs, toIso } from '@/store/db'

export {
  isAllowedIconType, uploadIcon, renderLogo, fontExt, isAllowedFontType, uploadFont,
} from '@/media/site-files'

// ----- General file library ("Files" tab) -------------------------------------
// Any attachment (PDF, zip, docx, audio…). Listed from the `files` table, stored
// verbatim (no thumbs/variants). Site icons under files/ are not rows → never listed here.

const ICON_PREFIXES = ['favicon-', 'app-icon-'] // managed in Settings, hidden here

type FileRow = {
  url: string
  filename: string
  size: number
  content_type: string
  uploaded_at: number
  deleted_at?: number | null
}

function rowToItem(row: FileRow): FileItem {
  return {
    url: expandBlob(row.url),
    filename: row.filename,
    size: Number(row.size),
    contentType: row.content_type,
    uploadedAt: toIso(row.uploaded_at),
    deletedAt: row.deleted_at == null ? undefined : toIso(row.deleted_at),
  }
}

// Insert a batch of rows in one transaction. `run` reuses the prepared statement across
// iterations, and the whole batch lands or none of it does.
function insertRows(rows: FileRow[]): void {
  tx(() => {
    for (const r of rows) {
      run(
        `insert into files (url, filename, size, content_type, uploaded_at)
         values ($url, $filename, $size, $contentType, $uploadedAt)`,
        { url: r.url, filename: r.filename, size: r.size, contentType: r.content_type, uploadedAt: r.uploaded_at },
      )
    }
  })
}

// A key list as ONE bound parameter. The alternative, `in (?, ?, ?)` with a generated
// placeholder run, is SQL string building, which this codebase does not do.
const keyList = (keys: string[]) => JSON.stringify(keys)

// Non-cached read, newest first (mutating helpers return authoritative state).
async function listFiles(): Promise<FileItem[]> {
  try {
    return all<FileRow>(
      `select * from files where ${liveOnly('files')} order by uploaded_at desc`,
    ).map(rowToItem)
  } catch (error) {
    console.error(`[ERROR] files.listFiles: ${(error as Error).message}`)
    return []
  }
}

// Library list, newest first. Fresh every request.
/**
 * A short, upper-case name for what a file IS: PDF, ZIP, EPUB.
 *
 * ⚠️ ONE COPY. The Library's row drew this from a private helper of its own, and the public
 * download card (ADR 0058) needs the same answer — two rules for "what kind of file is this"
 * is a blog whose own admin and own page disagree about an upload in front of the owner.
 *
 * The EXTENSION first, because it is what the author named the file and what the route serves
 * it as (`web/uploads.ts` reads the extension, never the stored content type). The MIME subtype
 * is the fallback for a name with no dot at all, clipped so a long vendor type cannot run off
 * the end of a badge.
 */
export function fileKind(f: Pick<FileItem, 'filename' | 'contentType'>): string {
  const dot = f.filename.lastIndexOf('.')
  if (dot >= 0 && dot < f.filename.length - 1) return f.filename.slice(dot + 1).toUpperCase()
  const sub = f.contentType.split('/')[1]
  return (sub || 'FILE').toUpperCase().slice(0, 5)
}

export async function getFiles(): Promise<FileItem[]> {
  return listFiles()
}

// All taken `files/` pathnames (rows ∪ store contents) so an upload never collides.
async function takenFilePaths(): Promise<Set<string>> {
  const set = new Set<string>()
  for (const r of all<{ url: string }>(`select url from files`)) set.add(collapseBlob(r.url))
  // Only `files/`, which is the only place the answer can be — the same walk the site icons
  // stopped paying for the whole picture library on every upload.
  for (const b of await listBlobs('files')) set.add(b.pathname)
  return set
}

// First free `files/{base}.{ext}`, adding -2, -3… only on collision.
function freeFilePath(base: string, ext: string, taken: Set<string>): string {
  const make = (n: number) => `files/${n === 1 ? base : `${base}-${n}`}${ext ? `.${ext}` : ''}`
  let n = 1
  while (taken.has(make(n))) n++
  const path = make(n)
  taken.add(path)
  return path
}

// Upload files to the store, then insert all rows at once. Any content type accepted.
export async function addFilesBatch(
  files: { filename: string; body: ArrayBuffer; contentType: string }[],
): Promise<FileItem[]> {
  const taken = await takenFilePaths()
  const rows: FileRow[] = []
  for (const f of files) {
    const dot = f.filename.lastIndexOf('.')
    const rawExt = dot >= 0 ? f.filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
    const base = slugify(dot >= 0 ? f.filename.slice(0, dot) : f.filename) || 'file'
    // Exclusive (O_EXCL) write so two concurrent same-name uploads can't overwrite each
    // other + collide on the PK insert (mirrors media.ts writeUniqueOriginal): the loser
    // gets EEXIST and takes the next free name.
    let path = ''
    for (let attempt = 0; ; attempt++) {
      path = freeFilePath(base, rawExt, taken)
      try {
        await uploadFile(path, f.body, f.contentType || 'application/octet-stream', { exclusive: true })
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST' && attempt < 50) continue
        throw error
      }
    }
    rows.push({
      url: path,
      filename: f.filename,
      size: f.body.byteLength,
      content_type: f.contentType || 'application/octet-stream',
      uploaded_at: nowMs(),
    })
  }
  insertRows(rows)
  return rows.map(rowToItem)
}

// Register files the BROWSER uploaded straight to the store (bypasses the request body
// limit). Binary already stored; we just insert the metadata row.
export async function registerFilesBatch(
  items: { url: string; filename: string; size: number; contentType: string }[],
): Promise<FileItem[]> {
  const rows: FileRow[] = items
    .map((i) => ({
      url: collapseBlob(i.url),
      filename: i.filename,
      size: i.size,
      content_type: i.contentType || 'application/octet-stream',
      uploaded_at: nowMs(),
    }))
    .filter((r) => /^files\//.test(r.url) && !ICON_PREFIXES.some((p) => r.url.startsWith(`files/${p}`)))
  if (rows.length === 0) return []
  insertRows(rows)
  return rows.map(rowToItem)
}

// Store-relative `files/...` pathname from any URL form (host-independent).
function fileKey(s: string): string | null {
  return s.match(/files\/[^?#"')\s]+/)?.[0] ?? null
}

// Deletable file keys (drops non-matches + site icons, which aren't rows).
function deletableKeys(urls: string[]): string[] {
  return [...new Set(urls.map(fileKey).filter((k): k is string => k !== null))]
    .filter((k) => !ICON_PREFIXES.some((p) => k.startsWith(`files/${p}`)))
}

// Soft-delete library files (set deleted_at), keeping the blob. Icons skipped.
export async function deleteFilesBatch(urls: string[]): Promise<FileItem[]> {
  const keys = deletableKeys(urls)
  if (keys.length === 0) return listFiles()
  run(
    `update files set deleted_at = ? where url in (select value from json_each(?))`,
    nowMs(), keyList(keys),
  )
  return listFiles()
}

// Soft-delete a single library file (delegates to the batch path).
export async function deleteFile(url: string): Promise<FileItem[]> {
  return deleteFilesBatch([url])
}

// Restore trashed files back to the live library (clear deleted_at).
export async function restoreFilesBatch(urls: string[]): Promise<FileItem[]> {
  const keys = deletableKeys(urls)
  if (keys.length === 0) return listFiles()
  run(`update files set deleted_at = null where url in (select value from json_each(?))`, keyList(keys))
  return listFiles()
}

// Hard delete (Trash UI only): row delete first, then best-effort blob cleanup.
export async function purgeFilesBatch(urls: string[]): Promise<void> {
  const keys = deletableKeys(urls)
  if (keys.length === 0) return
  run(`delete from files where url in (select value from json_each(?))`, keyList(keys))
  await Promise.all(keys.map((k) => deleteByPathname(k).catch(() => {})))
}

// Trashed library files (most-recently-deleted first) for the Trash view.
export async function getTrashedFiles(): Promise<FileItem[]> {
  try {
    return all<FileRow>(
      `select * from files where deleted_at is not null order by deleted_at desc`,
    ).map(rowToItem)
  } catch (error) {
    console.error(`[ERROR] files.getTrashedFiles: ${(error as Error).message}`)
    return []
  }
}

// Permanently remove EVERY trashed file (empty the files Trash). Returns the count.
export async function emptyFilesTrash(): Promise<number> {
  const trashed = await getTrashedFiles()
  if (trashed.length === 0) return 0
  await purgeFilesBatch(trashed.map((f) => f.url))
  return trashed.length
}

// Site icons (favicon/app-icon) from Settings: under files/ but NOT rows, so the
// Files tab lists them separately (read-only). Newest first.
const ICON_EXT: Record<string, string> = {
  ico: 'image/x-icon', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml',
  gif: 'image/gif', webp: 'image/webp',
}
export async function getSiteIcons(): Promise<FileItem[]> {
  try {
    // `files/` only. The icons have always lived there, and walking the whole store to find two
    // of them cost the library screen 84.8 ms at 5,000 files against 12.9 at 100 (2026-09-19):
    // a price that grew with every picture uploaded, on a screen that shows none of them.
    const blobs = await listBlobs('files')
    return blobs
      .filter((b) => ICON_PREFIXES.some((p) => b.pathname.startsWith(`files/${p}`)))
      .map((b) => {
        const name = b.pathname.replace(/^files\//, '')
        const ext = b.pathname.split('.').pop()?.toLowerCase() ?? ''
        // Names are `<kind>-<Date.now()>.<ext>` → recover upload time from the stamp.
        const ms = Number(name.match(/-(\d{10,})\./)?.[1] ?? 0)
        return {
          url: expandBlob(b.pathname),
          filename: name,
          size: b.size,
          contentType: ICON_EXT[ext] ?? 'application/octet-stream',
          uploadedAt: new Date(ms).toISOString(),
        }
      })
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
  } catch (error) {
    console.error(`[ERROR] files.getSiteIcons: ${(error as Error).message}`)
    return []
  }
}
