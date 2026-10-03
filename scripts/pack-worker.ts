// The Cloudflare package of a release (ADR 0065, package C): `bun scripts/pack-worker.ts` after
// `bun run build && bun run build:worker` writes `dist/quireink-cf-<version>.tar` and its `.sha256`.
//
// Inside: `worker/` (the Worker and its WebAssembly modules), `public/` (the Static Assets) and
// `manifest.json` — the version, the bindings the Worker expects, and the SHA-256 of every file.
// The installer inside a running Quire Ink (`src/install/cloudflare/`, G5) fetches this from the
// GitHub Release, checks the archive's hash against the published `.sha256` and every file against
// the manifest, and uploads exactly these bytes. Only CI builds it (`publish.yml`, rule L11), and CI
// attests where it came from (GitHub artifact attestations).
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { APP_VERSION } from '../src/version'

const ROOT = resolve(import.meta.dir, '..')
const DIST = join(ROOT, 'dist')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const sha = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex')
const entries = [...files(join(DIST, 'worker')), ...files(join(DIST, 'public'))].map((path) => ({
  path: relative(DIST, path).split('\\').join('/'),
  bytes: statSync(path).size,
  sha256: sha(readFileSync(path)),
}))

const manifest = {
  format: 'quireink-cf/1',
  version: APP_VERSION,
  main: 'worker/worker.js',
  compatibilityDate: '2026-09-30',
  compatibilityFlags: ['nodejs_compat'],
  durableObjects: [{ binding: 'BLOG', className: 'Blog' }],
  bindings: { r2: 'BLOBS', assets: 'ASSETS', images: 'IMAGES' },
  files: entries,
}
writeFileSync(join(DIST, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

const tar = `quireink-cf-${APP_VERSION}.tar`
// COPYFILE_DISABLE: a Mac's tar otherwise writes an AppleDouble `._name` beside every file — 385 of
// them in a package of 385 files, measured 2026-10-03. The installer reads only what the manifest
// lists, so they were never uploaded, but a package built for a trial move was twice the entries.
const made = Bun.spawnSync(['tar', '-cf', tar, 'manifest.json', 'worker', 'public'], { cwd: DIST, env: { ...process.env, COPYFILE_DISABLE: '1' } })
if (made.exitCode !== 0) {
  console.error(made.stderr.toString())
  process.exit(1)
}
const digest = sha(readFileSync(join(DIST, tar)))
writeFileSync(join(DIST, `${tar}.sha256`), `${digest}  ${tar}\n`)
console.log(`${tar}: ${entries.length} files, sha256 ${digest}`)
