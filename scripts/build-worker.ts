// Build Quire Ink for Cloudflare (ADR 0066): `bun run build:worker` -> dist/worker + dist/public.
//
// Bun's own bundler, so every import is loaded the way the server loads it under Bun — SQL and the
// built islands as text, fonts and icons as files — with these differences, each the Cloudflare half
// of something `src/runtime/ports.ts` describes:
//
//   1. `@/runtime/impl/<name>` resolves to `src/runtime/cf/<name>.ts`, not `bun/`.
//   2. A WebAssembly module is copied beside the worker and imported by name: workerd compiles it at
//      deploy time, because a Worker may not compile WASM from bytes while it runs.
//   3. A file imported `with { type: 'file' }` (a font, an icon) is copied into the Static Assets
//      directory, and the import gives its path there, which `cf/assets.ts` fetches.
//   4. The admin's built bundle is written into Static Assets, and `quire:admin-dist` carries only
//      what the shell must know about each file before any request does (`cf/assets.ts`).
//   5. Shiki's grammars are written into the Static Assets directory as JSON, each one once, and
//      `quire:grammars` says which files make up each language (`cf/shiki-engine.ts` says why).
//   6. `@/web/served-css` — the public sheets, minified — is evaluated HERE and replaced by its six
//      finished strings, so no isolate minifies CSS at module load (`web/served-css.ts`).
//   7. Every file whose URL carries its own version — the islands, the sheets, the admin's chunks,
//      the reading fonts — is written into Static Assets AT THAT URL, with a `_headers` giving each
//      the year-long `immutable` and the security headers the Worker would have sent. Static Assets
//      answers a path it has a file for before the Worker runs, so those requests never start an
//      isolate or wake the Durable Object; before 2026-10-03 every one of them went through it.
//      The lists come from the modules that name the files (`shipped*()`), never from here.
//
// Run `bun run build` first: the islands and the admin are inputs here.
import type { BunPlugin } from 'bun'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
// `--entry <file> --out <dir>` builds another worker the same way: `scripts/test-cf.ts` uses it for
// the worker that runs the port contracts inside workerd.
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}
const ENTRY = resolve(ROOT, arg('--entry') ?? 'src/worker.ts')
const OUT = resolve(ROOT, arg('--out') ?? 'dist/worker')
const PUBLIC = join(OUT, '..', `${basename(OUT) === 'worker' ? 'public' : `${basename(OUT)}-public`}`)
const ADMIN = join(ROOT, 'src', 'admin', 'dist')

rmSync(OUT, { recursive: true, force: true })
rmSync(PUBLIC, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
mkdirSync(join(PUBLIC, 'static'), { recursive: true })

if (!existsSync(ADMIN) || readdirSync(ADMIN).length === 0) {
  throw new Error('src/admin/dist is missing: run `bun run build` before `bun run build:worker`')
}

/** A file into Static Assets at its URL. */
function publish(url: string, body: string | Uint8Array): void {
  const path = join(PUBLIC, url)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

// ----- 7. what the edge serves by itself --------------------------------------------------------
//
// Imported under BUN, from the same modules the server runs, so every URL and every byte is the one
// a Bun server would answer at that path: the hashes in the names are worked out by the same code.
const { shippedAssets } = await import('../src/web/assets')
const { shippedStaticFiles } = await import('../src/web/static')
const { shippedAdminFiles } = await import('../src/web/admin/asset-route')
const { adminDist } = await import('../src/runtime/bun/assets')
const { SECURITY_HEADERS } = await import('../src/web/security-headers')

const shipped: string[] = []
for (const { url, body } of shippedAssets()) { publish(url, body); shipped.push(url) }
for (const { url, ref } of shippedStaticFiles()) { publish(url, readFileSync(ref)); shipped.push(url) }
const adminUrl = new Map<string, string>()
for (const { url, name, file } of shippedAdminFiles()) {
  publish(url, await file.body())
  shipped.push(url)
  adminUrl.set(name, url)
}

/**
 * The Worker's half of the admin: every built file's name, type, hash and static imports, and the
 * URL its bytes now sit at. A built file with no such URL would be a name the shell knows and no
 * runtime can serve, so it stops the build.
 */
function adminModule(): string {
  const files = [...adminDist()].map(([name, file]) => {
    const path = adminUrl.get(name)
    if (!path) throw new Error(`src/admin/dist/${name} has no URL in Static Assets (web/admin/spa.ts, shippedAdminFiles)`)
    return { name, type: file.type, hash: file.hash, imports: [...file.imports], path }
  })
  return `export default ${JSON.stringify(files)}`
}

/**
 * `_headers`: what Static Assets sends with the files above. Without it they would go out with its
 * default `max-age=0, must-revalidate` — a revalidation round trip per file per visit for bytes whose
 * URL already promises they never change — and without the four headers `web/security-headers.ts`
 * puts on everything the Worker answers. One rule per directory, from the URLs themselves; the
 * content types are Static Assets' own, which match the routes' (`scripts/parity.ts` compares them).
 *
 * `/fonts/*` and `/app-icon.png` carry no hash and are `immutable` all the same — that is what the
 * Bun routes have always sent for them (`web/static.ts`): the files are part of the release and a
 * font's name is its version. This keeps the two runtimes identical rather than deciding afresh.
 */
const IMMUTABLE = 'public, max-age=31536000, immutable'
const rules = [...new Set(shipped.map((url) => (dirname(url) === '/' ? url : `${dirname(url)}/*`)))]
const headerLines = [`Cache-Control: ${IMMUTABLE}`, ...Object.entries(SECURITY_HEADERS).map(([k, v]) => `${k}: ${v}`)]
writeFileSync(join(PUBLIC, '_headers'), [
  '# Written by scripts/build-worker.ts: the files Static Assets answers before the Worker runs.',
  ...rules.flatMap((rule) => [rule, ...headerLines.map((line) => `  ${line}`)]),
  '',
].join('\n'))

/**
 * Every grammar Shiki ships, written ONCE under `static/shiki/` as the JSON its module parses, and
 * the module that maps each language id to its files. Read from the very modules Bun imports, and
 * deduplicated the way Shiki's `resolveLangs` does it, so the list for a language is the array Bun
 * hands the registry, in the same order. Measured 2026-10-03: 242 languages are 260 distinct
 * grammars, 7.6 MB written once; written out per language, with what each embeds, they were 37.8 MB.
 *
 * Two grammars under one name would mean one silently replacing the other here and not on Bun, so
 * that stops the build rather than shipping a language that highlights differently.
 */
async function grammarsModule(): Promise<string> {
  const { bundledLanguagesInfo } = await import('shiki/langs')
  mkdirSync(join(PUBLIC, 'static', 'shiki'), { recursive: true })
  const files: string[] = []
  const written = new Map<string, { text: string; index: number }>()
  const langs: Record<string, number[]> = {}
  for (const info of bundledLanguagesInfo) {
    langs[info.id] = [...new Set((await info.import()).default)].map((g) => {
      const text = JSON.stringify(g)
      const seen = written.get(g.name)
      if (seen && seen.text !== text) throw new Error(`two different Shiki grammars are both called ${g.name}`)
      if (seen) return seen.index
      const path = `/static/shiki/${g.name}.json`
      writeFileSync(join(PUBLIC, path), text)
      written.set(g.name, { text, index: files.push(path) - 1 })
      return files.length - 1
    })
  }
  return `export default ${JSON.stringify({ files, langs })}`
}

const sha = (() => {
  try {
    return Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: ROOT }).stdout.toString().trim()
  } catch {
    return ''
  }
})()

