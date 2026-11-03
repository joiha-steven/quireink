// `bun run theme:check <dir|zip>`: the theme checker an author runs before installing (ADR 0072).
//
// A directory is zipped in memory with the engine's own writer and read by `readThemePackage`
// with the options the install route passes (`content/theme-package-options.ts`), so a pass
// here is a pass there. Nothing is written anywhere.
//
//   exit 0  accepted: one line with the theme id, version and file count
//   exit 1  refused: one line per finding, `rule · file:line:col · subject`, and under it the
//           admin's English sentence for the rule; then where each rule is explained, and a
//           hint when the zip's shape, not its theme, is what went wrong
//   exit 2  bad usage, or a path that cannot be read
//
// What is left out is said, never done in silence. A zip: the install itself leaves out what
// macOS and Windows add and reads a package from inside the one folder around it
// (`theme/read-package.ts`), and this prints what it did. A directory is judged as the zip
// commands in docs/themes.md would pack it: what the operating system added is left out (the
// same list, `theme/os-litter.ts`), and so is any other hidden name, with a warning, because those
// commands leave it out too but a zip that carries one is refused.
import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { packageOptions } from '@/content/theme-package-options'
import { ZipWriter } from '@/import/zip-write'
import en from '@/locales/admin/en'
import { readThemePackage, THEME_LIMITS, type PackageResult, type ThemeManifest, type Violation } from '@/theme'
import { MISSING } from '@/theme/check-files'
import { isOsLitterName, isOsLitterPath } from '@/theme/os-litter'

export const USAGE = 'usage: bun run theme:check <theme directory | theme.zip>'

export type CheckOutcome = { code: 0 | 1 | 2; lines: string[] }

/** The outcome, and when the theme was accepted the zip that was judged and its manifest (`theme:preview` installs it). */
export type LoadedTheme = { outcome: CheckOutcome; accepted?: { zip: Uint8Array; manifest: ThemeManifest } }

type Walked = { files: { rel: string; size: number }[]; dirs: string[]; violations: Violation[]; litter: string[]; hidden: string[] }

/** A name the documented zip commands leave out of a folder: the operating system's, or hidden. */
export const leftOutOfFolder = (name: string): boolean => isOsLitterName(name) || name.startsWith('.')

const refusal = (rule: Violation['rule'], file: string, subject: string): Violation => ({ rule, file, line: 0, col: 0, subject })

/** Records the installer reads before it inflates anything (`read-package.ts`: files plus `fonts/` and `images/`). */
const MAX_RECORDS = THEME_LIMITS.files + 2

/**
 * What a directory holds, judged on what `zip -r` of its CONTENTS would declare, and never read
 * into memory: sizes come from `lstat`, links are refused rather than followed (a zip keeps the
 * link and the installer refuses it), and the walk stops at the record ceiling so a wrong
 * directory such as one holding `node_modules` answers at once.
 */
function walk(root: string): Walked {
  const out: Walked = { files: [], dirs: [], violations: [], litter: [], hidden: [] }
  let total = 0
  const visit = (prefix: string): boolean => {
    for (const name of readdirSync(join(root, prefix)).sort()) {
      const rel = prefix === '' ? name : `${prefix}/${name}`
      if (leftOutOfFolder(name)) {
        ;(isOsLitterName(name) ? out.litter : out.hidden).push(rel)
        continue
      }
      if (out.files.length + out.dirs.length >= MAX_RECORDS) {
        out.violations.push(refusal('A3', '', `more than ${MAX_RECORDS} entries`))
        return false
      }
      const st = lstatSync(join(root, rel))
      if (st.isSymbolicLink()) out.violations.push(refusal('A3', rel, rel))
      else if (st.isDirectory()) {
        out.dirs.push(rel)
        if (!visit(rel)) return false
      } else {
        out.files.push({ rel, size: st.size })
        total += st.size
        if (st.size > THEME_LIMITS.imageBytes) out.violations.push(refusal('A5', rel, String(st.size)))
      }
    }
    return true
  }
  if (visit('') && total > THEME_LIMITS.totalBytes) out.violations.push(refusal('A5', '', String(total)))
  return out
}

/** The directory as the zip the installer reads, entries deflated as `zip` would. Directories are records too. */
export function zipDirectory(root: string, walked: Walked): Uint8Array {
  const chunks: Uint8Array[] = []
  const zip = new ZipWriter({ write: (bytes) => void chunks.push(Uint8Array.from(bytes)) })
  for (const d of walked.dirs) zip.addBytes(`${d}/`, new Uint8Array(0))
  for (const f of walked.files) zip.addBytes(f.rel, readFileSync(join(root, f.rel)))
  zip.finish()
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

const rules = en.themeRules as Record<string, string>

/** The admin's sentence for a finding: a missing required file has its own, as in the admin's list. */
function sentenceFor(v: Violation): string {
  if (v.rule === 'A3' && v.subject === MISSING) return rules.missing ?? rules.A3 ?? rules.other ?? ''
  return rules[v.rule] ?? rules.other ?? ''
}

const RULES_DOC = 'docs/themes-css-rules.md'

/** `C1` → `docs/themes-css-rules.md#c1-a-colour-is-written-into-the-sheet`, read from the page's own headings. */
export function ruleAnchors(doc = readRulesDoc()): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of doc.matchAll(/^## (([A-Z]\d)(?: to ([A-Z]\d))?:.*)$/gm)) {
    const slug = m[1]!.toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').replace(/ /g, '-')
    const first = m[2]!
    const last = m[3]
    if (last === undefined) out.set(first, `${RULES_DOC}#${slug}`)
    else {
      // `A3 to A6`: one heading for the package rules, each with its own section after it.
      const from = Number(first.slice(1))
      for (let n = from; n <= Number(last.slice(1)); n++) if (!out.has(`A${n}`)) out.set(`A${n}`, `${RULES_DOC}#${slug}`)
    }
  }
  return out
}

