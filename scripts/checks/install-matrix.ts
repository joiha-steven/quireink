// Guard #17: every way to install says the same thing (ADR 0065, "Luật I1, I2, I5").
//
// Three packages — the source, the image, the Cloudflare bundle — and a handful of places that are
// configuration over one of them. What drifts between them is never the code; it is the paper
// around it: a variable the app reads and no page names, a compose file that quietly builds `main`,
// a skill that still tells an agent the old way in. Each was true here at some point.
//
//   I1  every environment variable a server file reads is named in docs/environment.md
//   I2  every place has its file, is in the README's install table, and is installed by a test;
//       the compose files run the published image and only the build override builds
//   I5  the install skill names the default way in for each package
//   B1  the Deploy to Cloudflare button: both READMEs carry it; every secret it asks for has a
//       sentence beside it and no value in the public template; wrangler.jsonc has no `build`
//       and keeps the dashboard's variables; the deploy builds with CI's Bun
//
// Comments are stripped before reading code, so a variable a comment remembers is not "read".
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const faults: string[] = []

const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) {
      if (['src/assets', 'src/admin', 'src/test'].includes(rel)) continue
      walk(rel, out)
    } else if (rel.endsWith('.ts') && !rel.endsWith('.test.ts')) out.push(rel)
  }
  return out
}

// ---- I1 -------------------------------------------------------------------------------------

/** Read by the code but not configuration anybody sets: the platform's, or the shell's. */
const NOT_SETTINGS = new Set(['NODE_ENV', 'PATH', 'HOME', 'CI'])

