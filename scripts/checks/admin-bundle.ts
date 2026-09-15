// The admin's browser bundles must not contain server code. Guard #8.
//
// The boundary this pins is real but was held by nothing: the islands import server types
// (`import type { McpTokenInfo } from '@/mcp/tokens'` and friends) and the ONLY thing keeping
// the store out of the browser is the word `type` in those lines. Delete it on any one of them
// and the bundler follows the value import through `store/query` into `bun:sqlite` — either
// the build breaks in a confusing place, or worse, server internals ship to every admin
// browser. Seven guards existed and none of them looked at what `build:admin` produced.
//
// So this one reads the OUTPUT. Not the import graph — the artifact. A canary string in
// `src/admin/dist/*.js` is proof the boundary broke no matter which import let it through.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
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

// The second thing this guard reads the OUTPUT for: every name a chunk imports is a file that
// EXISTS.
//
// The admin shipped blank in 2.2.8 for the neighbouring reason. Its entry was written to disk
// as `main.js` and served under a fingerprint computed at runtime, and Bun 1.4 began emitting
// `from"./main.js"` inside every lazy chunk where 1.3 emitted none: the browser fetched it
// under both names and the second module record was a second copy of React.
//
// A bundler is free to point a chunk at any other chunk. What must hold is that the name it
// writes resolves — a dangling import is the same blank screen by a different route — and that
// is answered here, from the artifact, because it is not visible in the source.
//
// ⚠️ THE RAIL IS THE ENTRY EVERY PAGE LOADS, and it is the one measured below. There is no
// single admin bundle any more (ADR 0054, step 6): every island is an entry of its own and a
// screen links the one it needs.
const RAIL = files.filter((f) => /^rail\.[a-z0-9]+\.js$/.test(f))
if (RAIL.length !== 1) {
  console.error(`admin-bundle: expected exactly one rail entry (rail.<hash>.js), found ${RAIL.length}`)
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

// The third thing, and it is about WEIGHT: what the browser must have before the first frame.
//
// `@/i18n/admin-i18n` imports all eleven admin dictionaries so the server can answer a login
// page in any of them from one process. One value import of it from the browser put all eleven
// in the chunk the entry waits for: the eager payload measured 1063 KB while the admin was
// React, of which about 71 KB was a language the owner reads.
//
// The server picks the language now and sends the words already chosen, inside the HTML — so a
// dictionary in a browser bundle is not merely heavy, it is a second source for a string the
// page already carries. Read from the artifact, and from the STATIC graph only.
const eager = new Set<string>()
const walkStatic = (f: string): void => {
  if (eager.has(f) || !files.includes(f)) return
  eager.add(f)
  const text = readFileSync(join(DIST, f), 'utf8')
  for (const match of text.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) walkStatic(match[1] ?? '')
}
if (RAIL[0]) walkStatic(RAIL[0])

/** A word that is in the Russian dictionary and in no other file the admin builds. */
const OTHER_TONGUE = 'Настройки'
for (const f of eager) {
  if (readFileSync(join(DIST, f), 'utf8').includes(OTHER_TONGUE)) {
    console.error(`admin-bundle: ${f} is fetched before the first frame and contains "${OTHER_TONGUE}" — every dictionary is back in the eager graph`)
    bad++
  }
}
const eagerKb = Math.round([...eager].reduce((n, f) => n + statSync(join(DIST, f)).size, 0) / 1024)

// The fourth thing, and it is the one nothing in the tree can see: ONE COPY OF THE EDITOR.
//
// ⚠️ THE EDITOR CHUNK CARRIED `prosemirror-view` THREE TIMES, and had for long enough that a
// cast was written to work around it and a comment explained it as a packaging fact. Five
// packages had 1.42.2 nested under them while the hoisted copy was 1.42.3 — with ranges the
// hoisted one satisfies, so there was no reason for it beyond a lockfile that had drifted.
// Two `overrides` lines took the admin's JavaScript from 1,170 KB to 976 KB.
//
// Two copies of ProseMirror is not merely weight. Every `PluginKey` is identity-compared,
// `instanceof` is how the view decides what a node is, and a second module record makes both
// of those answer wrong — on a schema the two copies agree about, which is why it shows up as
// behaviour nobody can reproduce rather than as an error.
//
// So it is read from the ARTEFACT, like everything else here, using strings that appear
// exactly once per copy of their package. A `bun install` that re-nests a version can then
// only get as far as the next build.
const ONE_EACH: Record<string, string> = {
  'prosemirror-view': 'DOM position not inside the editor',
  'prosemirror-state': 'Adding different instances of a keyed plugin',
  'prosemirror-transform': 'Structure replace would overwrite content',
}
for (const [pkg, once] of Object.entries(ONE_EACH)) {
  let seen = 0
  for (const f of files) {
    seen += readFileSync(join(DIST, f), 'utf8').split(once).length - 1
  }
  if (seen === 0) {
    // A string that stopped appearing is a probe that has gone blind, which reads exactly like
    // a clean bill. The same self-blinding the empty-dist check above exists for.
    console.error(`admin-bundle: the probe for ${pkg} ("${once}") is in no bundle — it was reworded upstream, so this guard is measuring nothing`)
    bad++
  } else if (seen > 1) {
    console.error(`admin-bundle: ${pkg} is in the bundles ${seen} times — two copies of ProseMirror break plugin keys and every instanceof. Check for a nested version under node_modules and pin it in package.json "overrides"`)
    bad++
  }
}

if (bad > 0) process.exit(1)
console.log(`admin-bundle: ${files.length} files clean of ${CANARIES.length} canaries, one rail entry, no dangling import, one copy of each of ${Object.keys(ONE_EACH).length} ProseMirror packages, ${eagerKb} KB before the first frame`)