function readRulesDoc(): string {
  try {
    return readFileSync(join(dirname(import.meta.dir), RULES_DOC), 'utf8')
  } catch {
    return ''
  }
}

/** Where the guide says how to make the zip; a test holds the anchor and the step's words to the doc. */
export const ZIP_STEP = 'docs/themes.md#2-start, step 5 (Zip the theme folder)'

/**
 * One line for a zip whose shape is the problem, which no rule's sentence can say by itself:
 * `theme.json` further in than the one folder the install reads a package from inside.
 */
export function zipHints(names: readonly string[], result: PackageResult): string[] {
  if (result.ok || names.includes('theme.json') || result.folder !== undefined) return []
  const deeper = names.find((n) => n.endsWith('/theme.json') && !isOsLitterPath(n))
  return deeper === undefined ? [] : [`hint: theme.json is at "${deeper}". It must be at the top of the zip, or in one folder at the top (${ZIP_STEP}).`]
}

/** What the install did around the package, which it says rather than does in silence. */
function readingLines(result: PackageResult): string[] {
  const out: string[] = []
  if (result.folder !== undefined) out.push(`read from inside the folder "${result.folder}/", as the install does`)
  const n = result.skipped?.length ?? 0
  if (n > 0) out.push(`left out ${n} file${n === 1 ? '' : 's'} macOS or Windows add by themselves (__MACOSX/, .DS_Store, Thumbs.db, desktop.ini), as the install does`)
  return out
}

/** The names a zip declares, read from its central directory without inflating anything. */
function zipNames(zip: Uint8Array): string[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  let eocd = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return []
  const count = view.getUint16(eocd + 10, true)
  let at = view.getUint32(eocd + 16, true)
  const names: string[] = []
  const utf8 = new TextDecoder()
  for (let n = 0; n < count && at + 46 <= zip.length && view.getUint32(at, true) === 0x02014b50; n++) {
    const nameLen = view.getUint16(at + 28, true)
    const extraLen = view.getUint16(at + 30, true)
    const commentLen = view.getUint16(at + 32, true)
    names.push(utf8.decode(zip.subarray(at + 46, at + 46 + nameLen)))
    at += 46 + nameLen + extraLen + commentLen
  }
  return names
}

/** `C1 · theme.css:3:5 · color:red`, the shape the admin's refusal list uses. */
function findingLine(v: Violation): string {
  const place = v.line > 0 ? `${v.file}:${v.line}:${v.col}` : v.file
  return [v.rule, place, v.subject].filter((part) => part !== '').join(' · ')
}

export async function checkThemePath(arg: string | undefined): Promise<CheckOutcome> {
  return (await loadThemePath(arg)).outcome
}

export async function loadThemePath(arg: string | undefined): Promise<LoadedTheme> {
  if (arg === undefined || arg === '') return { outcome: { code: 2, lines: [USAGE] } }
  const path = resolve(arg)
  let zip: Uint8Array
  let early: Violation[] = []
  let walkedLeftOut: string[] = []
  let fromZip = false
  try {
    const st = statSync(path)
    if (st.isDirectory()) {
      const walked = walk(path)
      early = walked.violations
      walkedLeftOut = [
        ...(walked.litter.length > 0 ? [`left out what macOS or Windows add by themselves, as the zip commands in docs/themes.md do: ${walked.litter.join(', ')}`] : []),
        ...walked.hidden.map((h) => `warning: left out ${h}: the zip commands in docs/themes.md leave hidden files out, but a zip that carries one is refused (A3)`),
      ]
      zip = early.length > 0 ? new Uint8Array(0) : zipDirectory(path, walked)
    } else if (st.size > THEME_LIMITS.zipBytes) {
      early = [refusal('A5', '', String(st.size))]
      zip = new Uint8Array(0)
    } else {
      zip = new Uint8Array(readFileSync(path))
      fromZip = true
    }
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT'
    return { outcome: { code: 2, lines: [`theme:check: ${missing ? 'no such file or directory' : 'cannot read'}: ${arg}${missing ? '' : ` (${(error as Error).message})`}`, USAGE] } }
  }
  const result: PackageResult = early.length > 0 ? { ok: false, violations: early } : await readThemePackage(zip, packageOptions())
  const leftOut = [...walkedLeftOut, ...readingLines(result)]
  if (result.ok) {
    const { manifest, files } = result.pkg
    return { outcome: { code: 0, lines: [...leftOut, `ok · ${manifest.id} ${manifest.version} · ${files.length} files`] }, accepted: { zip, manifest } }
  }
  const hints = fromZip ? zipHints(zipNames(zip), result) : []
  const lines = [...leftOut, ...hints]
  lines.push(...result.violations.flatMap((v) => [findingLine(v), `    ${sentenceFor(v)}`]))
  const anchors = ruleAnchors()
  const explained = [...new Set(result.violations.map((v) => v.rule))].flatMap((r) => anchors.has(r) ? [`  ${r}  ${anchors.get(r)}`] : [])
  if (explained.length > 0) lines.push('Each rule, with a refused and a passing example:', ...explained)
  lines.push(`Refused: ${result.violations.length} finding${result.violations.length === 1 ? '' : 's'}. Nothing was installed.`)
  return { outcome: { code: 1, lines } }
}

if (import.meta.main) {
  const { code, lines } = await checkThemePath(process.argv[2])
  console[code === 0 ? 'log' : 'error'](lines.join('\n'))
  process.exit(code)
}
