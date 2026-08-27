// `files/` store prefix holds 3 things kept OUT of the media grid: site icons
// (favicon/app-icon), the custom font, and the general "Files" attachment library.
// Only the Files library has rows (`files` table); icons/font are blobs only, so they
// never show in the Files tab.

import type { FileItem } from '@/types'
import {
  uploadFile, expandBlob, collapseBlob, deleteByPathname, listBlobs,
} from '@/media/blob'
import { slugify } from '@/utils'
import { safeFetch } from '@/server/safe-fetch'
import { readCapped, uploadLimits } from '@/media/limits'
import { all, run, tx } from '@/store/query'
import { liveOnly, nowMs, toIso } from '@/store/db'

// contentType -> extension. `.ico` arrives as x-icon / vnd.microsoft.icon.
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
}

export function isAllowedIconType(contentType: string): boolean {
  return contentType in EXT
}

// Upload one icon, return its absolute URL. `kind` namespaces the name
// (favicon/app-icon); the timestamp gives a replaced icon a fresh URL (cache-bust).
export async function uploadIcon(kind: string, body: ArrayBuffer | Buffer, contentType: string): Promise<string> {
  const ext = EXT[contentType]
  if (!ext) throw new Error(`Unsupported icon type: ${contentType}`)
  const path = `files/${kind}-${Date.now()}.${ext}`
  return uploadFile(path, body, contentType)
}

// ----- Logo render (auto-sized for the header) --------------------------------
// From the owner's untouched source logo, generate ONE small WebP scaled to the
// header width @2x (retina), never upscaled. Lives at files/logo-*.webp (no row,
// no icon → hidden from grids); saveSettings deletes the prior one so exactly one
// exists. Vector/animated/undecodable → null (caller serves the original as-is).
//
// PLUS a PNG twin for EMAIL. Nothing about the web render suits an inbox: WebP is
// unrenderable in Outlook on Windows (the Word engine), and the untouched original is
// often WebP or SVG too — so without this the newsletter masthead silently falls back
// to plain text. PNG is the one raster every mail client has always understood.

const LOGO_RASTER = /^image\/(png|jpe?g|webp)$/
const LOGO_EXT_RASTER = /\.(png|jpe?g|jpg|webp)(?:$|[?#])/i

// Returns the derived WebP url + its displayed height at `width` px (reserves
// space → no CLS), or null when the source isn't a downscalable raster.
export async function renderLogo(
  sourceUrl: string,
  width: number,
): Promise<{ url: string; height: number; emailUrl: string } | null> {
  if (!sourceUrl) return null
  let res: Response
  try {
    // SSRF guard: logoUrl is owner-supplied settings; block internal targets.
    res = await safeFetch(sourceUrl)
  } catch {
    return null
  }
  if (!res.ok) return null
  const contentType = res.headers.get('content-type') ?? ''
  const isRaster = LOGO_RASTER.test(contentType) || (!contentType && LOGO_EXT_RASTER.test(sourceUrl))
  if (!isRaster) return null // svg / gif / unknown: serve original untouched
  // Capped WHILE reading, like every other byte path that starts with a URL somebody typed.
  // This one was reading the whole response into memory first and asking nothing, so a
  // logo address pointing at a large file was a way to make the process eat it — and the
  // reverse proxy cannot see a fetch this server made. The same cap the upload form uses.
  const { maxFileBytes } = await uploadLimits()
  const read = await readCapped(res, maxFileBytes)
  if ('tooLarge' in read) return null // caller serves the original untouched
  const src = Buffer.from(read.body)
  // PORT NOTE: sharp is imported here rather than at the top of the file. It is the only
  // sharp user reachable from `content/settings.ts`, which every request touches, so a
  // top-level import put it on the BOOT path — and `bun build --compile` bundles sharp's
  // JavaScript but not its native module, so the compiled binary refused to start at all.
  // Deferred, the same install serves every page and fails only when a logo is rendered.
  const { default: sharp } = await import('sharp')
  try {
    // @2x for retina; withoutEnlargement never upscales past the source.
    const out = await sharp(src, { failOn: 'none' })
      .rotate()
      .resize({ width: Math.round(width * 2), withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
    const meta = await sharp(out).metadata()
    const stamp = Date.now()
    const url = await uploadFile(`files/logo-${stamp}.webp`, out, 'image/webp')
    // Displayed height = CSS width × the rendered aspect ratio.
    const height = meta.width ? Math.round(width * (meta.height ?? 0) / meta.width) : 0
    // The email twin: same @2x box, PNG, alpha preserved so it sits on any background.
    let emailUrl = ''
    try {
      const png = await sharp(src, { failOn: 'none' })
        .rotate()
        .resize({ width: Math.round(width * 2), withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer()
      emailUrl = await uploadFile(`files/logo-${stamp}-mail.png`, png, 'image/png')
    } catch {
      // Best effort: a missing email twin costs the newsletter its logo, not the header.
    }
    return { url, height, emailUrl }
  } catch {
    return null // decode/encode failure: caller falls back to the original
  }
}

// ----- Custom font upload ------------------------------------------------------
// Owner typeface under files/ (no Files row). Returns the URL + a CSS family name
// derived from the filename.

const FONT_EXT = new Set(['woff2', 'woff', 'ttf', 'otf'])

export function fontExt(filename: string): string {
  return filename.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? ''
}
export function isAllowedFontType(filename: string): boolean {
  return FONT_EXT.has(fontExt(filename))
}

// Strip weight/style tokens so all weight slots share one family ("Inter-Bold" → "Inter").
const WEIGHT_TOKENS = /\b(thin|extralight|ultralight|light|regular|normal|book|text|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|variable|vf)\b/gi

export async function uploadFont(
  filename: string,
  weight: number,
  body: ArrayBuffer | Buffer,
  contentType: string,
): Promise<{ url: string; family: string; weight: number }> {
  const ext = fontExt(filename)
  if (!FONT_EXT.has(ext)) throw new Error(`Unsupported font type: ${ext}`)
  const base = filename.slice(0, filename.length - ext.length - 1)
  const family =
    base.replace(WEIGHT_TOKENS, ' ').replace(/[^A-Za-z0-9 _-]/g, ' ').replace(/[\s_-]+/g, ' ').trim().slice(0, 64) ||
    'Custom Font'
  const path = `files/font-${weight}-${Date.now()}.${ext}`
  const url = await uploadFile(path, body, contentType || 'font/' + (ext === 'ttf' ? 'ttf' : ext))
  return { url, family, weight }
}

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
export async function getFiles(): Promise<FileItem[]> {
  return listFiles()
}

// All taken `files/` pathnames (rows ∪ store contents) so an upload never collides.
async function takenFilePaths(): Promise<Set<string>> {
  const set = new Set<string>()
  for (const r of all<{ url: string }>(`select url from files`)) set.add(collapseBlob(r.url))
  for (const b of await listBlobs()) {
    if (b.pathname.startsWith('files/')) set.add(b.pathname)
  }
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
    const blobs = await listBlobs()
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
