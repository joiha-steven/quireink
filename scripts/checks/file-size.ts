// Holds the 400-line rule from CLAUDE.md. Prose rots, a red check does not.
//
// Locale dictionaries and type declarations are exempt: they are data and generated
// surface, and splitting them by line count would make them harder to read, not easier.
//
// It also WARNS from 95%, without failing. A hard limit with no approach lights turns into
// an obstacle at the worst possible moment: three files sat at 398 and 399 lines on
// 2026-08-02, so the next person to add two lines of anything to any of them would have had
// their change blocked by a check about a file they were not thinking about. Splitting is
// cheap when you choose the moment and expensive when the build chooses it for you.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MAX = 400
const WARN_AT = Math.floor(MAX * 0.95)
const ROOTS = ['src', 'scripts']

// `join` yields backslashes on Windows, which silently breaks every path pattern below.
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name).replaceAll('\\', '/')
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

const exempt = (p: string) => p.includes('/locales/') || p.endsWith('.d.ts')

const files = ROOTS.flatMap(walk).filter((p) => /\.(ts|tsx)$/.test(p))
const violations = files
  .filter((p) => !exempt(p))
  .map((p) => ({ p, n: readFileSync(p, 'utf8').split('\n').length }))
  .filter(({ n }) => n > MAX)

const skipped = files.filter(exempt).length
console.log(`  scanned ${files.length - skipped} file(s) (limit ${MAX} lines); exempt: ${skipped}`)

const near = files
  .filter((p) => !exempt(p))
  .map((p) => ({ p, n: readFileSync(p, 'utf8').split('\n').length }))
  .filter(({ n }) => n > WARN_AT && n <= MAX)
  .sort((a, b) => b.n - a.n)

if (near.length > 0) {
  console.log(`  ${near.length} file(s) within ${MAX - WARN_AT} lines of the limit:`)
  for (const { p, n } of near) console.log(`  · ${p}: ${n}`)
}

if (violations.length === 0) {
  console.log('✓ check:filesize: ok')
} else {
  console.log(`✗ check:filesize: ${violations.length} violation(s)`)
  for (const { p, n } of violations) console.log(`  - ${p}: ${n} lines`)
  process.exit(1)
}
