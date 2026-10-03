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
  uploadFile, expandBlob, collapseBlob, deleteByPathname, listBlobs, bytesOf, type UploadBody,
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

/**
 * A site icon, by the name `uploadIcon` gives it: `<kind>-<Date.now()>.<ext>`. `icon-` is what an
 * upload with no kind becomes (`POST /api/files/upload`). Icons are blobs, not rows — until one is
 * deleted, when it gets a trashed row like any file so the Trash can give it back (issue #69).
 */
const SITE_ICON = /^files\/(?:favicon|app-icon|avatar|icon)-\d{10,}\.(?:ico|png|jpe?g|svg|gif|webp)$/
const isSiteIcon = (key: string): boolean => SITE_ICON.test(key)

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
  files: { filename: string; body: UploadBody; contentType: string }[],
): Promise<FileItem[]> {
  const taken = await takenFilePaths()
  const rows: FileRow[] = []
  for (const f of files) {
    // One at a time, each let go before the next is read (`UploadBody`, media/blob.ts).
    const body = await bytesOf(f.body)
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
        await uploadFile(path, body, f.contentType || 'application/octet-stream', { exclusive: true })
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST' && attempt < 50) continue
        throw error
      }
    }
    rows.push({
      url: path,
      filename: f.filename,
      size: body.byteLength,
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
    .filter((r) => /^files\//.test(r.url) && !isSiteIcon(r.url))
  if (rows.length === 0) return []
  insertRows(rows)
  return rows.map(rowToItem)
}

// Store-relative `files/...` pathname from any URL form (host-independent).
function fileKey(s: string): string | null {
  return s.match(/files\/[^?#"')\s]+/)?.[0] ?? null
}

// The `files/...` keys among some urls, once each.
function deletableKeys(urls: string[]): string[] {
  return [...new Set(urls.map(fileKey).filter((k): k is string => k !== null))]
}

/** The keys among these that have a row in `files`, live or trashed. */
function keysWithRows(keys: string[]): Set<string> {
  if (keys.length === 0) return new Set()
  return new Set(all<{ url: string }>(`select url from files where url in (select value from json_each(?))`, keyList(keys)).map((r) => r.url))
}

/** The site icons Settings points at right now: the favicon, the app icon, the author's portrait. */
export async function siteIconsInUse(): Promise<Set<string>> {
  // Imported here, not at the top: `content/settings-save.ts` imports this module for `renderLogo`.
  const { getSettings } = await import('@/content/settings')
  const s = await getSettings()
  return new Set([s.faviconUrl, s.appIconUrl, s.author?.avatarUrl ?? ''].map((u) => fileKey(u ?? '')).filter((k): k is string => k !== null))
}

/**
 * Which of these urls are site icons Settings still uses, so cannot be deleted from the library.
 * ⚠️ ISSUE #69: a delete used to drop every icon silently and still answer success, and the page
 * then removed the rows until the next load put them back. A refusal is now said.
 */
export async function iconsInUseAmong(urls: string[]): Promise<string[]> {
  const inUse = await siteIconsInUse()
  return deletableKeys(urls).filter((k) => isSiteIcon(k) && inUse.has(k))
}

/** An icon nothing uses, into the Trash: a trashed row, so it lists, restores and purges as a file. */
async function trashSiteIcons(keys: string[]): Promise<void> {
  const inUse = await siteIconsInUse()
  const sizes = new Map((await listBlobs('files')).map((b) => [b.pathname, b.size]))
  const now = nowMs()
  for (const key of keys) {
    const size = sizes.get(key)
    // In use, or gone from the store already: nothing to trash.
    if (inUse.has(key) || size === undefined) continue
    const ext = key.split('.').pop()?.toLowerCase() ?? ''
    run(
      `insert into files (url, filename, size, content_type, uploaded_at, deleted_at) values (?, ?, ?, ?, ?, ?)
       on conflict(url) do update set deleted_at = excluded.deleted_at`,
      key, key.replace(/^files\//, ''), size, ICON_EXT[ext] ?? 'application/octet-stream',
      Number(key.match(/-(\d{10,})\./)?.[1] ?? now), now,
    )
  }
}

// Soft-delete library files (set deleted_at), keeping the blob. A site icon nothing uses goes to
// the Trash the same way; one Settings uses is left alone (`iconsInUseAmong` says which).
export async function deleteFilesBatch(urls: string[]): Promise<FileItem[]> {
  const keys = deletableKeys(urls)
  if (keys.length === 0) return listFiles()
  const rows = keysWithRows(keys)
  const icons = keys.filter((k) => isSiteIcon(k) && !rows.has(k))
  run(
    `update files set deleted_at = ? where url in (select value from json_each(?))`,
    nowMs(), keyList(keys.filter((k) => rows.has(k))),
  )
  if (icons.length) await trashSiteIcons(icons)
  return listFiles()
}

// Soft-delete a single library file (delegates to the batch path).
export async function deleteFile(url: string): Promise<FileItem[]> {
  return deleteFilesBatch([url])
}

// Restore trashed files back to the live library (clear deleted_at).
// A restored site icon goes back to being a blob with no row, so it lists under Site icons again.
export async function restoreFilesBatch(urls: string[]): Promise<FileItem[]> {
  const keys = deletableKeys(urls)
  if (keys.length === 0) return listFiles()
  const icons = keys.filter(isSiteIcon)
  const files = keys.filter((k) => !isSiteIcon(k))
  run(`update files set deleted_at = null where url in (select value from json_each(?))`, keyList(files))
  run(`delete from files where deleted_at is not null and url in (select value from json_each(?))`, keyList(icons))
  return listFiles()
}

// Hard delete (Trash UI only): row delete first, then best-effort blob cleanup.
export async function purgeFilesBatch(urls: string[]): Promise<void> {
  // Only trashed rows, and only their bytes: see `purgePost`.
  const trashed = all<{ url: string }>(
    `select url from files where url in (select value from json_each(?)) and deleted_at is not null`, keyList(deletableKeys(urls)),
  ).map((r) => r.url)
  if (trashed.length === 0) return
  run(`delete from files where url in (select value from json_each(?))`, keyList(trashed))
  await Promise.all(trashed.map((k) => deleteByPathname(k).catch(() => {})))
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

// Site icons (favicon, app icon, author portrait) from Settings: under files/ but not rows, so the
// Files tab lists them separately, each saying whether Settings still uses it. Newest first.
const ICON_EXT: Record<string, string> = {
  ico: 'image/x-icon', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml',
  gif: 'image/gif', webp: 'image/webp',
}
export async function getSiteIcons(): Promise<FileItem[]> {
  try {
    // `files/` only. The icons have always lived there, and walking the whole store to find two
    // of them cost the library screen 84.8 ms at 5,000 files against 12.9 at 100 (2026-09-19):
    // a price that grew with every picture uploaded, on a screen that shows none of them.
    const blobs = (await listBlobs('files')).filter((b) => isSiteIcon(b.pathname))
    // A trashed icon has a row and lists in the Trash, not here.
    const rows = keysWithRows(blobs.map((b) => b.pathname))
    const inUse = await siteIconsInUse()
    return blobs
      .filter((b) => !rows.has(b.pathname))
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
          inUse: inUse.has(b.pathname),
        }
      })
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
  } catch (error) {
    console.error(`[ERROR] files.getSiteIcons: ${(error as Error).message}`)
    return []
  }
}
