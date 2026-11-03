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
// Two things a zip may hold that the package does not, both of them what Finder and Explorer make
// by default (measured 2026-11-03): what the operating system adds by itself (`os-litter.ts`),
// which is LEFT OUT, never inflated and never stored, its declared size still counted against the
// package's ceiling; and one folder around the whole package, which is READ FROM INSIDE when it is
// the only thing at the top and holds `theme.json`. Every path check runs on the path as it is
// after that folder is taken off, so the folder can never carry a `..` or a rooted name past them.
// Both are said in the result (`skipped`, `folder`), so nothing is left out without a word.
//
// Pure apart from `node:zlib` and `node:crypto`, which both runtimes have, so the install route
// runs the same code on Bun and in a Worker.

import { createHash } from 'node:crypto'
import { listZip, unzip, ZipError } from '@/import/unzip'
import { checkThemeCss } from '@/theme/check-css'
import { checkThemeFiles, type ThemeFileEntry } from '@/theme/check-files'
import { checkThemeManifest, type ManifestOptions } from '@/theme/check-manifest'
import { decodeThemeText } from '@/theme/file-content'
import { isOsLitterPath } from '@/theme/os-litter'
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

/**
 * What was read around the package, on either answer: the entries left out as the operating
 * system's (`skipped`, in archive order), and the one folder the package was read from inside.
 */
export type PackageReading = { skipped?: string[]; folder?: string }

export type PackageResult = ({ ok: true; pkg: ThemePackage } | { ok: false; violations: Violation[] }) & PackageReading

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
/**
 * Records a zip may hold in all, the operating system's included: Finder writes a `._` copy of
 * every file and a record for every folder under `__MACOSX/`, so up to twice the package and its
 * folders again. Past this the zip is refused before anything is judged.
 */
const MAX_LISTED = MAX_RECORDS * 3

/** A folder name that, taken off the front of every path, can only ever have been a folder name. */
const PLAIN_FOLDER = /^(?!\.{1,2}$)[^\\/:\0-\x1f\x7f]{1,200}$/

/**
 * The one folder every entry sits in, when that folder holds `theme.json` itself; null otherwise.
 * Its name is thrown away, so it is only held to being one plain segment; what is left of each
 * path after it is judged in full by `checkThemeFiles`, as any path is.
 */
function wrappingFolder(names: readonly string[]): string | null {
  const top = names[0]?.split('/')[0]
  if (top === undefined || !PLAIN_FOLDER.test(top)) return null
  if (!names.every((n) => n.startsWith(`${top}/`))) return null
  return names.includes(`${top}/theme.json`) ? top : null
}

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
  if (listing.length > MAX_LISTED) return { ok: false, violations: [refusal('A3', '', String(listing.length))] }
  const litter = listing.filter((e) => isOsLitterPath(e.name))
  const kept = listing.filter((e) => !isOsLitterPath(e.name))
  const folder = wrappingFolder(kept.map((e) => e.name))
  const reading: PackageReading = {
    ...(litter.some((e) => !e.name.endsWith('/')) ? { skipped: litter.filter((e) => !e.name.endsWith('/')).map((e) => subjectOf(e.name)) } : {}),
    ...(folder !== null ? { folder: subjectOf(folder) } : {}),
  }
  const refused = (violations: Violation[]): PackageResult => ({ ok: false, violations, ...reading })
  if (kept.length > MAX_RECORDS) return refused([refusal('A3', '', String(kept.length))])
  /** The path the package means: with the wrapping folder taken off, before any check reads it. */
  const inside = (name: string): string => (folder === null ? name : name.slice(folder.length + 1))
  const declared: ThemeFileEntry[] = kept
    .filter((e) => folder === null || e.name !== `${folder}/`)
    .map((e) => ({ path: inside(e.name), size: e.size, isSymlink: e.isSymlink }))
  // Every entry here comes without bytes, which `checkThemeFiles` reports for each; those findings
  // are the only ones this pass expects, and the bytes are judged in the pass after inflating.
  const early = checkThemeFiles(declared).filter((v) => !(v.rule === 'A3' && v.subject === 'no bytes'))
  // What is left out still weighs: its declared size counts against the package's ceiling.
  const declaredTotal = listing.reduce((n, e) => n + (Number.isSafeInteger(e.size) && e.size > 0 ? e.size : 0), 0)
  if (declaredTotal > THEME_LIMITS.totalBytes && !early.some((v) => v.rule === 'A5' && v.file === '')) {
    early.push(refusal('A5', '', String(declaredTotal)))
  }
  if (early.length > 0) return refused(early)

  // 2. Inflated, never past one image per entry or the package's total, whatever is declared.
  let inflated: Awaited<ReturnType<typeof unzip>>
  try {
    // The operating system's entries are never decompressed: `unzip` asks before it inflates.
    inflated = await unzip(zip, (name) => !isOsLitterPath(name), THEME_LIMITS.imageBytes, THEME_LIMITS.totalBytes)
  } catch (error) {
    return refused([zipFault(error)])
  }
  const listed = kept.filter((e) => !e.name.endsWith('/'))
  const violations: Violation[] = []
  const entries: ThemeFileEntry[] = inflated.map((e, i) => {
    const said = listed[i]
    // A file that came out a different size from the one its record states is a lying record:
    // the checksum matched what was stored, the directory did not.
    if (said?.name !== e.name || said.size !== e.bytes.length) violations.push(refusal('A5', inside(e.name), String(e.bytes.length)))
    return { path: inside(e.name), size: e.bytes.length, isSymlink: said?.isSymlink, bytes: e.bytes }
  })
  violations.push(...checkThemeFiles(entries))
  if (violations.length > 0) return refused(violations)

  // 3. theme.json, then theme.css, both through the one decoder the checker trusts.
  const byPath = new Map(entries.map((e) => [e.path, e.bytes!]))
  const packageFiles: ReadonlySet<string> = new Set(byPath.keys())
  const manifestText = decodeThemeText(byPath.get('theme.json')!, 'theme.json')
  const cssText = decodeThemeText(byPath.get('theme.css')!, 'theme.css')
  // checkThemeFiles already refused text that does not decode; these are for the type checker.
  if (typeof manifestText !== 'string') return refused([manifestText])
  if (typeof cssText !== 'string') return refused([cssText])
  let raw: unknown
  try {
    raw = JSON.parse(manifestText)
  } catch {
    return refused([refusal('A6', 'theme.json', 'not json')])
  }
  const manifest = checkThemeManifest(raw, { ...opts, packageFiles })
  const cssFindings = checkThemeCss(cssText, opts.contract, packageFiles)
  if (!manifest.ok || cssFindings.length > 0) {
    return refused([...(manifest.ok ? [] : manifest.violations), ...cssFindings])
  }

  const files = entries
    .map((e) => ({ path: e.path, size: e.bytes!.length, type: themeFileType(e.path), bytes: e.bytes! }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return { ok: true, pkg: { manifest: manifest.manifest, hash: packageHash(files), files }, ...reading }
}
