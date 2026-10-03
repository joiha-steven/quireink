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
for (const cell of ['source-fresh', 'source-upgrade', 'docker-fresh', 'docker-upgrade', 'server-http']) {
  if (!matrixWorkflow.includes(cell)) faults.push(`I2: release-matrix.yml does not run the ${cell} cell`)
}

// ---- I5 -------------------------------------------------------------------------------------

const skill = read('.claude/skills/quireink-install/SKILL.md')
for (const must of ['server.sh', 'install.sh', 'bun run upgrade', 'docker compose pull']) {
  if (!skill.includes(must)) faults.push(`I5: the quireink-install skill never mentions ${must}`)
}

console.log(`  ${used.size} environment variable(s) read, ${PLACES.length} place(s), 1 skill`)
if (faults.length) {
  console.error('✗ check:install-matrix')
  for (const f of faults) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('✓ check:install-matrix: ok')
