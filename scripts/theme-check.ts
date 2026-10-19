// `bun run theme:check <dir|zip>`: the theme checker an author runs before installing (ADR 0072).
//
// A directory is zipped in memory with the engine's own writer and read by `readThemePackage`
// with the options the install route passes (`content/theme-package-options.ts`), so a pass
// here is a pass there. Nothing is written anywhere.
//
//   exit 0  accepted: one line with the theme id, version and file count
//   exit 1  refused: one line per finding, `rule · file:line:col · subject`, and under it the
//           admin's English sentence for the rule
//   exit 2  bad usage, or a path that cannot be read
import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { packageOptions } from '@/content/theme-package-options'
import { ZipWriter } from '@/import/zip-write'
import en from '@/locales/admin/en'
import { readThemePackage, THEME_LIMITS, type PackageResult, type Violation } from '@/theme'

export const USAGE = 'usage: bun run theme:check <theme directory | theme.zip>'

export type CheckOutcome = { code: 0 | 1 | 2; lines: string[] }

type Walked = { files: { rel: string; size: number }[]; dirs: string[]; violations: Violation[] }

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
  const out: Walked = { files: [], dirs: [], violations: [] }
  let total = 0
  const visit = (prefix: string): boolean => {
    for (const name of readdirSync(join(root, prefix)).sort()) {
      const rel = prefix === '' ? name : `${prefix}/${name}`
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

/** `C1 · theme.css:3:5 · color:red`, the shape the admin's refusal list uses. */
function findingLine(v: Violation): string {
  const place = v.line > 0 ? `${v.file}:${v.line}:${v.col}` : v.file
  return [v.rule, place, v.subject].filter((part) => part !== '').join(' · ')
}

export async function checkThemePath(arg: string | undefined): Promise<CheckOutcome> {
  if (arg === undefined || arg === '') return { code: 2, lines: [USAGE] }
  const path = resolve(arg)
  let zip: Uint8Array
  let early: Violation[] = []
  try {
    const st = statSync(path)
    if (st.isDirectory()) {
      const walked = walk(path)
      early = walked.violations
      zip = early.length > 0 ? new Uint8Array(0) : zipDirectory(path, walked)
    } else if (st.size > THEME_LIMITS.zipBytes) {
      early = [refusal('A5', '', String(st.size))]
      zip = new Uint8Array(0)
    } else {
      zip = new Uint8Array(readFileSync(path))
    }
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT'
    return { code: 2, lines: [`theme:check: ${missing ? 'no such file or directory' : 'cannot read'}: ${arg}${missing ? '' : ` (${(error as Error).message})`}`, USAGE] }
  }
  const result: PackageResult = early.length > 0 ? { ok: false, violations: early } : await readThemePackage(zip, packageOptions())
  if (result.ok) {
    const { manifest, files } = result.pkg
    return { code: 0, lines: [`ok · ${manifest.id} ${manifest.version} · ${files.length} files`] }
  }
  const lines = result.violations.flatMap((v) => [findingLine(v), `    ${rules[v.rule] ?? rules.other}`])
  lines.push(`Refused: ${result.violations.length} finding${result.violations.length === 1 ? '' : 's'}. Nothing was installed.`)
  return { code: 1, lines }
}

if (import.meta.main) {
  const { code, lines } = await checkThemePath(process.argv[2])
  console[code === 0 ? 'log' : 'error'](lines.join('\n'))
  process.exit(code)
}
