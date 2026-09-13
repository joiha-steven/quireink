// Every post's Markdown out of a `quire.db`, as files, so the two engines can be compared
// on real writing instead of on fixtures.
//
// READ-ONLY, and against a COPY. It opens the database the way a backup gives it to you —
// restored from an archive into a scratch directory — never a live one: a running instance
// has a write-ahead log, and reading around it is how you get a torn view that looks fine.
//
// The files it writes are somebody's posts. They go under `.tmp/`, which is gitignored, and
// they are never committed: this repository's first rule is zero personal data, and the
// comparison's ANSWER (a count, a list of shapes) is the part worth keeping.
//
// Usage:
//   bun scripts/md-corpus-from-db.ts <path to quire.db> <out dir>

import { Database } from 'bun:sqlite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [dbPath, outDir] = process.argv.slice(2)
if (!dbPath || !outDir) {
  console.error('usage: bun scripts/md-corpus-from-db.ts <quire.db> <out dir>')
  process.exit(1)
}

const db = new Database(dbPath, { readonly: true })
mkdirSync(outDir, { recursive: true })

type Row = { slug: string; title: string; content: string; status: string }
// Posts, pages and notes all render through the same body renderer, so all three belong in
// the comparison. A post in the trash is still a post somebody may restore.
const sources = [
  { table: 'posts', label: 'post' },
  { table: 'pages', label: 'page' },
  { table: 'notes', label: 'note' },
]

let written = 0
let bytes = 0
for (const { table, label } of sources) {
  let rows: Row[] = []
  try {
    rows = db.query(`select slug, title, content, status from ${table}`).all() as Row[]
  } catch {
    // A database from an older schema may not have every table. Not worth an error.
    continue
  }
  for (const row of rows) {
    if (!row.content || row.content.trim() === '') continue
    const name = `${label}--${row.slug}`.replace(/[^\w.-]/g, '_').slice(0, 120)
    writeFileSync(join(outDir, `${name}.md`), row.content)
    written += 1
    bytes += row.content.length
  }
}

db.close()
console.log(`${written} file(s), ${(bytes / 1024).toFixed(0)} KB of Markdown -> ${outDir}`)
