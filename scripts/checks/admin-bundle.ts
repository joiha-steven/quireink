// The admin bundle must not contain server code. Guard #8.
//
// The boundary this pins is real but was held by nothing: the admin imports server types
// (`import type { McpTokenInfo } from '@/mcp/tokens'`, and friends in `SettingsAiTab`,
// `McpFields`, `UpdateFields`, `Overview`) and the ONLY thing keeping the store out of the
// browser bundle is the word `type` in those lines. Delete it on any one of them and the
// bundler follows the value import through `store/query` into `bun:sqlite` — either the
// build breaks in a confusing place, or worse, server internals ship to every admin
// browser. Seven guards existed and none of them looked at what `build:admin` produced.
//
// So this one reads the OUTPUT. Not the import graph — the artifact. A canary string in
// `src/admin/dist/*.js` is proof the boundary broke no matter which import let it through.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIST = new URL('../../src/admin/dist', import.meta.url).pathname

// Each canary is a string that exists ONLY on the server side of the boundary.
const CANARIES = [
  'bun:sqlite', // the database driver itself
  'server_secrets', // the table every HMAC salt lives in
  'from mcp_tokens', // any token SQL
  'password_hash', // the users table's secret column, named in auth SQL
  // ...and one that is not about secrecy but about WEIGHT. `@/i18n/i18n` holds all eleven
  // READER dictionaries in a lookup table nothing can tree-shake, and four admin components
  // used to import it for `formatDate` and four theme words: 52 KB of a language the admin
  // never speaks, in the chunk every screen waits for. `@/i18n/format` is the half without
  // them. This string is a reader's pager label and appears in no admin dictionary.
  'pagerOlder',
]

if (!existsSync(DIST)) {
  console.error('admin-bundle: src/admin/dist does not exist — run `bun run build:admin` first')
  process.exit(1)
}

const files = readdirSync(DIST).filter((f) => f.endsWith('.js'))
if (files.length === 0) {
  // An empty dist would make the loop below pass vacuously — the same self-blinding that
  // killed the css guard six times. No files is a failure, not a clean bill.
  console.error('admin-bundle: no .js files in src/admin/dist — the guard has nothing to read')
  process.exit(1)
}

let bad = 0
for (const f of files) {
  const text = readFileSync(join(DIST, f), 'utf8')
  for (const canary of CANARIES) {
    if (text.includes(canary)) {
      console.error(`admin-bundle: ${f} contains "${canary}" — server code is in the browser bundle`)
      bad++
    }
  }
}

// The second thing this guard reads the OUTPUT for: every module has exactly ONE name.
//
// The admin shipped blank in 2.2.8 because it had two. The entry was written to disk as
// `main.js` and served under a fingerprint computed at runtime (`main.<hash>.js`), and Bun 1.4
// began emitting `from"./main.js"` inside every lazy route chunk where 1.3 emitted none. The
// browser fetched the entry under both names, a second module record gave a second copy of
// React, and the first lazy screen to call a hook threw React error #321.
//
// A bundler is free to point a chunk at any other chunk. What must hold is that the name it
// writes is a file that EXISTS — a dangling import is the same blank screen by a different
// route — and that the entry is not reachable under a second name. Both are answered here,
// from the artifact, because neither is visible in the source.
const ENTRY = files.filter((f) => /^admin\.[a-z0-9]+\.js$/.test(f))
if (ENTRY.length !== 1) {
  console.error(`admin-bundle: expected exactly one entry (admin.<hash>.js), found ${ENTRY.length}`)
  bad++
}

for (const f of files) {
  const text = readFileSync(join(DIST, f), 'utf8')
  // Static `from"./x.js"` / `import"./x.js"`, and the dynamic `import("./x.js")` a lazy
  // route arrives by. All three are names the browser will actually request.
  for (const match of text.matchAll(/(?:from|import)\s*\(?\s*"\.\/([^"]+\.js)"/g)) {
    const dep = match[1] ?? ''
    if (!files.includes(dep)) {
      console.error(`admin-bundle: ${f} imports "./${dep}", which is not in the bundle`)
      bad++
    }
  }
}

if (bad > 0) process.exit(1)
console.log(`admin-bundle: ${files.length} files clean of ${CANARIES.length} canaries, one entry, no dangling import`)
