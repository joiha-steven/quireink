// The package as a list of entries (A3 paths and content types, A4 SVG content, A5 sizes).
//
// The caller reads the zip; this decides whether what it holds may be stored. It never
// touches a file system, so it runs the same on Bun and on Workers, and it trusts nothing the
// entry claims: a declared size smaller than the bytes it came with is measured by the bytes,
// and an entry without bytes is refused, because the installer always has them.

import { isSafePackagePath } from '@/theme/package-path'
import { subjectOf } from '@/theme/findings'
import { svgFinding } from '@/theme/check-svg'
import { decodeThemeText, hasSignature, hexHead, webpSize } from '@/theme/file-content'
import { THEME_LIMITS, type ThemeRule, type Violation } from '@/theme/types'

export type ThemeFileEntry = { path: string; size: number; isSymlink?: boolean; bytes?: Uint8Array }

const REQUIRED = ['theme.json', 'theme.css', 'screenshot.webp'] as const
/** The admin draws the preview at this size; a screenshot of any other size is stretched. */
export const SCREENSHOT_SIZE = { width: 1200, height: 900 } as const
const IMAGE_EXT = /\.(webp|png|jpg|jpeg|avif|svg)$/

type Kind = 'manifest' | 'css' | 'screenshot' | 'font' | 'image' | 'svg'

/** Where a path may sit in a package, by shape; null when it may not sit there at all. */
function kindOf(path: string): Kind | null {
  if (path === 'theme.json') return 'manifest'
  if (path === 'theme.css') return 'css'
  if (path === 'screenshot.webp') return 'screenshot'
  if (!isSafePackagePath(path)) return null
  const parts = path.split('/')
  if (parts.length !== 2) return null
  const [dir, name] = parts as [string, string]
  if (dir === 'fonts' && name.endsWith('.woff2')) return 'font'
  if (dir === 'images' && IMAGE_EXT.test(name)) return name.endsWith('.svg') ? 'svg' : 'image'
  return null
}

const LIMIT: Record<Kind, number> = {
  // theme.json has no limit in the standard; the stylesheet's is generous for a manifest.
  manifest: THEME_LIMITS.cssBytes,
  css: THEME_LIMITS.cssBytes,
  screenshot: THEME_LIMITS.imageBytes,
  font: THEME_LIMITS.fontBytes,
  image: THEME_LIMITS.imageBytes,
  svg: THEME_LIMITS.imageBytes,
}

export function checkThemeFiles(entries: readonly ThemeFileEntry[]): Violation[] {
  const out: Violation[] = []
  const fail = (rule: ThemeRule, file: string, subject: string) =>
    out.push({ rule, file: subjectOf(file), line: 0, col: 0, subject: subjectOf(subject) })

  const seen = new Set<string>()
  let files = 0
  let total = 0
  for (const e of entries) {
    const path = e.path
    if (e.isSymlink) fail('A3', path, path)
    // A directory entry is not stored, but its name still has to be harmless.
    if (path.endsWith('/')) {
      if (!isSafePackagePath(path.slice(0, -1))) fail('A3', path, path)
      continue
    }
    files += 1
    // Two entries whose names differ only in case land on one file on Windows and macOS; two
    // with the same name are the classic split between the copy checked and the copy written.
    const folded = path.toLowerCase()
    if (seen.has(folded)) fail('A3', path, path)
    seen.add(folded)

    const kind = kindOf(path)
    if (kind === null) {
      fail('A3', path, path)
      continue
    }
    const size = Math.max(e.size, e.bytes?.length ?? 0)
    if (!Number.isSafeInteger(e.size) || e.size < 0 || size > LIMIT[kind]) fail('A5', path, String(size))
    total += Number.isFinite(size) ? size : 0
    if (e.bytes === undefined) {
      fail('A3', path, 'no bytes')
      continue
    }
    const finding = contentFinding(kind, path, e.bytes)
    if (finding !== null) fail(finding.rule, path, finding.subject)
  }
  if (files > THEME_LIMITS.files) fail('A3', '', String(files))
  if (total > THEME_LIMITS.totalBytes) fail('A5', '', String(total))
  for (const name of REQUIRED) {
    if (!entries.some((e) => e.path === name && !e.isSymlink)) fail('A3', name, name)
  }
  return out
}

/** What is wrong with a file's bytes for its kind, or null. */
function contentFinding(kind: Kind, path: string, bytes: Uint8Array): { rule: ThemeRule; subject: string } | null {
  if (kind === 'svg') {
    const finding = svgFinding(bytes)
    return finding === null ? null : { rule: 'A4', subject: finding }
  }
  if (kind === 'css' || kind === 'manifest') {
    const text = decodeThemeText(bytes, path)
    return typeof text === 'string' ? null : { rule: text.rule, subject: text.subject }
  }
  // A3, not A4: the name says one type and the bytes are another, which is a file the
  // standard does not list. The subject is the first bytes, the text that gave it away.
  if (!hasSignature(path, bytes)) return { rule: 'A3', subject: hexHead(bytes) }
  if (kind === 'screenshot') {
    const size = webpSize(bytes)
    if (size === null) return { rule: 'A3', subject: hexHead(bytes) }
    if (size.width !== SCREENSHOT_SIZE.width || size.height !== SCREENSHOT_SIZE.height) {
      return { rule: 'A3', subject: `${size.width}x${size.height}` }
    }
  }
  return null
}

export { svgFinding }
