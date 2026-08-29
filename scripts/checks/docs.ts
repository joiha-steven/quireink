// Guards the documentation layout, so the "four homes" rule is held by a red check rather
// than by prose nobody re-reads. See docs/README.md for the layout itself, and ADR 0010
// for why it exists.
//
// Six rules, because the messes they catch are the ones this repository actually had:
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
//   6. A repository path written as code in a LIVE document exists. Rule 1 only sees links
//      between markdown files, so CLAUDE.md's debug router spent months pointing at two
//      source files that were not there, and the self-hosting guide documented a migration
//      command deleted a release earlier. Both were found by reading, not by a check.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = process.cwd()
const CLAUDE_MD_MAX = 120
// 400, down from 700 on 2026-08-03. The old cap was reached by `docs/features.md`, which sat
// at exactly 700 for weeks: the next feature line would have broken the build for whoever
// happened to add it. Both it and the parity inventory are now directories of files by area,
// and the largest document left is 318 lines. A file at the cap gets split, not squeezed.
const FILE_MAX = 400

// `.claude/skills` and not `.claude`: the skills ship with the repository and are read by
// an agent that has just cloned it, so they get the same link and size guards as docs/.
// The rest of that directory is one machine's private settings and is not in git.
const ROOTS = ['.', 'docs', 'scripts', '.github', '.claude/skills']

// `golden/corpus/` holds markdown FIXTURES, not documents. Their links point at
// deliberately fake images and dangerous schemes, because that is exactly what they test.
const skip = (p: string) =>
  /(^|\/)(node_modules|\.next|\.git|dist)\//.test(p) || p.startsWith('golden/corpus/')

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
      // walking it fully would scan `uploads/` and every scratch directory as well.
      d === '.'
        ? readdirSync('.').filter((n) => n.endsWith('.md'))
        : walk(d),
    ),
  ),
].sort()

const violations: string[] = []
const approaching: string[] = []

// 1. Relative links resolve. Absolute URLs, anchors and mailto are not our problem.
for (const file of files) {
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
  // Same approach warning as check:filesize, for the same reason: a hard cap with no
  // approach lights blocks whoever happens to add the line that crosses it, about a file
  // they were not thinking about.
  else if (n > FILE_MAX * 0.9) approaching.push(`${file}: ${n} of ${FILE_MAX}`)
}

// 6. A backticked repository path in a LIVE document actually exists.
//
// Rule 1 catches a broken link between two markdown files. It does not look at
// `src/web/auth.ts` written as code, and that is how CLAUDE.md's debug router — the first
// thing anyone opens when something is broken — came to send you to two files that are not
// there, and how `docs/self-host.md` came to document a migration command that had been
// deleted a release earlier. Both were found by hand, twice, months apart.
//
// LIVE is the operative word. `docs/decisions/` records what was decided when it was
// decided, and `docs/spec/` records a port from a tree that no longer exists; both name
// absent paths on purpose ("There is no `src/api/`"), and rewriting them to keep a checker
// happy would falsify the record. CHANGELOG.md is append-only for the same reason.
const RECORDS = (p: string) =>
  p.startsWith('docs/decisions/') || p.startsWith('docs/spec/') || p.endsWith('CHANGELOG.md')

// Paths a live document names BECAUSE they are gone. Listed with the reason, the same way
// `check:routes` lists each public write route: an exception on the record is a decision,
// an exception in someone's head is an omission.
const GONE: Record<string, string> = {
  'scripts/import-v1.ts': 'removed with the frozen tree (ADR 0019); self-host.md says so explicitly',
  'scripts/subset-font-axes.py': 'never in this tree; performance.md says so explicitly',
}

const REPO_PATH = /`((?:src|scripts|golden|docs)\/[A-Za-z0-9._/-]*[A-Za-z0-9._/-])`/g

for (const file of files) {
  if (RECORDS(file)) continue
  for (const [, raw] of readFileSync(file, 'utf8').matchAll(REPO_PATH)) {
    if (raw === undefined) continue
    const path = raw.replace(/\/$/, '')
    if (GONE[path] !== undefined) continue
    // A directory is written with a trailing slash; either form must resolve to something.
    if (existsSync(join(ROOT, path))) continue
    violations.push(`${file}: names \`${raw}\`, which does not exist`)
  }
}

// 7. The version, everywhere it is written down, is the version in package.json.
//
// The release checklist's step one is bumping FOUR tracked places, and
// `docs/conventions/releases.md` records the number going out inconsistent THREE times.
// A checklist that has failed three times is not a checklist problem, it is a missing
// guard — the same lesson as every other file in this directory. The chip is the line
// that is exactly `` `x.y.z` `` near the top of each README; releases.md states it in
// prose. Rule 6 skips records; this rule must NOT skip releases.md, which is why it names
// its files directly.
const pkgVersion = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version
for (const [file, pattern, what] of [
  ['README.md', `\n\`${pkgVersion}\`\n`, 'the version chip'],
  ['README.vi.md', `\n\`${pkgVersion}\`\n`, 'the version chip'],
  ['docs/conventions/releases.md', `the version is **\`${pkgVersion}\`**`, 'the versioning rule'],
] as const) {
  if (!readFileSync(join(ROOT, file), 'utf8').includes(pattern)) {
    violations.push(`${file}: ${what} does not say ${pkgVersion} (package.json does)`)
  }
}

console.log(`  scanned ${files.length} markdown file(s)`)
for (const a of approaching) console.log(`  · approaching the cap: ${a}`)
if (violations.length === 0) {
  console.log('✓ check:docs: ok')
} else {
  console.log(`✗ check:docs: ${violations.length} violation(s)`)
  for (const v of violations) console.log(`  - ${v}`)
  process.exit(1)
}
