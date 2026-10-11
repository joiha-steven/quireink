// A theme zip, read and judged (ADR 0072): the bytes as uploaded in, either the checked package
// or every reason it was refused out. Nothing here writes anywhere; the installer
// (`content/installed-themes.ts`) stores what this returns and nothing else.
//
// THE ORDER IS THE DEFENCE. The zip's directory is read first and judged on what it DECLARES
// (paths, count, sizes, links) before a single entry is inflated, so a package named `../x` or
// declaring 50 MB costs one read of its directory. Only then is it inflated, under a ceiling per
// entry and in total that zlib itself enforces, because a declared size is the archive's word and
// a bomb lies about it. Then the same checks again on the bytes that actually came out, then
// theme.json, then theme.css. `import/unzip.ts` does not refuse `..` or an absolute name: it is a
// reader, and this is where a theme's names are judged (`checkThemeFiles`, `package-path.ts`).
//
// Pure apart from `node:zlib` and `node:crypto`, which both runtimes have, so the install route
// runs the same code on Bun and in a Worker.

import { createHash } from 'node:crypto'
import { listZip, unzip, ZipError } from '@/import/unzip'
import { checkThemeCss } from '@/theme/check-css'
import { checkThemeFiles, type ThemeFileEntry } from '@/theme/check-files'
import { checkThemeManifest, type ManifestOptions } from '@/theme/check-manifest'
import { decodeThemeText } from '@/theme/file-content'
import { subjectOf } from '@/theme/findings'
import { THEME_LIMITS, type ThemeContract, type ThemeManifest, type Violation } from '@/theme/types'

/** One file of a checked package: where it goes, what it weighs, what it is served as. */
export type ThemePackageFile = { path: string; size: number; type: string; bytes: Uint8Array }

export type ThemePackage = {
  manifest: ThemeManifest
  /** SHA-256 of the files (`packageHash`), hex: the blob prefix and the URL segment. */
  hash: string
  /** Sorted by path. */
  files: ThemePackageFile[]
}

export type PackageOptions = Omit<ManifestOptions, 'packageFiles'> & { contract: ThemeContract }

export type PackageResult = { ok: true; pkg: ThemePackage } | { ok: false; violations: Violation[] }

/**
 * The content type each file is served with, by extension. A closed list: `checkThemeFiles`
 * refuses every other name, so nothing reaches here without one.
 */
const TYPES: Record<string, string> = {
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  woff2: 'font/woff2',
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}
export const themeFileType = (path: string): string =>
  TYPES[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream'

/**
 * Directory records a package may hold: every file it may have, plus `fonts/` and `images/`
 * as directory entries, which is all `zip -r` adds. Counted before anything else is read.
 */
const MAX_RECORDS = THEME_LIMITS.files + 2

/** One refusal with no place in a file. */
const refusal = (rule: Violation['rule'], file: string, subject: string): Violation =>
  ({ rule, file: subjectOf(file), line: 0, col: 0, subject: subjectOf(subject) })

/**
 * The package's identity: SHA-256 over every file in path order, each as its path, its length
 * and its bytes. Of the FILES and not of the zip, so the same theme zipped again (new
 * timestamps, another compressor) is the same hash and installing it twice does nothing.
 */
export function packageHash(files: readonly { path: string; bytes: Uint8Array }[]): string {
  const h = createHash('sha256')
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    h.update(`${f.path}\0${f.bytes.length}\0`)
    h.update(f.bytes)
  }
  return h.digest('hex')
}

/** A fault reading the container, as the refusal the owner is shown. */
function zipFault(error: unknown): Violation {
  if (!(error instanceof ZipError)) throw error
  return error.code === 'entry_too_large' ? refusal('A5', '', 'expands past the limit') : refusal('A3', '', error.code)
}

export async function readThemePackage(zip: Uint8Array, opts: PackageOptions): Promise<PackageResult> {
  if (zip.length > THEME_LIMITS.zipBytes) return { ok: false, violations: [refusal('A5', '', String(zip.length))] }

  // 1. The directory alone, judged on what it declares.
  let listing: Awaited<ReturnType<typeof listZip>>
  try {
    listing = await listZip(zip)
  } catch (error) {
    return { ok: false, violations: [zipFault(error)] }
  }
  if (listing.length > MAX_RECORDS) return { ok: false, violations: [refusal('A3', '', String(listing.length))] }
  const declared: ThemeFileEntry[] = listing.map((e) => ({ path: e.name, size: e.size, isSymlink: e.isSymlink }))
  // Every entry here comes without bytes, which `checkThemeFiles` reports for each; those findings
  // are the only ones this pass expects, and the bytes are judged in the pass after inflating.
  const early = checkThemeFiles(declared).filter((v) => !(v.rule === 'A3' && v.subject === 'no bytes'))
  if (early.length > 0) return { ok: false, violations: early }

  // 2. Inflated, never past one image per entry or the package's total, whatever is declared.
  let inflated: Awaited<ReturnType<typeof unzip>>
  try {
    inflated = await unzip(zip, () => true, THEME_LIMITS.imageBytes, THEME_LIMITS.totalBytes)
  } catch (error) {
    return { ok: false, violations: [zipFault(error)] }
  }
  const listed = listing.filter((e) => !e.name.endsWith('/'))
  const violations: Violation[] = []
  const entries: ThemeFileEntry[] = inflated.map((e, i) => {
    const said = listed[i]
    // A file that came out a different size from the one its record states is a lying record:
    // the checksum matched what was stored, the directory did not.
    if (said?.name !== e.name || said.size !== e.bytes.length) violations.push(refusal('A5', e.name, String(e.bytes.length)))
    return { path: e.name, size: e.bytes.length, isSymlink: said?.isSymlink, bytes: e.bytes }
  })
  violations.push(...checkThemeFiles(entries))
  if (violations.length > 0) return { ok: false, violations }

  // 3. theme.json, then theme.css, both through the one decoder the checker trusts.
  const byPath = new Map(entries.map((e) => [e.path, e.bytes!]))
  const packageFiles: ReadonlySet<string> = new Set(byPath.keys())
  const manifestText = decodeThemeText(byPath.get('theme.json')!, 'theme.json')
  const cssText = decodeThemeText(byPath.get('theme.css')!, 'theme.css')
  // checkThemeFiles already refused text that does not decode; these are for the type checker.
  if (typeof manifestText !== 'string') return { ok: false, violations: [manifestText] }
  if (typeof cssText !== 'string') return { ok: false, violations: [cssText] }
  let raw: unknown
  try {
    raw = JSON.parse(manifestText)
  } catch {
    return { ok: false, violations: [refusal('A6', 'theme.json', 'not json')] }
  }
  const manifest = checkThemeManifest(raw, { ...opts, packageFiles })
  const cssFindings = checkThemeCss(cssText, opts.contract, packageFiles)
  if (!manifest.ok || cssFindings.length > 0) {
    return { ok: false, violations: [...(manifest.ok ? [] : manifest.violations), ...cssFindings] }
  }

  const files = entries
    .map((e) => ({ path: e.path, size: e.bytes!.length, type: themeFileType(e.path), bytes: e.bytes! }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return { ok: true, pkg: { manifest: manifest.manifest, hash: packageHash(files), files } }
}
