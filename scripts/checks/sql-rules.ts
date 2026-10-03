// Two hard rules about SQL in TypeScript, checked rather than remembered (2026-09-30).
//
// 1. Invariant 6's predicate is `liveOnly(table)`, never `deleted_at is null` typed by hand.
//    Eight hand-written copies had accumulated when an audit counted them; each is a place a
//    change to what "live" means would miss.
// 2. No value is interpolated into SQL. `limit ${Number(x)}` was safe and still broke the rule,
//    and a rule with an exception is a rule nobody reads. Only `limit`/`offset` are caught here,
//    the shape that actually happened; `liveOnly(...)` and fixed identifiers stay allowed.
//
// 3. Outside `src/store/`, nothing holds a connection (2026-10-03, ADR 0066). The data layer goes
//    through `@/store/query` (`all`, `one`, `run`, `exec`, `tx`, `analyticsQuery`); `db()` and
//    `analyticsDb()` are the store's, and a `bun:sqlite` `Database` is one runtime's driver,
//    which a Durable Object does not have. `src/runtime/` is where drivers live.
//
// Tests are skipped (`*.test.ts`, `src/test/`): they seed rows with whatever SQL states the case
// most plainly, through `src/test/sqlite.ts`.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ALLOWED = new Set(['src/store/db.ts'])
const RULES: { re: RegExp; say: string }[] = [
  { re: /deleted_at is null/i, say: 'write liveOnly(table) instead of the predicate by hand' },
  { re: /\b(limit|offset)\s+\$\{/i, say: 'bind limit/offset as ? parameters' },
]

/** Rule 3, which holds everywhere outside these. */
const DRIVER_HOME = ['src/store/', 'src/runtime/', 'src/test/']
const DRIVER = /\b(db|analyticsDb)\(\)|\bnew Database\b|['"]bun:sqlite['"]|['"]@\/runtime\/bun\/db['"]/
const DRIVER_SAY = 'go through @/store/query; a connection belongs to src/store/ and a driver to src/runtime/'

/**
 * Still breaking rule 3, and why. A ratchet like `check:runtime`'s: a new file fails, and a listed
 * file that stops breaking it fails until it comes off, so this only ever shrinks.
 */
const DRIVER_PENDING: Record<string, string> = {
  'src/server/backup.ts': 'opens its own VACUUM INTO copy to drop the caches; goes with the row archive (ADR 0067, G1.8)',
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(path)
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : []
  })
}

const findings: string[] = []
const files = walk('src').map((f) => f.split('\\').join('/')).filter((f) => !ALLOWED.has(f))
const stillDriving = new Set<string>()
for (const file of files) {
  const driverRule = !DRIVER_HOME.some((home) => file.startsWith(home))
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return
    for (const rule of RULES) if (rule.re.test(line)) findings.push(`  ${file}:${i + 1}  ${rule.say}`)
    if (driverRule && DRIVER.test(line)) {
      if (file in DRIVER_PENDING) stillDriving.add(file)
      else findings.push(`  ${file}:${i + 1}  ${DRIVER_SAY}`)
    }
  })
}
for (const file of Object.keys(DRIVER_PENDING)) {
  if (!stillDriving.has(file)) findings.push(`  ${file}  no longer holds a connection or a driver: take it off DRIVER_PENDING in scripts/checks/sql-rules.ts`)
}

if (findings.length > 0) {
  console.error('✗ check:sql: a hard rule about SQL is broken')
  for (const f of findings) console.error(f)
  process.exit(1)
}
console.log(`✓ check:sql: ok (${files.length} file(s))`)