const READS = [
  /process\.env\.([A-Z][A-Z0-9_]+)/g,
  /process\.env\[['"]([A-Z][A-Z0-9_]+)['"]\]/g,
  /\benv\(['"]([A-Z][A-Z0-9_]+)['"]\)/g,
  /\bsource\.([A-Z][A-Z0-9_]+)/g,
  /readSize\(source,\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
]
const used = new Map<string, string>()
for (const rel of walk('src')) {
  const code = stripComments(read(rel))
  for (const re of READS) for (const m of code.matchAll(re)) if (!used.has(m[1]!)) used.set(m[1]!, rel)
}
const envDoc = read('docs/environment.md')
for (const [name, where] of used) {
  if (NOT_SETTINGS.has(name)) continue
  if (!new RegExp(`\\b${name}\\b`).test(envDoc)) faults.push(`I1: ${name} is read in ${where} and named nowhere in docs/environment.md`)
}

// ---- I2 -------------------------------------------------------------------------------------

/** Each place: the file that IS it, and the test that installs it. */
const PLACES: { file: string; test: string }[] = [
  { file: 'server.sh', test: 'server-http' },
  { file: 'install.sh', test: 'source-fresh' },
  { file: 'docker-compose.image.yml', test: 'docker-fresh' },
  { file: 'deploy/kubernetes/README.md', test: 'docker-fresh' },
  { file: 'deploy/digitalocean/README.md', test: 'server-http' },
]
const readme = read('README.md')
const readmeVi = read('README.vi.md')
const matrix = read('scripts/ops/matrix.sh')
for (const p of PLACES) {
  if (!existsSync(join(ROOT, p.file))) faults.push(`I2: ${p.file} is a place to install and does not exist`)
  for (const [name, text] of [['README.md', readme], ['README.vi.md', readmeVi]] as const) {
    if (!text.includes(`(./${p.file})`)) faults.push(`I2: ${name}'s install table does not link ${p.file}`)
  }
  if (!new RegExp(`^\\s*${p.test}\\)`, 'm').test(matrix)) faults.push(`I2: ${p.file} is installed by the "${p.test}" cell, which scripts/ops/matrix.sh does not have`)
}
for (const f of ['docker-compose.yml', 'docker-compose.caddy.yml', 'docker-compose.image.yml']) {
  const compose = read(f)
  if (/^\s*build:/m.test(compose)) faults.push(`I2: ${f} builds the image; a blog runs a release (use docker-compose.build.yml to build)`)
  if (!compose.includes('image: quireink/quireink:${QUIREINK_TAG:-latest}')) faults.push(`I2: ${f} does not run quireink/quireink:\${QUIREINK_TAG:-latest}`)
}
if (!read('deploy/digitalocean/user-data.sh').includes('/server.sh')) faults.push('I2: deploy/digitalocean/user-data.sh no longer runs server.sh')
const matrixWorkflow = read('.github/workflows/release-matrix.yml')
for (const cell of ['source-fresh', 'source-upgrade', 'docker-fresh', 'docker-upgrade', 'server-http', 'cloudflare-dev']) {
  if (!matrixWorkflow.includes(cell)) faults.push(`I2: release-matrix.yml does not run the ${cell} cell`)
}

// ---- L5 (ADR 0066): every difference between the runtimes has a name and a row ----------------

const keysOf = (rel: string): string[] => [...read(rel).matchAll(/^\s+(\w+): '/gm)].map((m) => m[1]!)
const bunKeys = keysOf('src/runtime/bun/capabilities.ts')
const cfKeys = keysOf('src/runtime/cf/capabilities.ts')
const runtimesDoc = read('docs/runtimes.md')
const docKeys = [...runtimesDoc.matchAll(/^\| `(\w+)` \|/gm)].map((m) => m[1]!)
for (const k of new Set([...bunKeys, ...cfKeys, ...docKeys])) {
  if (!bunKeys.includes(k)) faults.push(`L5: ${k} is not in src/runtime/bun/capabilities.ts`)
  if (!cfKeys.includes(k)) faults.push(`L5: ${k} is not in src/runtime/cf/capabilities.ts`)
  if (!docKeys.includes(k)) faults.push(`L5: ${k} has no row in docs/runtimes.md`)
}

// ---- P4.4: every page that teaches an install is reached from docs/install.md ----------------

const installIndex = read('docs/install.md')
for (const page of ['docs/self-host.md', 'docs/self-host-docker.md', 'docs/runtimes.md', 'deploy/kubernetes/README.md', 'deploy/digitalocean/README.md']) {
  const linked = page.startsWith('docs/') ? `(${page.slice('docs/'.length)}` : `(../${page}`
  if (!installIndex.includes(linked)) faults.push(`P4.4: docs/install.md does not link ${page}`)
}
if (existsSync(join(ROOT, 'docs/self-host-cloudflare.md')) && !installIndex.includes('(self-host-cloudflare.md')) {
  faults.push('P4.4: docs/install.md does not link docs/self-host-cloudflare.md')
}

// ---- B1 (ADR 0066): what the Deploy to Cloudflare button reads ---------------------------------

const BUTTON = '[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/joiha-steven/quireink)'
for (const [name, text] of [['README.md', readme], ['README.vi.md', readmeVi]] as const) {
  if (!text.includes(BUTTON)) faults.push(`B1: ${name}'s install table has no Deploy to Cloudflare button pointing at the repository`)
}
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string>; cloudflare?: { bindings?: Record<string, { description?: string }> } }
const described = pkg.cloudflare?.bindings ?? {}
const secrets = read('.dev.vars.example').split('\n').filter((l) => /^[A-Z]/.test(l))
if (!secrets.some((l) => l.startsWith('SETUP_CODE='))) faults.push('B1: .dev.vars.example does not ask for SETUP_CODE, so the button would deploy a blog nobody can claim with a code')
for (const line of secrets) {
  const [name, ...rest] = line.split('=')
  // The button may offer the example's value as the answer: a value here is a code anyone can read.
  if (rest.join('=').trim() !== '') faults.push(`B1: .dev.vars.example gives ${name} a value; it is public, so it names secrets and never fills them`)
  if (!described[name!]?.description) faults.push(`B1: ${name} is asked for by the button and has no description in package.json "cloudflare"."bindings"`)
}
const wrangler = stripComments(read('wrangler.jsonc'))
if (/"build"\s*:/.test(wrangler)) faults.push('B1: wrangler.jsonc has a `build` field; `wrangler dev` reruns it mid-session and empties src/admin/dist (scripts/deploy-cloudflare.ts builds)')
if (!/"keep_vars"\s*:\s*true/.test(wrangler)) faults.push('B1: wrangler.jsonc does not keep_vars, so every deploy would delete the variables a button install set in the dashboard')
if (!pkg.scripts.deploy?.includes('scripts/deploy-cloudflare.ts')) faults.push('B1: the `deploy` script, which Workers Builds runs, does not go through scripts/deploy-cloudflare.ts')
const buildBun = read('scripts/deploy-cloudflare.ts').match(/BUILD_BUN = '([^']+)'/)?.[1]
for (const m of read('.github/workflows/ci.yml').matchAll(/bun-version:\s*([\d.]+)/g)) {
  if (m[1] !== buildBun) faults.push(`B1: CI tests with Bun ${m[1]} and scripts/deploy-cloudflare.ts builds button installs with ${buildBun}`)
}

// ---- I5 -------------------------------------------------------------------------------------

const skill = read('.claude/skills/quireink-install/SKILL.md')
for (const must of ['server.sh', 'install.sh', 'bun run upgrade', 'docker compose pull']) {
  if (!skill.includes(must)) faults.push(`I5: the quireink-install skill never mentions ${must}`)
}

console.log(`  ${used.size} environment variable(s) read, ${PLACES.length} place(s), ${docKeys.length} runtime difference(s), 1 skill`)
if (faults.length) {
  console.error('✗ check:install-matrix')
  for (const f of faults) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('✓ check:install-matrix: ok')
