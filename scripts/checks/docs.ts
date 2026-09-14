// Guards the documentation layout, so the "four homes" rule is held by a red check rather
// than by prose nobody re-reads. See docs/README.md for the layout itself, and ADR 0010
// for why it exists.
//
// Seven rules, because the messes they catch are the ones this repository actually had:
//   1. No broken relative link between markdown files. Moving a doc used to leave dangling
//      links in five other files and nothing noticed. That is precisely what the reshuffle
//      that produced this file did to forty of them.
//   2. Every ADR appears in the decisions index, and the index cites no missing ADR.
//      An ADR nobody can find is worse than no ADR.
//   3. CLAUDE.md stays under its cap. It loads every turn, so it is a router, not a
//      library; it was 275 lines of restated rules before this check existed.
//   4. Nothing in docs/ carries a date in its filename. A dated file is a snapshot, and
//      snapshots left this repository with `state/` (ADR 0017).
//   5. No markdown file over 400 lines, CHANGELOG excepted (append-only by design).
//   6. A repository path written as code in a LIVE document exists. Rule 1 only sees links
//      between markdown files, so CLAUDE.md's debug router spent months pointing at two
//      source files that were not there, and the self-hosting guide documented a migration
//      command deleted a release earlier. Both were found by reading, not by a check.
//   7. The version, everywhere it is written down, is the one in package.json.
//   8. Every ADR header is the same three lines, and no proposal is left standing. Rule 2
//      checks that an ADR is FINDABLE; nothing checked that its status was true. ADR 0001
//      said "in force" for seven weeks after the cutover that ended it, and 0052 said
//      "proposed" while it was already running in production.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = process.cwd()
const CLAUDE_MD_MAX = 120
// 400, down from 700 on 2026-08-03. The old cap was reached by `docs/features.md`, which sat
// at exactly 700 for weeks: the next feature line would have broken the build for whoever
// happened to add it. Both it and the parity inventory are now directories of files by area,
// and the largest document left was 318 lines; several sit at 399 now. A file at the cap
// gets split, not squeezed.
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
const index = join(ADR_DIR, 'README.md')
const adrs = files.filter((p) => p.startsWith(`${ADR_DIR}/`) && !p.endsWith('README.md'))
if (existsSync(ADR_DIR)) {
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

// 8. The ADR header is three lines, and it never answers "does this still bind?".
//
// That question has exactly one home, the `In force` column of the decisions index, and the
// directory's own rules say so. It drifted anyway, in both directions, because a second copy
// of an answer is a second thing to keep current and nothing was watching either copy:
// `0001` carried `Status: **in force**, until the v2 cutover replaces the storage layer` for
// seven weeks after that cutover, while its row correctly read ended; `0052` was `proposed`
// in both places on the day its engine went to production.
//
// So the header carries only durable facts (when it was decided, what became of it, what it
// amends) and a fixed pointer here. The deadline on `proposed` is the part rule 2 never had:
// a proposal that is neither accepted nor superseded after a fortnight is not pending, it is
// forgotten, and this is the only way a file can notice that without someone reading it.
const ADR_POINTER = 'In force: see the [index](README.md). The index is maintained; this file is not.'
const PROPOSED_DAYS = 14

if (existsSync(index)) {
  const rows = readFileSync(index, 'utf8').split('\n')
  for (const adr of adrs) {
    const lines = readFileSync(adr, 'utf8').split('\n')
    const date = /^Date: (\d{4}-\d{2}-\d{2})\b/.exec(lines[2] ?? '')?.[1]
    const status = /^Status: (accepted|proposed|superseded)\b/.exec(lines[3] ?? '')?.[1]
    if (date === undefined) violations.push(`${adr}: line 3 must be \`Date: YYYY-MM-DD\``)
    if (status === undefined) {
      violations.push(`${adr}: line 4 must be \`Status: \` then accepted, proposed or superseded`)
    }
    if (lines[4] !== ADR_POINTER) violations.push(`${adr}: line 5 must be exactly \`${ADR_POINTER}\``)

    // The file and its row have to agree about whether the decision has been taken. They are
    // the two copies that drifted, so this is the seam that gets the check.
    const name = adr.slice(ADR_DIR.length + 1)
    // Anchored on the row's FIRST cell, not on the link appearing anywhere in it: an
    // `In force` note routinely cites other ADRs, so a loose match returns whichever row
    // happens to mention this one. 0005's note cites 0052, and that is the row it found.
    const row = rows.find((l) => l.startsWith(`| [${name.slice(0, 4)}](${name})`))
    if (row !== undefined && status !== undefined) {
      const flagged = row.includes('🚧')
      if (status === 'proposed' && !flagged) {
        violations.push(`${adr}: says proposed; its index row does not. One of them is wrong`)
      }
      if (status !== 'proposed' && flagged) {
        violations.push(`${index}: still flags ${name} 🚧 proposed; the file says ${status}`)
      }
    }

    if (date !== undefined && status === 'proposed') {
      const days = Math.floor((Date.now() - Date.parse(date)) / 86_400_000)
      if (days > PROPOSED_DAYS) {
        violations.push(`${adr}: proposed ${days} days ago. Accept it, supersede it, or delete it`)
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
//
// Empty since 2026-09-10: the two paths it carried (`scripts/import-v1.ts`, removed with the
// frozen tree, and `scripts/subset-font-axes.py`, never in this tree) are now named only by
// records, which this rule skips. The map stays so the next exception is a line here.
const GONE: Record<string, string> = {}

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
// The release checklist's step one is bumping SEVEN tracked places, and
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
  // NOT markdown, and that is why it drifted: `server.json` is the manifest the MCP
  // registry publishes from, it carries its own `version`, and nothing on the release
  // checklist named it. Found at 2.2.1 while the product was on 2.2.3 — two releases
  // behind, in the one file an outside directory reads to say what version this is.
  ['server.json', `"version": "${pkgVersion}"`, 'the MCP manifest version'],
  // The two Docker documents that DO name a version. The manifest pins on purpose (a
  // cluster should not move on `:latest`), and the pin sat at 2.2.3 through four releases
  // because no checklist line and no guard named it; the tag table exists to explain what an
  // exact pin means and must show the current one to mean anything.
  ['deploy/kubernetes/statefulset.yaml', `image: quireink/quireink:${pkgVersion}`, 'the image pin'],
  ['docs/dockerhub-overview.md', `| \`${pkgVersion}\` |`, 'the tag table'],
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
