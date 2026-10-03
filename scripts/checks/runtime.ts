// Guard #16: the runtime seam holds (ADR 0066, `src/runtime/ports.ts`).
//
// Quire Ink runs on Bun and on Cloudflare from one tree. Everything one of them cannot load lives
// in `src/runtime/bun/` or `src/runtime/cf/` behind `@/runtime/impl/<name>`; nowhere else may a
// server file import `bun:*`, `node:fs`, `node:net`, `node:tls`, `node:child_process`,
// `cloudflare:*` or `sharp` (a native codec no Worker can load), or touch the `Bun` global. One such line in a shared file and the Cloudflare
// bundle either fails to build or, worse, builds and fails on the request that reaches it.
//
// A RATCHET, while the seam is being cut (G1 of the Cloudflare plan): `PENDING` names the files that
// still cross it, each with where it is going. A NEW crossing fails. A listed file that no longer
// crosses fails too, so the list only ever shrinks and is never left describing a tree that has
// moved on. When it is empty, it stays empty.
//
// Comments are stripped first: a comment that says `Bun.hash` used to be here is history, not a
// dependency. Tests (`*.test.ts`, `src/test/`) may use `bun:test` and the rest freely: they run on
// Bun by definition. Browser code (`src/assets/js`, `src/admin`) never reaches either runtime.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
const SRC = join(ROOT, 'src')

// The modules only one runtime has, spelled every way an import can name them: `node:fs` and `fs`,
// a side-effect `import 'x'`, `require('x')`, a dynamic `import('x')` — and a shared file reaching
// into one runtime's folder directly (`@/runtime/bun/password`), which builds and then fails on the
// other runtime at the first call. Found missing by the runtime review of 2026-10-03.
const MOD = String.raw`(?:bun:[\w-]+|(?:node:)?fs(?:\/promises)?|(?:node:)?net|(?:node:)?tls|(?:node:)?child_process|cloudflare:[\w-]+|sharp|@\/runtime\/(?:bun|cf)\/[\w/-]+)`
const FORBIDDEN = new RegExp(
  [
    String.raw`from\s+['"]${MOD}['"]`,
    String.raw`\bimport\s+['"]${MOD}['"]`,
    String.raw`import\(\s*['"]${MOD}['"]\s*\)`,
    String.raw`\brequire\(\s*['"]${MOD}['"]\s*\)`,
    String.raw`\bBun\.[A-Za-z]`,
    String.raw`globalThis\[\s*['"]Bun['"]\s*\]`,
    String.raw`\bimport\.meta\.dir\b`,
  ].join('|'),
)

/**
 * Still crossing the seam, and where each is going. Empty since G1.8 (ADR 0067): the archive was
 * the last, and it is plain JS now. A new entry here needs a reason the seam cannot take.
 */
const PENDING: Record<string, string> = {}

const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const rel = relative(ROOT, path).split('\\').join('/')
    if (statSync(path).isDirectory()) {
      if (['src/runtime/bun', 'src/runtime/cf', 'src/test', 'src/assets', 'src/admin'].includes(rel)) continue
      walk(path, out)
    } else if (/\.(?:ts|tsx|js|mjs)$/.test(rel) && !/\.test\.(?:ts|tsx|js|mjs)$/.test(rel) && !rel.endsWith('.d.ts') && rel !== 'src/worker.ts') {
      // `src/worker.ts` is the Cloudflare entry, as `src/runtime/bun/main.ts` is Bun's.
      out.push(rel)
    }
  }
  return out
}

const crossing = walk(SRC).filter((rel) => FORBIDDEN.test(stripComments(readFileSync(join(ROOT, rel), 'utf8'))))
const fresh = crossing.filter((rel) => !(rel in PENDING))
const healed = Object.keys(PENDING).filter((rel) => !crossing.includes(rel))

console.log(`  ${crossing.length} file(s) still cross the runtime seam, ${Object.keys(PENDING).length} on the list`)
if (fresh.length || healed.length) {
  console.error('✗ check:runtime')
  for (const rel of fresh) console.error(`  - ${rel} imports something only one runtime has. Put it behind @/runtime/impl/ (src/runtime/ports.ts)`)
  for (const rel of healed) console.error(`  - ${rel} no longer crosses the seam: take it off PENDING in scripts/checks/runtime.ts`)
  process.exit(1)
}
console.log('✓ check:runtime: ok')
