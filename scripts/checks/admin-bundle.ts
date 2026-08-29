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

if (bad > 0) process.exit(1)
console.log(`admin-bundle: ${files.length} files clean of ${CANARIES.length} canaries`)
