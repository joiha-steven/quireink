// Build Quire Ink for Cloudflare (ADR 0066): `bun run build:worker` -> dist/worker + dist/public.
//
// Bun's own bundler, so every import is loaded the way the server loads it under Bun — SQL and the
// built islands as text, fonts and icons as files — with four differences, each the Cloudflare half
// of something `src/runtime/ports.ts` describes:
//
//   1. `@/runtime/impl/<name>` resolves to `src/runtime/cf/<name>.ts`, not `bun/`.
//   2. A WebAssembly module is copied beside the worker and imported by name: workerd compiles it at
//      deploy time, because a Worker may not compile WASM from bytes while it runs.
//   3. A file imported `with { type: 'file' }` (a font, an icon) is copied into the Static Assets
//      directory, and the import gives its path there, which `cf/assets.ts` fetches.
//   4. The admin's built bundle becomes a module (`quire:admin-dist`), so its chunk names exist
//      before any request does.
//   5. Shiki's grammars are written into the Static Assets directory as JSON, each one once, and
//      `quire:grammars` says which files make up each language (`cf/shiki-engine.ts` says why).
//
// Run `bun run build` first: the islands and the admin are inputs here.
import type { BunPlugin } from 'bun'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

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

const ADMIN_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

function adminModule(): string {
  let names: string[] = []
  try {
    names = readdirSync(ADMIN).filter((n) => ADMIN_TYPES[n.slice(n.lastIndexOf('.'))])
  } catch {
    throw new Error('src/admin/dist is missing: run `bun run build` before `bun run build:worker`')
  }
  const files = names.map((name) => ({
    name,
    type: ADMIN_TYPES[name.slice(name.lastIndexOf('.'))],
    b64: readFileSync(join(ADMIN, name)).toString('base64'),
  }))
  return `const decode = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0))
export default ${JSON.stringify(files)}.map((f) => ({ name: f.name, type: f.type, body: decode(f.b64) }))`
}

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
    build.onLoad({ filter: /.*/, namespace: 'quire' }, async (args) => ({
      contents: args.path === 'quire:grammars' ? await grammarsModule() : adminModule(),
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
console.log(`worker: ${(size / 1024 / 1024).toFixed(2)} MB in ${result.outputs.length} file(s), assets in dist/public`)
