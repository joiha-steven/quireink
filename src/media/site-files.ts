// THE FILES THIS SITE WEARS: its icons, the logo it renders for the header, and the typeface
// the owner uploaded. Blobs under `files/`, and none of them is a row in the `files` table --
// which is exactly why they never appear in the Library's Files tab.
//
// Split out of `media/files.ts` on 2026-09-19, when sharing `fileKind` with the public download
// card (ADR 0058) put that file over its 400-line ceiling. The seam is not the line count: this
// is what the SITE puts on, and what is left there is what the OWNER attached. The two are read
// by different screens, changed at different times, and share only a storage prefix.
//
// Re-exported from `media/files.ts`, so no import site had to change.
// `files/` store prefix holds 3 things kept OUT of the media grid: site icons
// (favicon/app-icon), the custom font, and the general "Files" attachment library.
// Only the Files library has rows (`files` table); icons/font are blobs only, so they
// never show in the Files tab.

import { uploadFile, collapseBlob, readBlob } from '@/media/blob'
import { safeFetch } from '@/server/safe-fetch'
import { readCapped, uploadLimits } from '@/media/limits'

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
  const { maxFileBytes } = await uploadLimits()
  // ⚠ THE LOGO IS ALMOST ALWAYS ON THE STORE, and the store is not a URL this process can
  // fetch. `logoUrl` comes out of the media library as `/uploads/media/…`, which is
  // origin-relative, and `new URL()` inside the SSRF guard throws on it: `safeFetch` raised,
  // the catch returned null, and EVERY owner who picked a logo from their own library got
  // `logoRenderUrl: ''` and `logoEmailUrl: ''`. The header then served the untouched
  // original at whatever size it was uploaded, and the newsletter masthead fell back to
  // text. Silently, on every install, since the field existed. `finalize.ts` had already
  // met the same trap for image variants and reads the store directly; so does this.
  const storePath = collapseBlob(sourceUrl)
  const local = storePath !== sourceUrl || !/^https?:\/\//i.test(sourceUrl)
  let src: Buffer
  if (local) {
    const bytes = await readBlob(storePath).catch(() => null)
    if (!bytes || bytes.byteLength > maxFileBytes) return null
    if (!LOGO_EXT_RASTER.test(storePath)) return null // svg / gif / unknown: serve as-is
    src = bytes
  } else {
    let res: Response
    try {
      // SSRF guard: an absolute logoUrl is owner-supplied settings; block internal targets.
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
    const read = await readCapped(res, maxFileBytes)
    if ('tooLarge' in read) return null // caller serves the original untouched
    src = Buffer.from(read.body)
  }
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

