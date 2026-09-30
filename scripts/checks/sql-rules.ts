// Two hard rules about SQL in TypeScript, checked rather than remembered (2026-09-30).
//
// 1. Invariant 6's predicate is `liveOnly(table)`, never `deleted_at is null` typed by hand.
//    Eight hand-written copies had accumulated when an audit counted them; each is a place a
//    change to what "live" means would miss.
// 2. No value is interpolated into SQL. `limit ${Number(x)}` was safe and still broke the rule,
//    and a rule with an exception is a rule nobody reads. Only `limit`/`offset` are caught here,
//    the shape that actually happened; `liveOnly(...)` and fixed identifiers stay allowed.
//
// Tests are skipped: they seed rows with whatever SQL states the case most plainly.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ALLOWED = new Set(['src/store/db.ts'])
const RULES: { re: RegExp; say: string }[] = [
  { re: /deleted_at is null/i, say: 'write liveOnly(table) instead of the predicate by hand' },
  { re: /\b(limit|offset)\s+\$\{/i, say: 'bind limit/offset as ? parameters' },
]

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(path)
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : []
  })
}

const findings: string[] = []
const files = walk('src').filter((f) => !ALLOWED.has(f))
for (const file of files) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return
    for (const rule of RULES) if (rule.re.test(line)) findings.push(`  ${file}:${i + 1}  ${rule.say}`)
  })
}

if (findings.length > 0) {
  console.error('✗ check:sql: a hard rule about SQL is broken')
  for (const f of findings) console.error(f)
  process.exit(1)
}
console.log(`✓ check:sql: ok (${files.length} file(s))`)
