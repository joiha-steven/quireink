// Guards the documentation layout, so the "four homes" rule is held by a red check rather
// than by prose nobody re-reads. See docs/README.md for the layout itself, and ADR 0010
// for why it exists.
//
// Ported from the frozen tree's `scripts/checks/docs.mjs` when the repository was
// reshuffled (ADR 0012). Same five rules, because the messes they catch are the ones this
// repository actually had:
//   1. No broken relative link between markdown files. Moving a doc used to leave dangling
//      links in five other files and nothing noticed. That is precisely what the reshuffle
//      that produced this file did to forty of them.
//   2. Every ADR appears in the decisions index, and the index cites no missing ADR.
//      An ADR nobody can find is worse than no ADR.
//   3. CLAUDE.md stays under its cap. It loads every turn, so it is a router, not a
//      library; it was 275 lines of restated rules before this check existed.
//   4. Nothing in docs/ carries a date in its filename. A dated file is a snapshot, and
//      snapshots left this repository with `state/` (ADR 0017).
//   5. No markdown file over 700 lines, CHANGELOG excepted (append-only by design).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = process.cwd()
const CLAUDE_MD_MAX = 170
const FILE_MAX = 700

const ROOTS = ['.', 'docs', 'scripts', '.github', 'v1']

// `golden/corpus/` holds markdown FIXTURES, not documents. Their links point at
// deliberately fake images and dangerous schemes, because that is exactly what they test.
const skip = (p: string) =>
  /(^|\/)(node_modules|\.next|\.git|dist)\//.test(p) || p.startsWith('golden/corpus/')

// FROZEN documents: a record of what was true on a date, never retro-edited, so their
// links are historical and are allowed to rot. Checking them would force exactly the
// retro-editing the rule forbids.
//   `scripts/port/` — the porting ledgers.
//   `v1/`           — the retired Next tree (ADR 0012). It takes no patches at all, security
//                     included, so a link inside it can never be repaired even in principle.
//                     It was only passing before because it links into `state/`, which was
//                     still here; ADR 0017 moved that out and six links went red at once.
// The audits and reports this also covered left with `state/` (ADR 0017).
const frozen = (p: string) => /^(scripts\/port|v1)\//.test(p)

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name).replaceAll('\\', '/').replace(/^\.\//, '')
    if (skip(p)) return []
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : []
  })

const lineCount = (s: string) => s.replace(/\n$/, '').split('\n').length

const files = [
  ...new Set(
    ROOTS.filter((d) => existsSync(d)).flatMap((d) =>
      // '.' is walked one level deep only; its subdirectories are listed explicitly, so
      // walking it fully would scan `v1/` twice and `uploads/` once.
      d === '.'
        ? readdirSync('.').filter((n) => n.endsWith('.md'))
        : walk(d),
    ),
  ),
].sort()

const violations: string[] = []

// 1. Relative links resolve. Absolute URLs, anchors and mailto are not our problem.
for (const file of files.filter((p) => !frozen(p))) {
  const src = readFileSync(file, 'utf8')
  for (const [, target] of src.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (target === undefined || /^([a-z][a-z0-9+.-]*:|#|<)/i.test(target)) continue
    const [path] = target.split('#')
    if (!path) continue // pure anchor
    if (!existsSync(resolve(dirname(join(ROOT, file)), path))) {
      violations.push(`${file}: broken link -> ${target}`)
    }
  }
}

// 2. The decisions index and the ADR files agree, in both directions.
const ADR_DIR = 'docs/decisions'
if (existsSync(ADR_DIR)) {
  const index = join(ADR_DIR, 'README.md')
  const adrs = files.filter((p) => p.startsWith(`${ADR_DIR}/`) && !p.endsWith('README.md'))
  if (!existsSync(index)) {
    violations.push(`${ADR_DIR}/README.md is missing (the still-in-force index)`)
  } else {
    const body = readFileSync(index, 'utf8')
    for (const adr of adrs) {
      const name = adr.slice(ADR_DIR.length + 1)
      if (!body.includes(name)) violations.push(`${index}: does not list ${name}`)
    }
    for (const [, cited] of body.matchAll(/\]\((\d{4}-[^)#]+\.md)\)/g)) {
      if (cited !== undefined && !existsSync(join(ADR_DIR, cited))) {
        violations.push(`${index}: cites missing ${cited}`)
      }
    }
  }
}

// 3. CLAUDE.md is a router, not a library.
for (const file of files.filter((p) => p.endsWith('CLAUDE.md'))) {
  const n = lineCount(readFileSync(file, 'utf8'))
  if (n > CLAUDE_MD_MAX) {
    violations.push(`${file}: ${n} lines, cap ${CLAUDE_MD_MAX}. Move detail into docs/ and link to it`)
  }
}

// 4. A dated filename is a snapshot; docs/ holds current truth only.
for (const file of files.filter((p) => p.startsWith('docs/'))) {
  const name = file.split('/').pop() ?? ''
  if (/\d{4}-\d{2}(-\d{2})?/.test(name)) {
    violations.push(`${file}: dated filename in docs/. docs/ holds current truth; a snapshot is not a document`)
  }
}

// 5. Size cap, so a doc gets split before it becomes unreadable. Append-only logs are
// exempt: they are read newest-first and never front to back, so the cap would buy nothing
// and the split would only move the problem.
const appendOnly = (p: string) => p.endsWith('CHANGELOG.md')
for (const file of files) {
  if (appendOnly(file)) continue
  const n = lineCount(readFileSync(file, 'utf8'))
  if (n > FILE_MAX) violations.push(`${file}: ${n} lines, cap ${FILE_MAX}. Split it`)
}

console.log(`  scanned ${files.length} markdown file(s)`)
if (violations.length === 0) {
  console.log('✓ check:docs: ok')
} else {
  console.log(`✗ check:docs: ${violations.length} violation(s)`)
  for (const v of violations) console.log(`  - ${v}`)
  process.exit(1)
}
