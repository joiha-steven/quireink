// Guard #16: the runtime seam holds (ADR 0066, `src/runtime/ports.ts`).
//
// Quire Ink runs on Bun and on Cloudflare from one tree. Everything one of them cannot load lives
// in `src/runtime/bun/` or `src/runtime/cf/` behind `@/runtime/impl/<name>`; nowhere else may a
// server file import `bun:*`, `node:fs`, `node:net`, `node:tls`, `node:child_process` or
// `cloudflare:*`, or touch the `Bun` global. One such line in a shared file and the Cloudflare
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

const FORBIDDEN = /from\s+['"](bun:[\w-]+|node:fs(?:\/promises)?|node:net|node:tls|node:child_process|cloudflare:[\w-]+)['"]|import\(\s*['"](bun:[\w-]+|node:fs(?:\/promises)?|node:net|node:tls|node:child_process|cloudflare:[\w-]+)['"]\s*\)|\bBun\.[A-Za-z]/

/** Still crossing the seam, and where each is going. Shrinks to nothing; never grows. */
const PENDING: Record<string, string> = {
  'src/content/settings-save.ts': 'node:fs -> the Blob or Assets port (G1.7)',
  'src/import/zip-write.ts': 'Bun.file -> the Archive port (G1.8)',
  'src/media/blob-local.ts': 'the local blob store -> src/runtime/bun/blob.ts (G1.7)',
  'src/media/encode-variant.ts': 'the sharp child process -> src/runtime/bun/ (G1.7)',
  'src/media/image.ts': 'Bun.spawn -> @/runtime/impl/image (G1.7)',
  'src/render/og-card.ts': 'Bun.file -> the Assets port (G1.7)',
  'src/server/backup-offsite.ts': 'Bun.S3Client, Bun.file -> the Archive port (G1.8)',
  'src/server/backup.ts': 'tar via Bun.spawn -> the pure-JS archive writer (G1.8)',
  'src/server/export-md.ts': 'Bun.file -> the Archive port (G1.8)',
  'src/store/db.ts': 'bun:sqlite -> @/runtime/impl/db (G1.7)',
  'src/store/query.ts': 'bun:sqlite types -> @/runtime/impl/db (G1.7)',
  'src/store/upgrade.ts': 'bun:sqlite, VACUUM INTO -> @/runtime/impl/snapshot (G1.7)',
  'src/web/admin/ops.ts': 'node:fs/promises in the storage health check -> the Blob port (G1.7)',
  'src/web/admin/backup.ts': 'Bun.file -> the Archive port (G1.8)',
  'src/web/admin/spa.ts': 'Bun.embeddedFiles, node:fs -> @/runtime/impl/assets (G1.7)',
  'src/web/static.ts': 'Bun.file -> @/runtime/impl/assets (G1.7)',
}

const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const rel = relative(ROOT, path).split('\\').join('/')
    if (statSync(path).isDirectory()) {
      if (['src/runtime/bun', 'src/runtime/cf', 'src/test', 'src/assets', 'src/admin'].includes(rel)) continue
      walk(path, out)
    } else if (rel.endsWith('.ts') && !rel.endsWith('.test.ts') && !rel.endsWith('.d.ts')) {
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