/** Specifier as written -> the module's name beside the worker. */
const wasm = new Map<string, string>()

const plugin: BunPlugin = {
  name: 'quire-cloudflare',
  setup(build) {
    build.onResolve({ filter: /^@\/runtime\/impl\// }, (args) => ({
      path: join(ROOT, 'src', 'runtime', 'cf', `${args.path.slice('@/runtime/impl/'.length)}.ts`),
    }))
    build.onResolve({ filter: /^quire:(admin-dist|grammars)$/ }, (args) => ({ path: args.path, namespace: 'quire' }))
    build.onResolve({ filter: /^@\/web\/served-css$/ }, () => ({ path: 'quire:served-css', namespace: 'quire' }))
    build.onLoad({ filter: /.*/, namespace: 'quire' }, async (args) => ({
      contents: args.path === 'quire:grammars' ? await grammarsModule()
        : args.path === 'quire:served-css' ? `export const SERVED_CSS = ${JSON.stringify((await import('../src/web/served-css')).SERVED_CSS)}`
          : adminModule(),
      loader: 'js',
    }))
    build.onResolve({ filter: /\.wasm$/ }, (args) => {
      const from = args.path.startsWith('.') ? resolve(args.importer, '..', args.path) : Bun.resolveSync(args.path, args.importer)
      const name = basename(from)
      copyFileSync(from, join(OUT, name))
      // Bun keeps an external's original specifier in the output, so the bare name is rewritten to
      // the copy beside the worker once the bundle is written (below).
      wasm.set(args.path, `./${name}`)
      return { path: args.path, external: true }
    })
    build.onLoad({ filter: /\.(woff2?|ttf|png|ico|jpe?g|svg)$/ }, (args) => {
      const bytes = readFileSync(args.path)
      const name = `${createHash('sha256').update(bytes).digest('hex').slice(0, 10)}-${basename(args.path)}`
      copyFileSync(args.path, join(PUBLIC, 'static', name))
      return { contents: `export default ${JSON.stringify(`/static/${name}`)}`, loader: 'js' }
    })
  },
}

const result = await Bun.build({
  entrypoints: [ENTRY],
  outdir: OUT,
  naming: 'worker.js',
  target: 'browser',
  format: 'esm',
  minify: true,
  conditions: ['workerd', 'worker', 'browser'],
  external: ['cloudflare:*', 'node:*'],
  define: { __QUIRE_BUILD_SHA__: JSON.stringify(sha), 'process.env.NODE_ENV': '"production"' },
  plugins: [plugin],
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
const entry = join(OUT, 'worker.js')
let code = readFileSync(entry, 'utf8')
for (const [specifier, local] of wasm) code = code.split(JSON.stringify(specifier)).join(JSON.stringify(local))
await Bun.write(entry, code)
const size = result.outputs.reduce((n, o) => n + o.size, 0)
console.log(`worker: ${(size / 1024 / 1024).toFixed(2)} MB in ${result.outputs.length} file(s), assets in ${PUBLIC.slice(ROOT.length + 1)} (${shipped.length} served before the Worker)`)
