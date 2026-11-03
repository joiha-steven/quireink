// Guard #18: every blog a script starts on this machine has the update check off.
//
// A server started the real way reports to check.quireink.com (`src/server/update-check.ts`), and
// that is how a from-source install is counted. A tour, a screenshot run or a matrix cell is not an
// install: on 2026-11-03, 7 of the 26 trial installs counted came from this project's own network,
// and `shoot-readme.sh` started four servers that reported every time it ran. Each spawn remembering
// `UPDATE_CHECK=0` on its own is what failed, so every one now goes through one place:
//
//   TypeScript   a spawn of `src/index.ts` takes its env from `localEnv()`, a `wrangler dev` passes
//                `UPDATE_CHECK:${updateCheck()}` (`scripts/local-env.ts`)
//   shell        a command running `bun … src/index.ts` or `docker run` carries
//                `UPDATE_CHECK="${UPDATE_CHECK:-0}"`; a file that runs `server.sh` builds its image
//                with `ENV UPDATE_CHECK=0`, because server.sh writes the container's .env itself
//
// Both forms keep a value the caller set, which is how the check itself is tested on purpose.
// Comments are stripped first, so a line that only explains a spawn is not one.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
const SELF = relative(ROOT, import.meta.path)
const SHELL_DEFAULT = '${UPDATE_CHECK:-0}'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.(ts|sh)$/.test(rel) && !rel.endsWith('.test.ts') && rel !== SELF) out.push(rel)
  }
  return out
}

const stripTs = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, '')).replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

/** Logical shell commands: continuation lines joined, comment lines dropped. */
const shellCommands = (code: string): { line: number; text: string }[] => {
  const out: { line: number; text: string }[] = []
  let text = '', start = 0
  code.split('\n').forEach((raw, i) => {
    if (!text) start = i + 1
    if (/^\s*#/.test(raw)) return
    text += raw
    if (raw.endsWith('\\')) { text = text.slice(0, -1) + ' '; return }
    out.push({ line: start, text })
    text = ''
  })
  return out
}

const lineOf = (code: string, at: number): number => code.slice(0, at).split('\n').length

export function faultsIn(rel: string, source: string): string[] {
  const faults: string[] = []
  if (rel.endsWith('.ts')) {
    const code = stripTs(source)
    for (const m of code.matchAll(/['"`]src\/index\.ts['"`]/g)) {
      if (!code.slice(m.index, m.index + 400).includes('localEnv()')) {
        faults.push(`${rel}:${lineOf(code, m.index)}  spawns src/index.ts without env: { ...localEnv(), … }`)
      }
    }
    for (const m of code.matchAll(/wrangler['"`]\)?\s*,\s*\[\s*['"`]dev['"`]/g)) {
      if (!code.slice(m.index, m.index + 600).includes('UPDATE_CHECK:${updateCheck()}')) {
        faults.push(`${rel}:${lineOf(code, m.index)}  runs wrangler dev without '--var', \`UPDATE_CHECK:\${updateCheck()}\``)
      }
    }
  } else {
    let runsServerSh = false
    for (const { line, text } of shellCommands(source)) {
      const starts = /\bbun\b[^|;&]*\bsrc\/index\.ts\b/.test(text) || /\bdocker run\b/.test(text)
      if (starts && !text.includes(`UPDATE_CHECK="${SHELL_DEFAULT}"`)) {
        faults.push(`${rel}:${line}  starts a blog without UPDATE_CHECK="${SHELL_DEFAULT}"`)
      }
      if (/\bserver\.sh\b/.test(text) && /\bbash\b/.test(text)) runsServerSh = true
    }
    if (runsServerSh && !source.includes('ENV UPDATE_CHECK=0')) {
      faults.push(`${rel}  runs server.sh on an image that does not set ENV UPDATE_CHECK=0`)
    }
  }
  return faults
}

if (import.meta.main) {
  const files = walk('scripts')
  const faults = files.flatMap((rel) => faultsIn(rel, readFileSync(join(ROOT, rel), 'utf8')))
  if (faults.length > 0) {
    console.error('✗ check:local-instances: a script starts a blog that reports to check.quireink.com')
    for (const f of faults) console.error(`  ${f}`)
    console.error('  Use localEnv() / updateCheck() from scripts/local-env.ts, or UPDATE_CHECK="${UPDATE_CHECK:-0}" in shell.')
    process.exit(1)
  }
  console.log(`✓ check:local-instances: ok (${files.length} file(s))`)
}
